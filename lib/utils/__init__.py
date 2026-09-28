"""Shared helpers for lib/ scripts. Re-exports the public API of each submodule.

`.term` (logging/colors) is stdlib-only and always importable. The other
submodules need `requests`/`yaml`; some CI jobs install no extra deps, so those
imports are skipped there, letting `setup_logging()` work without them.
"""

from .term import make_colors, setup_logging

try:
    from .api import (
        degoogled_status,
        enrich_get,
        fetch_android_app,
        fetch_ios,
        fetch_privacy,
        fetch_security_report,
        ios_app_id,
        ios_days_since_update,
        ios_rating,
        privacy_grade,
        tracker_count,
        unpatched_advisories,
    )
    from .data import DATA_PATH, PROJECT_ROOT, iter_services, load_yaml, slugify
    from .github import (
        AI_BOT_AUTHORS,
        commit_has_bot,
        fetch_repo,
        gh_get,
        parse_github_field,
        repo_age_days,
        repo_has_license,
        repo_is_archived,
        repo_is_fork,
        repo_pushed_days_ago,
        repo_status,
    )
    from .http import DEFAULT_TIMEOUT, DEFAULT_USER_AGENT, check_url, make_session
except ImportError as exc:
    if exc.name not in ("requests", "yaml"):
        raise

__all__ = [
    "AI_BOT_AUTHORS",
    "DATA_PATH",
    "DEFAULT_TIMEOUT",
    "DEFAULT_USER_AGENT",
    "PROJECT_ROOT",
    "check_url",
    "commit_has_bot",
    "degoogled_status",
    "enrich_get",
    "fetch_android_app",
    "fetch_ios",
    "fetch_privacy",
    "fetch_repo",
    "fetch_security_report",
    "gh_get",
    "ios_app_id",
    "ios_days_since_update",
    "ios_rating",
    "privacy_grade",
    "iter_services",
    "load_yaml",
    "make_colors",
    "make_session",
    "parse_github_field",
    "repo_age_days",
    "repo_has_license",
    "repo_is_archived",
    "repo_is_fork",
    "repo_pushed_days_ago",
    "repo_status",
    "setup_logging",
    "slugify",
    "tracker_count",
    "unpatched_advisories",
]
