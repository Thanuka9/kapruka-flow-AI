"""Structured, UTF-8 safe logging setup for the Kapruka Flow API.

Windows consoles frequently use legacy code pages (cp1252) that crash when
emitting Sinhala / emoji characters. We force UTF-8 on the std streams and fall
back to ASCII-safe replacement so logging can never take down a request.
"""

from __future__ import annotations

import logging
import sys
from typing import Optional


def _reconfigure_stream(stream) -> None:
    if hasattr(stream, "reconfigure"):
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass


class SafeFormatter(logging.Formatter):
    """Formatter that never raises on un-encodable characters."""

    def format(self, record: logging.LogRecord) -> str:
        try:
            return super().format(record)
        except Exception:
            record.msg = str(record.msg).encode("ascii", "replace").decode("ascii")
            record.args = None
            return super().format(record)


_CONFIGURED = False


def setup_logging(level: str = "INFO") -> logging.Logger:
    global _CONFIGURED

    _reconfigure_stream(sys.stdout)
    _reconfigure_stream(sys.stderr)

    if not _CONFIGURED:
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(
            SafeFormatter(
                fmt="%(asctime)s | %(levelname)-7s | %(name)s | %(message)s",
                datefmt="%Y-%m-%dT%H:%M:%S",
            )
        )
        root = logging.getLogger()
        root.handlers.clear()
        root.addHandler(handler)
        root.setLevel(getattr(logging, level, logging.INFO))

        # Quiet noisy third-party loggers in production.
        logging.getLogger("httpx").setLevel(logging.WARNING)
        logging.getLogger("httpcore").setLevel(logging.WARNING)
        logging.getLogger("mcp").setLevel(logging.WARNING)

        _CONFIGURED = True

    return logging.getLogger("kapruka_flow")


def get_logger(name: Optional[str] = None) -> logging.Logger:
    base = "kapruka_flow"
    return logging.getLogger(f"{base}.{name}" if name else base)
