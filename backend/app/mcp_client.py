"""Resilient client helpers for the Kapruka MCP endpoint.

Adds bounded timeouts and retry-with-backoff around the streamable HTTP
transport so transient network blips don't fail an entire shopping pipeline.
"""

import asyncio
import json
from contextlib import asynccontextmanager
from typing import Any, Dict, List, Optional

from mcp import ClientSession
from mcp.client.streamable_http import streamable_http_client

from .config import settings
from .logging_config import get_logger

logger = get_logger("mcp_client")

MCP_URL = settings.mcp_url


@asynccontextmanager
async def mcp_session():
    """Reuse one MCP HTTP session for an entire agent pipeline run."""
    async with streamable_http_client(url=MCP_URL) as (
        read_stream,
        write_stream,
        _get_session_id,
    ):
        async with ClientSession(read_stream, write_stream) as session:
            await session.initialize()
            yield session


async def call_tool(
    session: ClientSession, tool_name: str, arguments: Dict[str, Any]
) -> Optional[str]:
    """Call an MCP tool on an existing session with a bounded timeout + retries."""
    attempts = max(1, settings.mcp_max_retries + 1)
    last_error: Optional[Exception] = None

    for attempt in range(1, attempts + 1):
        try:
            result = await asyncio.wait_for(
                session.call_tool(tool_name, arguments=arguments),
                timeout=settings.mcp_timeout,
            )
            if result and result.content:
                return result.content[0].text
            return None
        except asyncio.TimeoutError as exc:
            last_error = exc
            logger.warning(
                "MCP tool %s timed out (attempt %d/%d)", tool_name, attempt, attempts
            )
        except Exception as exc:
            last_error = exc
            logger.warning(
                "MCP tool %s failed (attempt %d/%d): %s",
                tool_name,
                attempt,
                attempts,
                exc,
            )

        if attempt < attempts:
            await asyncio.sleep(settings.mcp_retry_backoff * attempt)

    logger.error("MCP tool %s exhausted retries: %s", tool_name, last_error)
    return None


async def call_mcp_tool_safe(
    tool_name: str, arguments: Dict[str, Any]
) -> Optional[str]:
    """Standalone MCP call for one-off API routes (categories, cities, checkout).

    Opens a fresh session and retries the whole exchange (including connection
    setup) so a dropped connection between requests is recovered transparently.
    """
    attempts = max(1, settings.mcp_max_retries + 1)
    last_error: Optional[Exception] = None

    for attempt in range(1, attempts + 1):
        try:
            async with mcp_session() as session:
                return await call_tool(session, tool_name, arguments)
        except Exception as exc:
            last_error = exc
            logger.warning(
                "MCP session for %s failed (attempt %d/%d): %s",
                tool_name,
                attempt,
                attempts,
                exc,
            )
            if attempt < attempts:
                await asyncio.sleep(settings.mcp_retry_backoff * attempt)

    logger.error("MCP session for %s exhausted retries: %s", tool_name, last_error)
    return None


def parse_json_response(raw: Optional[str]) -> Optional[Dict[str, Any]]:
    if not raw:
        return None
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return None


def emit_event(
    events: List[Dict[str, Any]],
    step: str,
    message: str,
    tool: Optional[str] = None,
    detail: Optional[Any] = None,
) -> None:
    events.append(
        {
            "step": step,
            "message": message,
            "tool": tool,
            "detail": detail,
        }
    )
