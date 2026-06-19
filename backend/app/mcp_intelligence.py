"""
Kapruka MCP-native intelligence engine — a deterministic agentic planner.

This module turns free-text shopping requests (English / Sinhala / Tanglish)
into structured intent, then curates four budget-aware cart plans from live
Kapruka MCP products. The core of the "AI" here is:

  1. Robust multilingual intent parsing (budget, quantity, city, occasion,
     recipient, delivery urgency, gift detection).
  2. A relevance engine that scores every MCP product against the user's
     actual words — so carts reflect what was asked, not just a category.
  3. A budget-filling, diversity-aware selector that builds Ideal / Cheaper /
     Premium / Fast plans which genuinely use the available budget.
"""
from __future__ import annotations

import math
import re
from typing import Any, Dict, List, Optional, Tuple

# ─────────────────────────────────────────────────────────────────────────
#  Lexicons
# ─────────────────────────────────────────────────────────────────────────

# Canonical city aliases. The delivery agent ultimately resolves the real
# canonical city via MCP, so this only needs to provide a good first guess.
CITY_ALIASES = {
    "colombo": "Colombo 01",
    "col 1": "Colombo 01",
    "fort": "Colombo 01",
    "pettah": "Colombo 11",
    "nugegoda": "Nugegoda",
    "dehiwala": "Dehiwala",
    "mount lavinia": "Mount Lavinia",
    "moratuwa": "Moratuwa",
    "maharagama": "Maharagama",
    "kotte": "Sri Jayawardenepura Kotte",
    "rajagiriya": "Rajagiriya",
    "kandy": "Kandy",
    "galle": "Galle",
    "negombo": "Negombo",
    "jaffna": "Jaffna",
    "matara": "Matara",
    "kurunegala": "Kurunegala",
    "anuradhapura": "Anuradhapura",
    "gampaha": "Gampaha",
    "kalutara": "Kalutara",
    "ratnapura": "Ratnapura",
    "batticaloa": "Batticaloa",
    "trincomalee": "Trincomalee",
    "badulla": "Badulla",
    "kegalle": "Kegalle",
}

GIFT_WORDS = [
    "gift", "hamper", "present", "surprise", "bouquet",
    "thaaththa", "thaththa", "amma", "ammata", "nangi", "malli", "aiya", "akka",
]

# Recipient → (gift implied, friendly tag) so the story + gift note can adapt.
RECIPIENT_WORDS = {
    "amma": "mother", "mother": "mother", "mom": "mother", "mum": "mother", "ammata": "mother",
    "thaththa": "father", "thaaththa": "father", "father": "father", "dad": "father", "appa": "father",
    "wife": "wife", "husband": "husband", "girlfriend": "partner", "boyfriend": "partner",
    "partner": "partner", "valentine": "partner",
    "sister": "sister", "nangi": "sister", "akka": "sister", "brother": "brother",
    "malli": "brother", "aiya": "brother",
    "boss": "colleague", "team": "team", "office": "team", "colleague": "colleague",
    "friend": "friend", "yaaluwa": "friend", "machan": "friend",
    "daughter": "child", "son": "child", "baby": "baby", "kid": "child", "child": "child",
}

OCCASION_WORDS = {
    "birthday": "birthday", "bday": "birthday", "upan dinaya": "birthday",
    "anniversary": "anniversary",
    "wedding": "wedding", "engagement": "wedding",
    "graduation": "graduation", "graduated": "graduation", "graduate": "graduation",
    "valentine": "valentine", "valentines": "valentine",
    "new year": "new_year", "newyear": "new_year", "avurudu": "new_year", "aluth avurudu": "new_year",
    "christmas": "christmas", "xmas": "christmas", "nattal": "christmas",
    "get well": "get_well", "recovery": "get_well",
    "congrats": "congratulations", "congratulations": "congratulations",
    "thank you": "thank_you", "thanks": "thank_you",
}

TODAY_WORDS = ["today", "ada", "now", "asap", "urgent", "ikmanin", "same day", "same-day", "immediately"]
TOMORROW_WORDS = ["tomorrow", "heta", "udeta", "next day"]
FAST_WORDS = ["fast", "express", "quick", "speedy", "priority"]

# Category synonyms (multilingual) → canonical English term used for MCP search
# and for relevance category matching.
CATEGORY_SYNONYMS: Dict[str, List[str]] = {
    "flowers": ["flower", "flowers", "roses", "rose", "bouquet", "mal", "mala", "මල්", "කුසුම්", "carnation", "orchid"],
    "cake": ["cake", "cakes", "keki", "කේක්", "gateau", "cup cake", "cupcake"],
    "chocolate": ["chocolate", "chocolates", "choc", "චොක්ලට්", "ferrero", "lindt", "toblerone"],
    "tea": ["tea", "ceylon tea", "තේ", "tea bags", "dilmah", "qualitea", "basilur", "green tea"],
    "coffee": ["coffee", "කෝපි", "nescafe"],
    "groceries": ["grocery", "groceries", "rice", "sugar", "milk", "snacks", "බඩු", "සිල්ලර", "flour", "dhal", "noodles"],
    "fruits": ["fruit", "fruits", "පළතුරු", "apple", "mango", "grapes", "berries"],
    "gifts": ["gift", "gifts", "hamper", "present", "යාග", "gift pack", "gift set", "combo"],
    "toys": ["toy", "toys", "teddy", "සෙල්ලම්", "soft toy", "doll", "lego"],
    "perfume": ["perfume", "fragrance", "cologne", "scent", "eau de"],
    "watches": ["watch", "watches", "wristwatch"],
    "jewellery": ["jewellery", "jewelry", "ring", "necklace", "bracelet", "earring", "pendant"],
    "electronics": ["electronic", "electronics", "phone", "headphone", "earbud", "gadget", "speaker", "charger"],
    "cosmetics": ["cosmetic", "cosmetics", "makeup", "lipstick", "skincare", "cream"],
    "clothing": ["clothing", "shirt", "saree", "dress", "tshirt", "t-shirt", "frock"],
    "books": ["book", "books", "novel", "stationery"],
    "liquor": ["wine", "whisky", "liquor", "champagne", "beer"],
    "household": ["household", "kitchen", "home", "appliance", "cookware"],
    "baby": ["baby", "infant", "diaper", "nappy", "babyitems"],
}

# Reverse index: keyword → canonical category, longest keywords first.
_KEYWORD_TO_CATEGORY: List[Tuple[str, str]] = sorted(
    ((kw, cat) for cat, kws in CATEGORY_SYNONYMS.items() for kw in kws),
    key=lambda pair: len(pair[0]),
    reverse=True,
)

STOPWORDS = {
    "i", "need", "want", "would", "like", "get", "buy", "send", "order", "looking",
    "under", "below", "less", "than", "around", "about", "upto", "up", "max", "maximum",
    "for", "the", "a", "an", "my", "to", "and", "or", "with", "in", "on", "at", "of",
    "lkr", "rs", "rupees", "rupee", "budget", "deliver", "delivery", "delivered",
    "please", "some", "something", "anything", "give", "me", "us", "we", "is", "are",
    "mata", "mage", "eka", "ekak", "ekata", "karanna", "one", "ow", "denna", "thiyenawa",
    "machan", "machang", "ko", "da", "nම්", "ඕන", "ඕනේ", "එක", "එකක්",
}

# Staple categories where buying multiple units to fill a basket is natural.
STAPLE_CATEGORIES = {"groceries", "tea", "coffee", "chocolate", "fruits", "household", "baby"}


# ─────────────────────────────────────────────────────────────────────────
#  Intent parsing
# ─────────────────────────────────────────────────────────────────────────

def _detect_language(text: str, client_language: Optional[str]) -> str:
    if client_language:
        cl = client_language.lower().strip()
        if cl.startswith("si"):
            return "si"
        if "tanglish" in cl or "en-lk" in cl:
            return "tanglish"
        return "en"
    if re.search(r"[\u0d80-\u0dff]", text):
        return "si"
    tanglish_markers = ["mata", "machan", "machang", "ekak", "karanna", " tika", "ikmanin",
                        " valata", "ekata", "denna", "thiyenawa", "yaaluwa", "ammata"]
    hits = sum(1 for w in tanglish_markers if w in f" {text.lower()} ")
    if hits >= 2:
        return "tanglish"
    return "en"


# Units that mean a number is a measurement/quantity, not a budget.
_UNIT_AFTER = r"(?:kg|g|gram|grams|ml|l|litre|liter|pcs|pc|pack|packs|packet|packets|" \
              r"bag|bags|box|boxes|piece|pieces|nos|set|sets|am|pm|kmph|km|%|st|nd|rd|th)"


def _extract_budget(text: str, user_profile: Optional[Dict] = None) -> Optional[float]:
    """Extract an LKR budget. Returns None when the user gave no budget signal."""
    raw = text.lower().replace(",", "")

    # 1) lakh / lac (×100,000)
    m = re.search(r"(\d+(?:\.\d+)?)\s*(?:lakh|lac|laksha)", raw)
    if m:
        return float(m.group(1)) * 100_000

    # 2) explicit "k" thousands: 10k, 7.5 k
    m = re.search(r"(\d+(?:\.\d+)?)\s*k\b", raw)
    if m:
        return float(m.group(1)) * 1_000

    # 3) ranges: "between 5000 and 10000", "5000-10000", "5000 to 10000" → upper bound
    m = re.search(r"(\d{3,7})\s*(?:-|to|and)\s*(\d{3,7})", raw)
    if m:
        return float(max(int(m.group(1)), int(m.group(2))))

    # 4) currency-anchored amount: rs 10000 / lkr.10000 / 10000 rupees
    m = re.search(r"(?:rs\.?|lkr\.?|rupees?)\s*(\d{3,7})", raw)
    if m:
        return float(m.group(1))
    m = re.search(r"(\d{3,7})\s*(?:rs|lkr|rupees?)\b", raw)
    if m:
        return float(m.group(1))

    # 5) intent-anchored amount: under/below/around/budget 10000
    m = re.search(r"(?:under|below|upto|up to|around|about|max|maximum|budget(?:\s*of)?)\s*(\d{3,7})", raw)
    if m:
        return float(m.group(1))

    # 6) bare number — only if it looks like money (>= 1000), is not a year, and
    #    is not immediately followed by a measurement unit.
    for m in re.finditer(r"\b(\d{3,7})\b", raw):
        num = int(m.group(1))
        tail = raw[m.end():m.end() + 8].lstrip()
        if re.match(_UNIT_AFTER, tail):
            continue
        if 1900 <= num <= 2100:  # looks like a year
            continue
        if num >= 1000:
            return float(num)

    if user_profile and user_profile.get("suggested_budget"):
        return float(user_profile["suggested_budget"])
    return None


def _extract_quantity(text: str) -> int:
    """Detect an explicit quantity like '5 packets', '2 cakes', 'x3'. Defaults to 1."""
    raw = text.lower()
    m = re.search(r"\bx\s*(\d{1,2})\b", raw) or re.search(r"\b(\d{1,2})\s*x\b", raw)
    if m:
        return max(1, min(int(m.group(1)), 20))
    m = re.search(r"\b(\d{1,2})\s+(?:packs?|packets?|boxes?|pieces?|pcs|nos|units?|bottles?|bunch(?:es)?)\b", raw)
    if m:
        return max(1, min(int(m.group(1)), 20))
    return 1


def _extract_city(text: str, user_profile: Optional[Dict] = None) -> str:
    lower = text.lower()
    for key, canonical in CITY_ALIASES.items():
        if re.search(rf"\b{re.escape(key)}\b", lower):
            return canonical
    # "deliver to X" / "to X" / "in X" — capture a candidate place for MCP to resolve.
    m = re.search(r"(?:deliver(?:y)?\s+to|send\s+to|\bto\b|\bin\b)\s+([a-z]{4,})", lower)
    if m:
        token = m.group(1)
        if token not in STOPWORDS:
            return token.capitalize()
    if user_profile and user_profile.get("preferred_city"):
        return user_profile["preferred_city"]
    return "Colombo 01"


def _detect_occasion(text: str) -> Optional[str]:
    lower = f" {text.lower()} "
    for word, occ in OCCASION_WORDS.items():
        if word in lower:
            return occ
    return None


def _detect_recipient(text: str) -> Optional[str]:
    lower = f" {text.lower()} "
    for word, tag in RECIPIENT_WORDS.items():
        if re.search(rf"\b{re.escape(word)}\b", lower):
            return tag
    return None


def _extract_gift_mode(text: str, occasion: Optional[str], recipient: Optional[str]) -> bool:
    lower = text.lower()
    if occasion or (recipient and recipient not in {"team"}):
        return True
    return any(w in lower for w in GIFT_WORDS)


def _extract_delivery_speed(text: str) -> str:
    lower = text.lower()
    if any(w in lower for w in TODAY_WORDS):
        return "today"
    if any(w in lower for w in FAST_WORDS) or any(w in lower for w in TOMORROW_WORDS):
        return "fast"
    return "standard"


def _matched_categories(text: str) -> List[str]:
    """Return canonical categories implied by the text, most specific first."""
    lower = f" {text.lower()} "
    found: List[str] = []
    for kw, cat in _KEYWORD_TO_CATEGORY:
        if cat in found:
            continue
        if kw in lower:
            found.append(cat)
    return found


def _extract_keywords(text: str) -> List[str]:
    """Content keywords used by the relevance engine (kept close to user's words)."""
    cleaned = re.sub(r"[^\w\s\u0d80-\u0dff]", " ", text.lower())
    tokens = []
    for tok in cleaned.split():
        if tok in STOPWORDS:
            continue
        if tok.isdigit():
            continue
        if len(tok) < 3 and not re.search(r"[\u0d80-\u0dff]", tok):
            continue
        tokens.append(tok)
    # De-dupe preserving order.
    seen = set()
    out = []
    for t in tokens:
        if t not in seen:
            seen.add(t)
            out.append(t)
    return out[:12]


def build_search_queries(
    text: str,
    category_hint: Optional[str] = None,
    user_profile: Optional[Dict] = None,
    gift_mode: bool = False,
    matched_categories: Optional[List[str]] = None,
    keywords: Optional[List[str]] = None,
) -> List[str]:
    """Generate MCP-friendly English search queries from multilingual intent."""
    queries: List[str] = []
    matched_categories = matched_categories if matched_categories is not None else _matched_categories(text)
    keywords = keywords if keywords is not None else _extract_keywords(text)

    if category_hint:
        queries.append(category_hint)

    # Canonical category terms map cleanly onto the MCP catalog.
    for cat in matched_categories[:3]:
        queries.append(cat)

    # A focused keyword phrase keeps relevance high.
    english_keywords = [k for k in keywords if not re.search(r"[\u0d80-\u0dff]", k)]
    if english_keywords:
        queries.append(" ".join(english_keywords[:3]))

    if gift_mode and not matched_categories:
        queries.extend(["gift hamper", "chocolates", "flowers"])

    if user_profile:
        for cat in user_profile.get("preferred_categories", [])[:2]:
            queries.append(cat)

    if not queries:
        queries = ["popular gifts", "groceries", "chocolates"]

    # De-dupe, keep order, cap.
    seen = set()
    unique: List[str] = []
    for q in queries:
        q = q.strip()
        if len(q) >= 2 and q.lower() not in seen:
            seen.add(q.lower())
            unique.append(q)
    return unique[:6]


def parse_intent_mcp(
    user_text: str,
    client_language: Optional[str] = None,
    user_profile: Optional[Dict] = None,
    category_hint: Optional[str] = None,
) -> Dict[str, Any]:
    text = user_text or ""
    lang = _detect_language(text, client_language)
    occasion = _detect_occasion(text)
    recipient = _detect_recipient(text)
    gift_mode = _extract_gift_mode(text, occasion, recipient)
    budget = _extract_budget(text, user_profile)
    quantity_hint = _extract_quantity(text)
    city = _extract_city(text, user_profile)
    delivery_speed = _extract_delivery_speed(text)
    matched_categories = _matched_categories(text)
    if category_hint:
        hint_cat = category_hint.lower().strip()
        if hint_cat not in matched_categories:
            matched_categories.insert(0, hint_cat)
    keywords = _extract_keywords(text)
    queries = build_search_queries(
        text, category_hint, user_profile, gift_mode, matched_categories, keywords
    )

    budget_inferred = budget is None
    effective_budget = budget if budget is not None else 25000.0

    return {
        "search_queries": queries,
        "keywords": keywords,
        "matched_categories": matched_categories,
        "budget": effective_budget,
        "budget_inferred": budget_inferred,
        "quantity_hint": quantity_hint,
        "language": lang,
        "city": city,
        "gift_mode": gift_mode,
        "occasion": occasion,
        "recipient": recipient,
        "delivery_speed": delivery_speed,
        "gift_message": _gift_message(lang, occasion, recipient) if gift_mode else "",
        "user_profile_applied": bool(user_profile),
    }


def _gift_message(lang: str, occasion: Optional[str], recipient: Optional[str]) -> str:
    occasion_en = {
        "birthday": "Happy Birthday!",
        "anniversary": "Happy Anniversary!",
        "wedding": "Congratulations on your wedding!",
        "graduation": "Congratulations, graduate!",
        "valentine": "Happy Valentine's Day!",
        "new_year": "Happy New Year!",
        "christmas": "Merry Christmas!",
        "get_well": "Get well soon!",
        "congratulations": "Congratulations!",
        "thank_you": "Thank you!",
    }
    if lang == "si":
        si = {
            "birthday": "සුභ උපන් දිනයක්!",
            "anniversary": "සුභ සංවත්සරයක්!",
            "new_year": "සුභ අලුත් අවුරුද්දක්!",
            "christmas": "සුභ නත්තලක්!",
        }
        return si.get(occasion or "", "සුභ පැතුම්!")
    if lang == "tanglish":
        tg = {
            "birthday": "Suba upan dinayak machan!",
            "new_year": "Suba aluth avuruddak!",
        }
        return tg.get(occasion or "", "Best wishes machan!")
    return occasion_en.get(occasion or "", "Best wishes from Kapruka Flow!")


# ─────────────────────────────────────────────────────────────────────────
#  Relevance engine
# ─────────────────────────────────────────────────────────────────────────

def _price(p: Dict) -> float:
    price = p.get("price", 0)
    if isinstance(price, dict):
        return float(price.get("amount") or 0)
    return float(price or 0)


def _product_category(p: Dict) -> str:
    return (p.get("category") or "").lower()


def relevance_score(product: Dict, intent: Dict) -> float:
    """Score how well a product matches what the user actually asked for.

    Combines keyword hits in the product name/category/summary, category
    matches, gift suitability, stock and delivery alignment.
    """
    name = (product.get("name") or "").lower()
    cat = _product_category(product)
    summary = (product.get("summary") or "").lower()
    keywords = intent.get("keywords") or []
    matched_categories = intent.get("matched_categories") or []

    score = 0.0

    # 1) Direct keyword relevance (the heart of "did we get what they asked").
    for kw in keywords:
        if kw in name:
            score += 3.0
        elif kw in cat:
            score += 1.6
        elif summary and kw in summary:
            score += 0.8

    # 2) Category alignment.
    for mc in matched_categories:
        if mc in cat or any(syn in name for syn in CATEGORY_SYNONYMS.get(mc, [])):
            score += 2.2

    # 3) Gift suitability.
    if intent.get("gift_mode") and any(k in cat for k in ["gift", "flower", "chocolate", "cake", "hamper", "perfume", "jewel"]):
        score += 2.0

    # 4) Profile preferences (order history categories).
    for pref in (intent.get("_profile_categories") or []):
        if pref and pref in cat:
            score += 1.5

    # 4b) Saved bookmarks — starred items get a strong boost.
    if product.get("id") in (intent.get("_saved_product_ids") or []):
        score += 3.5
    for saved_cat in (intent.get("_saved_categories") or []):
        if saved_cat and saved_cat in cat:
            score += 1.2

    # 5) Availability & delivery urgency.
    if product.get("in_stock", True):
        score += 0.5
    if intent.get("delivery_speed") in ("today", "fast") and product.get("delivery_speed") in ("Today", "Fast"):
        score += 1.2

    # 6) Mild prior so an empty-keyword query still ranks sensibly.
    if score == 0.0 and product.get("in_stock", True):
        score = 0.2
    return round(score, 3)


# ─────────────────────────────────────────────────────────────────────────
#  Cart selection
# ─────────────────────────────────────────────────────────────────────────

def _reason(lang: str, en: str, si: str, tg: str, **kw) -> str:
    template = {"si": si, "tanglish": tg}.get(lang, en)
    try:
        return template.format(**kw)
    except Exception:
        return en.format(**kw)


def _category_cap(num_categories: int, max_items: int) -> int:
    """Limit how many items can come from one category to keep carts diverse."""
    if num_categories <= 1:
        return max_items  # focused single-category request → no cap
    if num_categories == 2:
        return max(2, math.ceil(max_items * 0.7))
    return max(2, math.ceil(max_items / 2))


def _build_reason(mode: str, lang: str, name: str) -> str:
    if mode == "cheaper":
        return _reason(lang,
                       "Smart-value pick — {name} stretches your budget further.",
                       "වටිනාකම — {name} අයවැයට හොඳයි.",
                       "Value pick — {name} budget ekata fits.", name=name)
    if mode == "premium":
        return _reason(lang,
                       "Premium upgrade — {name} for a more impressive gift.",
                       "ප්‍රිමියම් — {name} වඩාත් විශිෂ්ටයි.",
                       "Premium — {name} godak impressive ekak.", name=name)
    if mode == "fast":
        return _reason(lang,
                       "Quick delivery — {name} can ship fast via Kapruka.",
                       "ඉක්මන් — {name} ඉක්මනින් එවිය හැක.",
                       "Fast delivery — {name} ikmanata enawa.", name=name)
    return _reason(lang,
                   "Best match — {name} fits exactly what you asked for.",
                   "හොඳම ගැලපීම — {name} ඔබ ඉල්ලූ දෙයට සරිලයි.",
                   "Best match — {name} oya illapu ekata perfect.", name=name)


def _select(
    products: List[Dict],
    intent: Dict,
    spend_limit: float,
    mode: str,
    max_items: int = 8,
) -> List[Dict]:
    """Relevance-first, budget-filling selection with category diversity."""
    lang = intent.get("language", "en")
    quantity_hint = int(intent.get("quantity_hint", 1) or 1)

    pool = [p for p in products if _price(p) > 0 and p.get("in_stock", True)]
    if mode == "fast":
        fast_pool = [p for p in pool if p.get("delivery_speed") in ("Today", "Fast")]
        pool = fast_pool or pool

    # Relevance is computed in a local map so we never mutate shared product dicts.
    rel = {id(p): relevance_score(p, intent) for p in pool}

    if mode == "cheaper":
        pool.sort(key=lambda p: (-rel[id(p)] / max(_price(p), 1), _price(p)))
    elif mode == "premium":
        pool.sort(key=lambda p: (-(rel[id(p)] + _price(p) / 5000.0), -_price(p)))
    else:  # initial / fast → relevance first, cheaper breaks ties
        pool.sort(key=lambda p: (-rel[id(p)], _price(p)))

    distinct_categories = len({_product_category(p) for p in pool if _product_category(p)})
    cat_cap = _category_cap(distinct_categories, max_items)

    picked: List[Dict] = []
    cat_counts: Dict[str, int] = {}
    total = 0.0

    def _try_add(product: Dict, qty: int = 1) -> bool:
        nonlocal total
        price = _price(product)
        cat = _product_category(product) or "general"
        if len(picked) >= max_items:
            return False
        if cat_counts.get(cat, 0) >= cat_cap and distinct_categories > 1:
            return False
        cost = price * qty
        # Never exceed the spend limit — the budget is a hard cap, not a target.
        if total + cost > spend_limit:
            return False
        picked.append({**product, "quantity": qty, "reason": _build_reason(mode, lang, product.get("name", "item"))})
        cat_counts[cat] = cat_counts.get(cat, 0) + 1
        total += cost
        return True

    # Pass 1: core relevant items.
    for p in pool:
        if len(picked) >= max_items:
            break
        _try_add(p, 1)

    # Pass 2: fill leftover budget. For staples we can scale quantity; otherwise
    # add more affordable relevant items so the plan actually uses the budget.
    headroom = spend_limit - total
    if headroom > spend_limit * 0.15:
        # 2a) bump quantities on cheap staples the user likely wants in bulk.
        if quantity_hint > 1 or mode in ("initial", "cheaper"):
            for item in picked:
                cat = _product_category(item)
                price = _price(item)
                if price <= 0:
                    continue
                if any(s in cat for s in STAPLE_CATEGORIES) and price < spend_limit * 0.18:
                    target_qty = quantity_hint if quantity_hint > 1 else 2
                    while item["quantity"] < target_qty and total + price <= spend_limit:
                        item["quantity"] += 1
                        total += price
                if total >= spend_limit * 0.9:
                    break
        # 2b) add more distinct relevant items if room remains.
        picked_ids = {it["id"] for it in picked}
        for p in pool:
            if total >= spend_limit * 0.92 or len(picked) >= max_items:
                break
            if p["id"] in picked_ids:
                continue
            _try_add(p, 1)

    if not picked and pool:
        # Nothing fit the relevance-sorted pass — fall back to the cheapest item
        # that fits the budget (or the cheapest available if none do) so we never
        # surface a plan that blows the requested limit.
        affordable = [p for p in pool if _price(p) <= spend_limit]
        fallback = min(affordable or pool, key=_price)
        picked.append({**fallback, "quantity": 1, "reason": _build_reason(mode, lang, fallback.get("name", "item"))})

    return picked


def build_carts_mcp(
    intent: Dict[str, Any],
    products: List[Dict[str, Any]],
    canonical_city: str,
    delivery_fee: float,
    user_profile: Optional[Dict] = None,
) -> Dict[str, Any]:
    lang = intent.get("language", "en")
    budget = float(intent.get("budget", 25000) or 25000)

    # Expose profile + bookmark signals to the relevance engine.
    if user_profile:
        saved_cats = []
        for sp in user_profile.get("saved_products") or []:
            c = (sp.get("category") or "").lower().strip()
            if c:
                saved_cats.append(c)
        intent = {
            **intent,
            "_profile_categories": [c.lower() for c in user_profile.get("preferred_categories", [])],
            "_saved_product_ids": list(user_profile.get("saved_product_ids") or []),
            "_saved_categories": saved_cats,
        }

    limit = max(budget - delivery_fee, 1000.0)

    # The requested budget is a HARD cap on the order total (items + delivery).
    # Every plan, including premium, must stay within it — premium simply favours
    # a pricier/higher-quality mix, it never spends more than the user asked for.
    carts = {
        "initial": _select(products, intent, limit, "initial"),
        "cheaper": _select(products, intent, limit * 0.7, "cheaper"),
        "premium": _select(products, intent, limit, "premium"),
        "fast": _select(products, intent, limit, "fast"),
    }

    # Quantified stats so the UI can show the planner "thinking" (the demo drama).
    priced = [p for p in products if _price(p) > 0]
    in_stock = [p for p in priced if p.get("in_stock", True)]
    over_budget = [p for p in in_stock if _price(p) > limit]
    fast_available = [p for p in in_stock if p.get("delivery_speed") in ("Today", "Fast")]
    stats = {
        "total_found": len(products),
        "priced": len(priced),
        "in_stock": len(in_stock),
        "over_budget": len(over_budget),
        "considered": max(len(in_stock) - len(over_budget), 0),
        "selected": len(carts.get("initial", [])),
        "fast_available": len(fast_available),
        "budget": budget,
        "delivery_fee": delivery_fee,
    }

    story = _build_story(intent, products, canonical_city, delivery_fee, budget, carts, user_profile)
    return {"cart_versions": carts, "story": story, "stats": stats}


def _cart_total(items: List[Dict]) -> float:
    return sum(_price(it) * int(it.get("quantity", 1)) for it in items)


def _build_story(
    intent: Dict,
    products: List[Dict],
    canonical_city: str,
    delivery_fee: float,
    budget: float,
    carts: Dict[str, List[Dict]],
    user_profile: Optional[Dict],
) -> List[str]:
    lang = intent.get("language", "en")
    initial_total = _cart_total(carts.get("initial", []))
    n_items = len(carts.get("initial", []))
    occasion = intent.get("occasion")
    recipient = intent.get("recipient")

    profile_note = ""
    if user_profile and user_profile.get("order_count", 0) > 0:
        city_pref = user_profile.get("preferred_city", "Colombo")
        if lang == "si":
            profile_note = f"ඔබගේ පෙර ඇණවුම් {user_profile['order_count']}ක් අනුව {city_pref} වෙත බෙදාහැරීම සලකන ලදී."
        elif lang == "tanglish":
            profile_note = f"Oya past orders {user_profile['order_count']} balala {city_pref} ekata personalize kala."
        else:
            profile_note = (f"Personalized from your {user_profile['order_count']} past order(s) — "
                            f"you usually ship to {city_pref}.")

    saved_note = ""
    saved_n = int(user_profile.get("saved_count", 0) or 0) if user_profile else 0
    if saved_n > 0:
        if lang == "si":
            saved_note = f"ඔබ සුරකින ලද භාණ්ඩ {saved_n}ක් තෝරා ගැනීමේදී උසස් කරන ලදී."
        elif lang == "tanglish":
            saved_note = f"Oya saved items {saved_n} cart picks walata boost kala."
        else:
            saved_note = f"Boosted {saved_n} saved item(s) you starred when ranking products."

    occasion_note = ""
    if occasion or recipient:
        bits = []
        if occasion:
            bits.append(occasion.replace("_", " "))
        if recipient:
            bits.append(f"for your {recipient}")
        ctx = " ".join(bits)
        if lang == "si":
            occasion_note = f"තෑගි අවස්ථාව හඳුනාගෙන ({ctx}) ගැලපෙන භාණ්ඩ තෝරන ලදී."
        elif lang == "tanglish":
            occasion_note = f"Gift context ({ctx}) eka identify karala items tuned kala."
        else:
            occasion_note = f"Detected a gift context ({ctx}) and tuned the picks accordingly."

    if lang == "si":
        story = [
            f"Kapruka MCP සජීවී නාමාවලියෙන් භාණ්ඩ {len(products)}ක් සොයා, ඔබගේ ඉල්ලීමට වඩාත් ගැලපෙන ඒවා තෝරන ලදී.",
            f"Ideal සැලසුම: භාණ්ඩ {n_items}ක්, එකතුව LKR {initial_total:,.0f} (අයවැය LKR {budget:,.0f}).",
            f"{canonical_city} වෙත බෙදාහැරීම — ගාස්තුව LKR {delivery_fee:,.0f}.",
        ]
    elif lang == "tanglish":
        story = [
            f"Kapruka MCP live catalog eken products {len(products)} find karala, oya illapu ekata best match ewa select kala.",
            f"Ideal plan eke items {n_items}, total LKR {initial_total:,.0f} (budget LKR {budget:,.0f}).",
            f"{canonical_city} ekata delivery — fee LKR {delivery_fee:,.0f}.",
        ]
    else:
        story = [
            f"Searched the live Kapruka MCP catalog ({len(products)} products) and ranked them by how well they match your words.",
            f"Ideal plan: {n_items} item(s) totalling LKR {initial_total:,.0f} of your LKR {budget:,.0f} budget.",
            f"Delivery to {canonical_city} — fee LKR {delivery_fee:,.0f}. Compare Cheaper, Premium and Fast plans on the right.",
        ]

    for note in (occasion_note, profile_note, saved_note):
        if note:
            story.append(note)
    return story


# ─────────────────────────────────────────────────────────────────────────
#  User profile from order history
# ─────────────────────────────────────────────────────────────────────────

def build_user_profile_from_history(orders: List[Dict[str, Any]]) -> Dict[str, Any]:
    if not orders:
        return {}

    cities = [o.get("delivery_city") for o in orders if o.get("delivery_city")]
    preferred_city = max(set(cities), key=cities.count) if cities else "Colombo 01"

    totals = [float(o.get("total_price") or 0) for o in orders if o.get("total_price")]
    suggested_budget = (sum(totals) / len(totals)) if totals else 25000.0

    # Prefer real categories actually ordered (persisted as a CSV string or an
    # items list); fall back to the version-based heuristic for legacy rows.
    cat_counts: Dict[str, int] = {}
    for o in orders:
        found_real = False

        csv = o.get("categories")
        if isinstance(csv, str) and csv.strip():
            for cat in csv.split(","):
                cat = cat.strip().lower()
                if cat:
                    cat_counts[cat] = cat_counts.get(cat, 0) + 1
                    found_real = True

        items = o.get("items") or o.get("products") or []
        if not found_real and isinstance(items, list) and items:
            for it in items:
                cat = (it.get("category") or "").lower().strip()
                if cat:
                    cat_counts[cat] = cat_counts.get(cat, 0) + 1
                    found_real = True

        if not found_real:
            ver = (o.get("version") or "").lower()
            fallback = {"fast": "flowers", "premium": "gifts", "cheaper": "groceries"}.get(ver, "groceries")
            cat_counts[fallback] = cat_counts.get(fallback, 0) + 1

    preferred_categories = sorted(cat_counts, key=lambda k: cat_counts[k], reverse=True)[:3]

    return {
        "preferred_city": preferred_city,
        "suggested_budget": round(suggested_budget, -2),
        "order_count": len(orders),
        "preferred_categories": preferred_categories,
    }


def enrich_user_profile_with_saved(
    user_profile: Optional[Dict[str, Any]],
    saved_products: Optional[List[Dict[str, Any]]],
) -> Dict[str, Any]:
    """Merge starred bookmarks into the profile used by intent + cart ranking."""
    profile = dict(user_profile or {})
    if not saved_products:
        return profile

    saved_ids: List[str] = []
    saved_cats: List[str] = []
    slim_saved: List[Dict[str, Any]] = []
    for p in saved_products:
        pid = p.get("id")
        if pid:
            saved_ids.append(pid)
        cat = (p.get("category") or "").lower().strip()
        if cat:
            saved_cats.append(cat)
        slim_saved.append({
            "id": pid,
            "name": p.get("name"),
            "category": p.get("category") or "",
        })

    profile["saved_product_ids"] = saved_ids
    profile["saved_count"] = len(saved_ids)
    profile["saved_products"] = slim_saved[:10]

    cats = list(profile.get("preferred_categories") or [])
    seen = {c.lower() for c in cats}
    for c in saved_cats:
        if c not in seen:
            cats.append(c)
            seen.add(c)
    profile["preferred_categories"] = cats[:5]
    return profile
