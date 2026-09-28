"""ANSI colors and logging configuration."""

import logging
import os
import sys

_COLOR_CODES = {"red": 31, "green": 32, "yellow": 33, "blue": 34, "cyan": 36, "bold": 1, "dim": 2}

_LEVEL_COLORS = {
    "DEBUG": _COLOR_CODES["dim"],
    "INFO": _COLOR_CODES["cyan"],
    "WARNING": _COLOR_CODES["yellow"],
    "ERROR": _COLOR_CODES["red"],
    "CRITICAL": _COLOR_CODES["red"],
}


def _color_enabled(stream=None):
    """Decide whether ANSI colors should be emitted (respects NO_COLOR, enables in CI)."""
    if os.environ.get("NO_COLOR"):
        return False
    if os.environ.get("FORCE_COLOR") or os.environ.get("GITHUB_ACTIONS") or os.environ.get("CI"):
        return True
    stream = stream or sys.stderr
    return bool(getattr(stream, "isatty", lambda: False)())


def _paint(text, code):
    return f"\033[{code}m{text}\033[0m"


class _ColorFormatter(logging.Formatter):
    """Renders records as `LEVEL [file] message`, colored by level when enabled."""

    def __init__(self, color):
        super().__init__()
        self.color = color

    def format(self, record):
        level = f"{record.levelname:<7}"
        location = f"[{record.filename}]"
        message = record.getMessage()
        if self.color:
            level = _paint(level, _LEVEL_COLORS.get(record.levelname, 0))
            location = _paint(location, _COLOR_CODES["dim"])
        text = f"{level} {location} {message}"
        if record.exc_info:
            text += "\n" + self.formatException(record.exc_info)
        return text


def setup_logging(level="INFO"):
    handler = logging.StreamHandler(sys.stderr)
    handler.setFormatter(_ColorFormatter(_color_enabled()))
    logging.basicConfig(
        level=getattr(logging, str(level).upper(), logging.INFO),
        handlers=[handler],
        force=True,
    )


def make_colors(enabled=None):
    """Return {name: callable(str) -> str}; no-ops when colors disabled."""
    if enabled is None:
        enabled = _color_enabled()
    if not enabled:
        return {name: (lambda s: s) for name in _COLOR_CODES}
    return {name: (lambda s, c=code: f"\033[{c}m{s}\033[0m") for name, code in _COLOR_CODES.items()}
