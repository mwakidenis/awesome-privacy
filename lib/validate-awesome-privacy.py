import json
import logging
import os
import sys

import yaml
from jsonschema import Draft7Validator

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import utils

utils.setup_logging()
logger = logging.getLogger(__name__)

# Paths (relative to project root)
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_PATH = os.path.join(PROJECT_ROOT, "awesome-privacy.yml")
SCHEMA_PATH = os.path.join(PROJECT_ROOT, "lib/schema.json")
ERRORS_OUTPUT_PATH = "/tmp/schema-errors.json"

# Exit codes
EXIT_VALID = 0
EXIT_VALIDATION_ERRORS = 1
EXIT_RUNTIME_ERROR = 2

MAX_ERRORS = 20


def _clean(v):
    """Stringify a value for inline display: neutralise backticks, collapse newlines."""
    return str(v).replace("`", "'").replace("\n", " ").replace("\r", " ").strip()


def resolve_path(data, path_parts):
    """Walk the data along path_parts, replacing indices with 'name' values."""
    segments = []
    current = data
    for part in path_parts:
        if isinstance(current, dict) and part in current:
            current = current[part]
            if isinstance(current, dict) and "name" in current:
                segments.append(_clean(current["name"]))
            elif not isinstance(current, (dict, list)):
                segments.append(_clean(part))
        elif isinstance(current, list) and isinstance(part, int) and part < len(current):
            current = current[part]
            if isinstance(current, dict) and "name" in current:
                segments.append(_clean(current["name"]))
            else:
                segments.append(_clean(part))
        else:
            segments.append(_clean(part))
            break
    return " > ".join(segments) if segments else "(root)"


FIELD_HINTS = {
    "url": "must start with http:// or https://",
    "icon": "must start with http:// or https://",
    "github": "must be `user/repo`",
    "codeberg": "must be `user/repo`",
    "git": "must be a full http(s):// URL to the source repository",
    "iosApp": "must be a full https://apps.apple.com/... URL",
    "androidApp": "must be a package name like `com.example.app`",
    "discordInvite": "must be a discord invite code or https://discord.gg/... URL",
    "subreddit": "must be an alphanumeric subreddit name (no `/r/` prefix)",
}


def _q(v):
    """As _clean but truncates long values for use inside inline `…` displays."""
    s = _clean(v)
    return s if len(s) <= 80 else s[:77] + "..."


def _quoted(s):
    """Extract all 'single-quoted' tokens from a string."""
    parts = s.split("'")
    return parts[1::2]


def format_yaml_error(exc):
    """Build a human-readable YAML error message, including line/column when available."""
    mark = getattr(exc, "problem_mark", None) or getattr(exc, "context_mark", None)
    problem = (getattr(exc, "problem", None) or "").strip()
    where = f" at line {mark.line + 1}, column {mark.column + 1}" if mark else ""
    return f"YAML syntax error{where}: {problem}" if problem else f"YAML syntax error{where}"


def humanize_error(error, location):
    """Render a jsonschema ValidationError as a single short, human-readable line."""
    v = error.validator
    raw = error.message
    field = error.path[-1] if error.path and isinstance(error.path[-1], str) else None

    if v == "required":
        missing = (_quoted(raw) or ["?"])[0]
        return f"{location}: missing required field `{missing}`"
    if v == "additionalProperties":
        extras = _quoted(raw) or ["?"]
        joined = ", ".join(f"`{e}`" for e in extras)
        return f"{location}: unknown field(s) {joined}"
    if v == "type":
        types = error.validator_value
        types_s = " or ".join(types) if isinstance(types, list) else str(types)
        return f"{location}: expected {types_s} (got `{_q(error.instance)}`)"
    if v == "minLength":
        return f"{location}: too short ({len(error.instance)} chars, minimum {error.validator_value})"
    if v == "maxLength":
        return f"{location}: too long ({len(error.instance)} chars, maximum {error.validator_value})"
    if v == "minimum":
        return f"{location}: value `{_q(error.instance)}` is below minimum {error.validator_value}"
    if v in ("pattern", "anyOf", "oneOf"):
        hint = FIELD_HINTS.get(field) if field else None
        suffix = f" — {hint}" if hint else ""
        return f"{location}: invalid value `{_q(error.instance)}`{suffix}"
    return f"{location}: {raw}"


def write_errors_file(messages):
    """Persist error messages to a known location so downstream tools can surface them."""
    try:
        with open(ERRORS_OUTPUT_PATH, "w") as f:
            json.dump(list(messages), f)
    except OSError:
        pass


def clear_errors_file():
    """Remove any stale errors file from a previous run."""
    try:
        os.remove(ERRORS_OUTPUT_PATH)
    except OSError:
        pass


def load_yaml(path):
    try:
        with open(path, "r") as f:
            return yaml.safe_load(f)
    except FileNotFoundError:
        logger.error("File not found: %s", path)
        sys.exit(EXIT_RUNTIME_ERROR)
    except yaml.YAMLError as e:
        msg = format_yaml_error(e)
        write_errors_file([msg])
        logger.error("Failed to parse YAML: %s", msg)
        sys.exit(EXIT_RUNTIME_ERROR)


def load_schema(path):
    try:
        with open(path, "r") as f:
            return json.load(f)
    except FileNotFoundError:
        logger.error("File not found: %s", path)
        sys.exit(EXIT_RUNTIME_ERROR)
    except json.JSONDecodeError as e:
        logger.error("Failed to parse JSON schema: %s", e)
        sys.exit(EXIT_RUNTIME_ERROR)


def validate(data, schema):
    validator = Draft7Validator(schema)
    errors = sorted(validator.iter_errors(data), key=lambda e: list(e.path))
    formatted = []
    for error in errors:
        location = resolve_path(data, list(error.path))
        formatted.append(humanize_error(error, location))
    return formatted


def main():
    logger.info("Validating awesome-privacy.yml against schema")
    data = load_yaml(DATA_PATH)
    schema = load_schema(SCHEMA_PATH)
    errors = validate(data, schema)

    if errors:
        write_errors_file(errors)
        shown = errors[:MAX_ERRORS]
        for msg in shown:
            logger.error(msg)
        if len(errors) > MAX_ERRORS:
            logger.warning("...and %d more", len(errors) - MAX_ERRORS)
        logger.error("Validation failed: %d error(s)", len(errors))
        sys.exit(EXIT_VALIDATION_ERRORS)

    # Gather stats
    categories = data.get("categories", [])
    num_categories = len(categories)
    num_sections = sum(len(c.get("sections", [])) for c in categories)
    num_services = sum(
        len(s.get("services", []))
        for c in categories
        for s in c.get("sections", [])
    )
    clear_errors_file()
    logger.info("Valid! %d categories, %d sections, %d services",
                num_categories, num_sections, num_services)
    sys.exit(EXIT_VALID)


if __name__ == "__main__":
    main()
