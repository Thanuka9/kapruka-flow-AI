from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator
import uuid
import json
import re
import time
import asyncio
from collections import defaultdict, deque
from datetime import datetime
from typing import Optional, List, Dict, Any

from .config import settings
from .logging_config import setup_logging, get_logger

logger = setup_logging(settings.log_level)
api_logger = get_logger("api")

from .database import (
    init_db,
    save_message,
    get_messages,
    save_cart_versions,
    get_cart_versions,
    get_story,
    save_user_preferences,
    get_user_preferences,
    save_delivery_state,
    get_delivery_state,
    log_analytics,
    create_user,
    get_user,
    verify_password,
    save_order,
    get_user_orders,
    get_session_order,
)
from .agents import execute_agent_pipeline, run_shopping_agent
from .mcp_client import call_mcp_tool_safe, call_tool, mcp_session, parse_json_response
from .mcp_intelligence import (
    build_user_profile_from_history,
    enrich_user_profile_with_saved,
)

ALLOW_SIMULATED_CHECKOUT = settings.allow_simulated_checkout

app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    docs_url="/docs" if not settings.is_production else None,
    redoc_url=None,
)

# CORS — origins are env-driven. Credentials are disabled when "*" is used,
# because the two are not allowed together by the CORS spec / browsers.
_allow_all = settings.allowed_origins == ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=not _allow_all,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)


@app.middleware("http")
async def log_requests(request, call_next):
    start = time.perf_counter()
    response = await call_next(request)
    duration_ms = (time.perf_counter() - start) * 1000
    api_logger.info(
        "%s %s -> %s (%.1f ms)",
        request.method,
        request.url.path,
        response.status_code,
        duration_ms,
    )
    return response


# ── Lightweight in-process rate limiter ─────────────────────────────────
# Protects the expensive MCP-backed routes from a single client hammering
# them (the upstream MCP rate-limits aggressively; better to fail fast here).
_RATE_LIMITS = {
    "/api/intent": (10, 60.0),  # 10 builds/min per client
    "/api/checkout": (6, 60.0),
    "/api/login": (12, 60.0),
    "/api/search": (30, 60.0),
}
_rate_buckets: Dict[str, deque] = defaultdict(deque)


@app.middleware("http")
async def rate_limit(request: Request, call_next):
    limit_cfg = _RATE_LIMITS.get(request.url.path)
    if limit_cfg:
        max_calls, window = limit_cfg
        forwarded = request.headers.get("x-forwarded-for", "")
        client = forwarded.split(",")[0].strip() or (
            request.client.host if request.client else "unknown"
        )
        key = f"{client}:{request.url.path}"
        now = time.monotonic()
        bucket = _rate_buckets[key]
        while bucket and (now - bucket[0]) > window:
            bucket.popleft()
        if len(bucket) >= max_calls:
            api_logger.warning("Rate limit hit: %s %s", client, request.url.path)
            return JSONResponse(
                status_code=429,
                content={
                    "detail": "Too many requests — please slow down and try again shortly."
                },
            )
        bucket.append(now)
    return await call_next(request)


# Initialize database on startup
@app.on_event("startup")
async def startup_event():
    init_db()
    logger.info(
        "%s v%s started (env=%s, mcp=%s)",
        settings.app_name,
        settings.app_version,
        settings.environment,
        settings.mcp_url,
    )


# Request Models
class IntentRequest(BaseModel):
    text: str = Field(min_length=2, max_length=600)
    language: Optional[str] = Field(default=None, max_length=10)
    session_id: Optional[str] = Field(default=None, max_length=64)
    budget: Optional[float] = Field(default=None, ge=100, le=10_000_000)
    evolution: Optional[List[Any]] = Field(default=None, max_length=100)
    user_email: Optional[str] = Field(default=None, max_length=254)
    category_hint: Optional[str] = Field(default=None, max_length=80)
    saved_products: Optional[List[Dict[str, Any]]] = Field(default=None, max_length=50)

    @field_validator("text")
    @classmethod
    def strip_text(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("text must not be blank")
        return v


class CheckoutRequest(BaseModel):
    session_id: str = Field(max_length=64)
    cart_version: str = Field(pattern=r"^(initial|cheaper|premium|fast)$")
    recipient_name: str = Field(min_length=1, max_length=120)
    recipient_phone: str = Field(min_length=7, max_length=20)
    delivery_address: str = Field(min_length=3, max_length=400)
    delivery_city: str = Field(min_length=2, max_length=80)
    delivery_date: str  # YYYY-MM-DD, validated below
    delivery_instructions: Optional[str] = Field(default=None, max_length=500)
    sender_name: str = Field(min_length=1, max_length=120)
    gift_message: Optional[str] = Field(default=None, max_length=500)
    currency: Optional[str] = Field(default="LKR", max_length=8)
    email: Optional[str] = Field(
        default=None, max_length=254
    )  # Associate logged-in email
    delivery_option: Optional[str] = Field(default="scheduled")

    @field_validator("delivery_date")
    @classmethod
    def valid_date(cls, v: str) -> str:
        try:
            datetime.strptime(v, "%Y-%m-%d")
        except ValueError:
            raise ValueError("delivery_date must be in YYYY-MM-DD format")
        return v

    @field_validator("recipient_phone")
    @classmethod
    def valid_phone(cls, v: str) -> str:
        cleaned = re.sub(r"[\s\-()]", "", v)
        if not re.fullmatch(r"\+?\d{7,15}", cleaned):
            raise ValueError("recipient_phone must be a valid phone number")
        return v


class AnalyticsRequest(BaseModel):
    session_id: Optional[str]
    event_type: str
    event_data: Dict[str, Any]


class UpdateCartRequest(BaseModel):
    session_id: str
    cart_versions: Dict[str, List[Dict[str, Any]]]
    evolution: Optional[List[Any]] = None


class LoginRequest(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    name: Optional[str] = Field(default=None, max_length=120)
    password: str = Field(min_length=4, max_length=128)

    @field_validator("email")
    @classmethod
    def valid_email(cls, v: str) -> str:
        v = v.strip().lower()
        if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", v):
            raise ValueError("email must be a valid address")
        return v


@app.post("/api/intent")
async def handle_intent(req: IntentRequest):
    # Generate new session ID if not provided
    session_id = req.session_id or str(uuid.uuid4())

    # Save user message to database
    save_message(session_id, "user", req.text)

    try:
        user_profile = None
        if req.user_email:
            orders = get_user_orders(req.user_email)
            user_profile = build_user_profile_from_history(orders)
        if req.saved_products:
            user_profile = enrich_user_profile_with_saved(
                user_profile, req.saved_products
            )
        if user_profile:
            log_analytics(
                session_id,
                "user_profile_applied",
                {
                    "email": req.user_email,
                    "order_count": user_profile.get("order_count", 0),
                    "saved_count": user_profile.get("saved_count", 0),
                },
            )

        result = await execute_agent_pipeline(
            req.text,
            req.language,
            req.budget,
            user_profile=user_profile,
            category_hint=req.category_hint,
        )

        versions = result.get("cart_versions", {})
        metadata = result.get("metadata", {})
        if metadata.get("mcp_product_count", 0) == 0:
            raise HTTPException(
                status_code=503,
                detail="Kapruka MCP returned no products. Try a broader shopping intent.",
            )
        if not versions.get("initial"):
            raise HTTPException(
                status_code=503,
                detail="Could not build a shopping plan from Kapruka catalog.",
            )

        # Save results to database
        story = result.get("story", [])
        save_cart_versions(session_id, versions, story)

        # Save user preferences with evolution
        metadata = result.get("metadata", {})
        intent_parsed = metadata.get("intent_parsed", {})
        save_user_preferences(
            session_id,
            budget=intent_parsed.get("budget", 25000.0),
            language=intent_parsed.get("language", "en"),
            city=metadata.get("delivery_city", "Colombo 01"),
            delivery_speed=intent_parsed.get("delivery_speed", "standard"),
            evolution=json.dumps(req.evolution) if req.evolution else None,
        )

        # Pre-fill delivery state with city
        save_delivery_state(
            session_id,
            city=metadata.get("delivery_city", "Colombo 01"),
            address="",
            recipient_name="",
            recipient_phone="",
            sender_name="",
            gift_message=intent_parsed.get("gift_message", ""),
        )

        # Save agent response (story) to DB message log
        save_message(session_id, "assistant", " | ".join(story))

        # Return complete payload
        return {
            "session_id": session_id,
            "cart_versions": versions,
            "story": story,
            "metadata": metadata,
            "pipeline_events": result.get("pipeline_events", []),
        }

    except HTTPException:
        raise
    except Exception as e:
        api_logger.exception("Intent pipeline failed for session %s", session_id)
        log_analytics(session_id, "pipeline_error", {"detail": str(e)})
        raise HTTPException(
            status_code=500, detail="Failed to build a shopping plan. Please try again."
        )


_active_checkouts = set()


def _get_price_from_raw(data: Dict[str, Any]) -> float:
    p_price = data.get("price", {})
    if isinstance(p_price, dict):
        return float(p_price.get("amount") or 0.0)
    try:
        return float(p_price)
    except (TypeError, ValueError):
        return 0.0


@app.post("/api/checkout")
async def handle_checkout(req: CheckoutRequest):
    # Determine delivery fee early for consistency
    DELIVERY_FEES = {
        "same-day": 600.0,
        "same_day": 600.0,
        "next-day": 400.0,
        "next_day": 400.0,
        "scheduled": 300.0,
    }
    opt = (req.delivery_option or "scheduled").lower().strip()
    delivery_fee = DELIVERY_FEES.get(opt, 300.0)

    # 1. Idempotency Check
    existing_order = get_session_order(req.session_id, req.cart_version)
    if existing_order:
        api_logger.warning(
            "Idempotency: Order already exists for session %s, version %s",
            req.session_id,
            req.cart_version,
        )
        return {
            "success": True,
            "order_number": existing_order["order_id"],
            "payment_url": f"https://www.kapruka.com/shop/paymentGatewayCheck.jsp?orderId={existing_order['order_id']}",
            "total": existing_order["total_price"],
            "confirmed_total": existing_order["total_price"],
            "delivery_fee": delivery_fee,
            "delivery_option": req.delivery_option,
            "delivery_date": req.delivery_date,
            "currency": "LKR",
            "formatted_message": "Order retrieved successfully (idempotent result).",
            "duplicate": True,
        }

    # 2. Concurrency Lock
    lock_key = f"{req.session_id}:{req.cart_version}"
    if lock_key in _active_checkouts:
        raise HTTPException(status_code=409, detail="checkout_duplicate_prevented")
    _active_checkouts.add(lock_key)

    try:
        # Fetch products for the specified version from DB
        versions = get_cart_versions(req.session_id)
        if not versions or req.cart_version not in versions:
            raise HTTPException(
                status_code=404, detail="Cart version not found for this session"
            )

        products = versions[req.cart_version]
        if not products:
            raise HTTPException(status_code=400, detail="checkout_cart_empty")

        # Safe price sum extraction helper
        def safe_price_sum(prods):
            total = 0.0
            for p in prods:
                price = p.get("price", 0)
                if isinstance(price, dict):
                    total += float(price.get("amount", 0))
                else:
                    try:
                        total += float(price)
                    except (TypeError, ValueError):
                        pass
            return total

        # 3. Delivery Date & City Validation
        try:
            delivery_date_dt = datetime.strptime(req.delivery_date, "%Y-%m-%d")
            if delivery_date_dt.date() < datetime.now().date():
                raise HTTPException(status_code=400, detail="checkout_date_past")
        except ValueError:
            raise HTTPException(
                status_code=400, detail="delivery_date must be YYYY-MM-DD"
            )

        # 4. Server-side price & stock verification
        async def verify_product(p):
            raw_details = await call_mcp_tool_safe(
                "kapruka_get_product",
                {"params": {"product_id": p["id"], "response_format": "json"}},
            )
            if not raw_details:
                return p, None
            try:
                data = json.loads(raw_details)
                if "result" in data and isinstance(data["result"], dict):
                    data = data["result"]
                return p, data
            except Exception:
                return p, None

        verification_tasks = [verify_product(p) for p in products]
        verification_results = await asyncio.gather(*verification_tasks)

        # Validate each product's price and stock
        for p, live_data in verification_results:
            db_price = safe_price_sum([p])

            if not live_data:
                # If remote details are completely unavailable, fallback in simulated mode, otherwise raise
                if not ALLOW_SIMULATED_CHECKOUT:
                    raise HTTPException(
                        status_code=400, detail="checkout_item_unavailable"
                    )
                continue

            # Check stock status
            in_stock = live_data.get("in_stock", True)
            if in_stock in (False, 0, "false", "False"):
                raise HTTPException(status_code=400, detail="checkout_item_unavailable")

            # Check price change (within 5% threshold)
            live_price = _get_price_from_raw(live_data)
            if db_price > 0:
                price_ratio = live_price / db_price
                if price_ratio < 0.95 or price_ratio > 1.05:
                    # Price changed significantly
                    raise HTTPException(
                        status_code=400, detail="checkout_price_changed"
                    )

        # Verify delivery option authoritatively
        DELIVERY_FEES = {
            "same-day": 600.0,
            "same_day": 600.0,
            "next-day": 400.0,
            "next_day": 400.0,
            "scheduled": 300.0,
        }
        opt = (req.delivery_option or "scheduled").lower().strip()
        delivery_fee = DELIVERY_FEES.get(opt, 300.0)

        # Verify delivery city using kapruka_check_delivery tool
        delivery_params = {
            "params": {
                "city": req.delivery_city,
                "delivery_date": req.delivery_date,
                "product_id": products[0]["id"]
                if products
                else "EF_PC_GROC0V3441P00013",
                "response_format": "json",
            }
        }
        del_res = await call_mcp_tool_safe("kapruka_check_delivery", delivery_params)
        if del_res:
            try:
                del_data = json.loads(del_res)
                if "result" in del_data and isinstance(del_data["result"], dict):
                    del_data = del_data["result"]

                # If not available to this city/date
                if del_data.get("available") in (False, 0, "false", "False"):
                    raise HTTPException(
                        status_code=400, detail="checkout_city_required"
                    )
                if del_data.get("rate") is not None:
                    # Prefer authoritative MCP rate if available
                    delivery_fee = float(del_data["rate"])
            except HTTPException:
                raise
            except Exception as e:
                api_logger.warning("Could not parse check_delivery result: %s", e)

        # Categories actually purchased — persisted so the AI learns real preferences.
        order_categories = [p.get("category") for p in products if p.get("category")]

        # Save the updated delivery state to DB
        save_delivery_state(
            req.session_id,
            city=req.delivery_city,
            address=req.delivery_address,
            recipient_name=req.recipient_name,
            recipient_phone=req.recipient_phone,
            sender_name=req.sender_name,
            gift_message=req.gift_message,
        )

        # Build cart items for MCP
        mcp_cart = []
        for p in products:
            mcp_cart.append({"product_id": p["id"], "quantity": p.get("quantity", 1)})

        api_logger.info(
            "Creating Kapruka guest order via MCP for session %s", req.session_id
        )

        # Call remote MCP
        order_params = {
            "params": {
                "cart": mcp_cart,
                "recipient": {"name": req.recipient_name, "phone": req.recipient_phone},
                "delivery": {
                    "address": req.delivery_address,
                    "city": req.delivery_city,
                    "date": req.delivery_date,
                    "location_type": "house",
                    "instructions": req.delivery_instructions,
                },
                "sender": {"name": req.sender_name, "anonymous": False},
                "gift_message": req.gift_message,
                "currency": req.currency or "LKR",
                "response_format": "json",
            }
        }

        mcp_res = await call_mcp_tool_safe("kapruka_create_order", order_params)

        # Track order check event in database analytics
        log_analytics(
            req.session_id,
            "checkout_attempt",
            {"cart_version": req.cart_version, "total_items": len(mcp_cart)},
        )

        if mcp_res:
            try:
                order_data = json.loads(mcp_res)
                order_num = (
                    order_data.get("order_ref")
                    or order_data.get("order_number")
                    or order_data.get("order_id")
                )
                if not order_num:
                    order_num = "FLOW-REF-" + str(uuid.uuid4())[:8]

                summary = order_data.get("summary") or {}
                total_val = summary.get("grand_total") or order_data.get("total")
                if not total_val:
                    total_val = safe_price_sum(products) + delivery_fee
                else:
                    try:
                        total_val = float(total_val)
                    except Exception:
                        total_val = safe_price_sum(products) + delivery_fee

                pay_url = (
                    order_data.get("checkout_url")
                    or order_data.get("payment_url")
                    or order_data.get("pay_url")
                )
                if not pay_url:
                    pay_url = f"https://www.kapruka.com/shop/paymentGatewayCheck.jsp?orderId={order_num}"

                # Log success
                log_analytics(
                    req.session_id,
                    "checkout_success",
                    {"order_number": order_num, "total": total_val},
                )
                # Save order to DB history
                save_order(
                    order_id=order_num,
                    email=req.email,
                    session_id=req.session_id,
                    version=req.cart_version,
                    total_price=total_val,
                    delivery_city=req.delivery_city,
                    recipient_name=req.recipient_name,
                    categories=order_categories,
                )
                return {
                    "success": True,
                    "order_number": order_num,
                    "payment_url": pay_url,
                    "total": total_val,
                    "confirmed_total": total_val,
                    "delivery_fee": delivery_fee,
                    "delivery_option": req.delivery_option,
                    "delivery_date": req.delivery_date,
                    "currency": order_data.get("currency", "LKR"),
                    "formatted_message": order_data.get(
                        "message", "Order created successfully!"
                    ),
                }
            except Exception as e:
                api_logger.warning(
                    "Could not parse MCP order result, attempting link fallback: %s", e
                )
                pay_link_match = re.search(
                    r"href=['\"](.*?)['\"]|\]\((https://.*?pay.*?)\)",
                    mcp_res,
                    re.IGNORECASE,
                )
                if pay_link_match:
                    url = pay_link_match.group(1) or pay_link_match.group(2)
                    sim_order_id = "TEMP-" + str(uuid.uuid4())[:8]
                    final_total = safe_price_sum(products) + delivery_fee
                    save_order(
                        order_id=sim_order_id,
                        email=req.email,
                        session_id=req.session_id,
                        version=req.cart_version,
                        total_price=final_total,
                        delivery_city=req.delivery_city,
                        recipient_name=req.recipient_name,
                        categories=order_categories,
                    )
                    return {
                        "success": True,
                        "order_number": sim_order_id,
                        "payment_url": url,
                        "total": final_total,
                        "confirmed_total": final_total,
                        "delivery_fee": delivery_fee,
                        "delivery_option": req.delivery_option,
                        "delivery_date": req.delivery_date,
                        "currency": req.currency or "LKR",
                        "formatted_message": mcp_res,
                    }

        api_logger.error("MCP order creation failed for session %s", req.session_id)
        log_analytics(
            req.session_id, "checkout_failed", {"cart_version": req.cart_version}
        )

        if not ALLOW_SIMULATED_CHECKOUT:
            raise HTTPException(
                status_code=503,
                detail="Kapruka order creation failed. Please verify delivery details and try again.",
            )

        sim_order_id = "FLOW-SIM-" + str(uuid.uuid4())[:8]
        sim_url = f"https://www.kapruka.com/shop/paymentGatewayCheck.jsp?orderId={sim_order_id}"
        log_analytics(req.session_id, "checkout_fallback", {"order_id": sim_order_id})
        final_total = safe_price_sum(products) + delivery_fee
        save_order(
            order_id=sim_order_id,
            email=req.email,
            session_id=req.session_id,
            version=req.cart_version,
            total_price=final_total,
            delivery_city=req.delivery_city,
            recipient_name=req.recipient_name,
            categories=order_categories,
        )
        return {
            "success": True,
            "order_number": sim_order_id,
            "payment_url": sim_url,
            "total": final_total,
            "confirmed_total": final_total,
            "delivery_fee": delivery_fee,
            "delivery_option": req.delivery_option,
            "delivery_date": req.delivery_date,
            "currency": req.currency or "LKR",
            "formatted_message": "Simulated checkout — enable ALLOW_SIMULATED_CHECKOUT for development only.",
            "simulated": True,
        }
    finally:
        _active_checkouts.discard(lock_key)


@app.get("/healthz")
async def liveness():
    """Liveness probe — process is up. Does not touch external deps."""
    return {"status": "ok"}


@app.get("/api/version")
async def version():
    return {
        "name": settings.app_name,
        "version": settings.app_version,
        "environment": settings.environment,
    }


_health_cache: Dict[str, Any] = {"data": None, "ts": 0.0}
_HEALTH_TTL = 20.0  # don't probe the rate-limited MCP more than once per 20s


@app.get("/api/health")
async def health_check():
    """Readiness probe — smoke-tests the Kapruka MCP dependency (throttled)."""
    now = time.monotonic()
    if _health_cache["data"] and (now - _health_cache["ts"]) < _HEALTH_TTL:
        return _health_cache["data"]

    # Reuse the categories cache as a cheap liveness signal when it's warm,
    # avoiding an extra MCP round-trip on frequent health polls.
    mcp_ok = False
    mcp_detail = "unreachable"
    if _categories_cache["data"] and (now - _categories_cache["ts"]) < _CATEGORIES_TTL:
        mcp_ok = True
        mcp_detail = f"{len(_categories_cache['data'].get('categories', []))} categories (cached)"
    else:
        try:
            async with mcp_session() as session:
                raw = await call_tool(
                    session,
                    "kapruka_list_categories",
                    arguments={"params": {"depth": 1, "response_format": "json"}},
                )
                data = parse_json_response(raw)
                if data and data.get("categories"):
                    mcp_ok = True
                    mcp_detail = f"{len(data['categories'])} categories"
                    _categories_cache.update(data=data, ts=now)
        except Exception as exc:
            mcp_detail = str(exc)
            api_logger.warning("Health check MCP probe failed: %s", exc)

    result = {
        "status": "ok" if mcp_ok else "degraded",
        "version": settings.app_version,
        "mcp": {"ok": mcp_ok, "detail": mcp_detail, "url": settings.mcp_url},
        "intelligence": "mcp_native_planner",
    }
    _health_cache.update(data=result, ts=now)
    return result


# Short-lived search cache — same query within a minute serves from memory
# instead of re-hitting the rate-limited MCP (e.g. suggestion panels refiring).
_search_cache: Dict[str, Dict[str, Any]] = {}
_SEARCH_TTL = 60.0
_SEARCH_CACHE_MAX = 200


@app.get("/api/search")
async def search_catalog(q: str):
    q = (q or "").strip()[:120]
    if len(q) < 2:
        return {"results": []}

    now = time.monotonic()
    key = q.lower()
    hit = _search_cache.get(key)
    if hit and (now - hit["ts"]) < _SEARCH_TTL:
        return {"results": hit["results"]}

    products = await run_shopping_agent([q])

    if len(_search_cache) >= _SEARCH_CACHE_MAX:
        oldest = min(_search_cache, key=lambda k: _search_cache[k]["ts"])
        _search_cache.pop(oldest, None)
    _search_cache[key] = {"results": products, "ts": now}
    return {"results": products}


_FALLBACK_CATEGORIES = {
    "categories": [
        {"name": "Flowers", "url": "https://www.kapruka.com/shop/flowers"},
        {"name": "Cakes", "url": "https://www.kapruka.com/shop/cakes"},
        {"name": "Groceries", "url": "https://www.kapruka.com/shop/groceries"},
        {"name": "Chocolates", "url": "https://www.kapruka.com/shop/chocolates"},
        {"name": "Toys", "url": "https://www.kapruka.com/shop/toys"},
    ]
}
# Categories change rarely and the MCP rate-limits aggressively, so cache the
# result in-process to avoid hammering the endpoint on every page load.
_categories_cache: Dict[str, Any] = {"data": None, "ts": 0.0}
_CATEGORIES_TTL = 1800.0  # 30 minutes, matching the MCP's own cache window


@app.get("/api/categories")
async def get_categories():
    now = time.monotonic()
    if _categories_cache["data"] and (now - _categories_cache["ts"]) < _CATEGORIES_TTL:
        return _categories_cache["data"]

    categories_res = await call_mcp_tool_safe(
        "kapruka_list_categories",
        arguments={"params": {"depth": 1, "response_format": "json"}},
    )
    if categories_res:
        try:
            parsed = json.loads(categories_res)
            if parsed.get("categories"):
                _categories_cache.update(data=parsed, ts=now)
                return parsed
        except Exception as e:
            api_logger.warning("Could not parse MCP categories response: %s", e)

    # Serve a slightly stale cache before falling back to the static list.
    if _categories_cache["data"]:
        return _categories_cache["data"]
    if settings.allow_fallback_catalog:
        return _FALLBACK_CATEGORIES
    return {"categories": []}


# City prefixes are tiny and stable — cache them for the process lifetime.
_cities_cache: Dict[str, List[str]] = {}


@app.get("/api/cities")
async def autocomplete_cities(q: str):
    """Retrieve canonical city suggestions from Kapruka MCP."""
    q = (q or "").strip()[:60]
    if len(q) < 2:
        return {"cities": []}

    key = q.lower()
    if key in _cities_cache:
        return {"cities": _cities_cache[key]}

    cities_res = await call_mcp_tool_safe(
        "kapruka_list_delivery_cities",
        arguments={"params": {"query": q, "limit": 5, "response_format": "json"}},
    )
    names: List[str] = []
    if cities_res:
        try:
            data = json.loads(cities_res)
            names = [c.get("name") for c in data.get("cities", []) if c.get("name")]
        except json.JSONDecodeError:
            names = re.findall(r"\*\*(.*?)\*\*", cities_res)

    if names:
        if len(_cities_cache) > 500:
            _cities_cache.clear()
        _cities_cache[key] = names
    return {"cities": names}


@app.get("/api/session")
async def handle_session(session_id: str):
    versions = get_cart_versions(session_id)
    story = get_messages(session_id)
    story_list = get_story(session_id)
    prefs = get_user_preferences(session_id) or {}
    del_state = get_delivery_state(session_id)

    if not versions:
        raise HTTPException(
            status_code=404, detail="Session not found or has no active carts"
        )

    # Extract original user prompt from messages
    user_prompt = ""
    for msg in story:
        if msg["role"] == "user":
            user_prompt = msg["content"]
            break

    # Parse evolution JSON from prefs
    evolution_list = []
    if prefs.get("evolution"):
        try:
            evolution_list = json.loads(prefs["evolution"])
        except Exception:
            pass

    return {
        "session_id": session_id,
        "cart_versions": versions,
        "story": story_list or ["Restored active session."],
        "evolution": evolution_list,
        "metadata": {
            "intent_parsed": {**prefs, "query": user_prompt},
            "delivery_city": del_state.get("city")
            if del_state
            else (prefs.get("city") if prefs else "Colombo 01"),
            "delivery_fee": 300.0,
            "budget_limit": prefs.get("budget", 25000.0) if prefs else 25000.0,
        },
        "delivery_state": del_state,
    }


@app.post("/api/cart")
async def update_cart(req: UpdateCartRequest):
    # Retrieve existing story to avoid overwriting it with empty
    story = get_story(req.session_id)
    save_cart_versions(req.session_id, req.cart_versions, story)

    # Save updated evolution to user preferences
    if req.evolution is not None:
        prefs = get_user_preferences(req.session_id) or {}
        save_user_preferences(
            req.session_id,
            budget=prefs.get("budget", 25000.0),
            language=prefs.get("language", "en"),
            city=prefs.get("city", "Colombo 01"),
            delivery_speed=prefs.get("delivery_speed", "standard"),
            evolution=json.dumps(req.evolution),
        )
    return {"status": "ok"}


@app.post("/api/login")
async def login_user(req: LoginRequest):
    email = (req.email or "").strip().lower()
    if not email or not req.password:
        raise HTTPException(status_code=400, detail="Email and password are required")

    # Retrieve user or auto-register if not exists.
    user = get_user(email)
    if not user:
        create_user(email, req.name or "Guest User", req.password)
        user = get_user(email)
        api_logger.info("New user registered: %s", email)
    else:
        # User exists. If it's a signup attempt (name provided), notify them.
        if req.name:
            raise HTTPException(
                status_code=400,
                detail="This email is already registered. Please log in instead.",
            )
        if not verify_password(req.password, user["password"]):
            raise HTTPException(status_code=401, detail="Invalid email or password")

    return {
        "status": "ok",
        "user": {
            "email": user["email"],
            "name": user["name"],
        },
    }


@app.get("/api/profile/orders")
async def get_profile_orders(email: str):
    orders = get_user_orders(email)
    return {"orders": orders}


@app.post("/api/analytics")
async def handle_analytics(req: AnalyticsRequest):
    log_analytics(req.session_id, req.event_type, req.event_data)
    return {"status": "ok"}
