"""GitHub API helpers and read-only accessors for repo metadata."""

import logging
from datetime import datetime, timezone

import requests

from .http import DEFAULT_TIMEOUT, make_session

AI_BOT_AUTHORS = [
    "noreply@anthropic.com",
    "devin-ai-integration[bot]",
    "copilot-swe-agent.github.com",
    "noreply@cursor.com",
]


def parse_github_field(value):
    """Parse a `github` field into (owner, repo), or (None, None) on failure."""
    if not value:
        return None, None
    if value.startswith("https://github.com/"):
        parts = value.removeprefix("https://github.com/").strip("/").split("/")
        if len(parts) >= 2 and parts[0] and parts[1]:
            return parts[0], parts[1]
        return None, None
    if "/" in value:
        parts = value.split("/")
        if len(parts) == 2 and parts[0] and parts[1]:
            return parts[0], parts[1]
    return None, None


def gh_get(path, token, session=None, params=None, timeout=DEFAULT_TIMEOUT, label=""):
    """GET https://api.github.com{path}. Returns parsed JSON on 200, else None.

    Catches any exception raised during the request or JSON decode, so callers
    can treat None as a generic failure signal without needing their own guard.
    """
    session = session or make_session()
    headers = {"Accept": "application/vnd.github.v3+json"}
    if token:
        headers["Authorization"] = f"token {token}"
    try:
        resp = session.get(
            f"https://api.github.com{path}",
            headers=headers, params=params, timeout=timeout,
        )
        remaining = resp.headers.get("X-RateLimit-Remaining")
        if remaining is not None:
            try:
                if int(remaining) < 100:
                    logging.warning("[%s] GitHub rate limit low: %s/%s remaining",
                                    label, remaining, resp.headers.get("X-RateLimit-Limit"))
            except ValueError:
                pass
        if resp.status_code == 200:
            return resp.json()
        logging.warning("[%s] HTTP %d from %s", label, resp.status_code, path)
    except Exception as exc:
        logging.warning("[%s] request error for %s: %s", label, path, exc)
    return None


def fetch_repo(owner, repo, token, session=None):
    """Fetch GitHub repo metadata, returning None on any error."""
    return gh_get(f"/repos/{owner}/{repo}", token, session=session, label="repos")


def repo_status(owner, repo, token, session=None, timeout=DEFAULT_TIMEOUT):
    """Return the HTTP status code for a repo, or None on transport error."""
    session = session or make_session()
    headers = {"Accept": "application/vnd.github.v3+json"}
    if token:
        headers["Authorization"] = f"token {token}"
    try:
        resp = session.get(
            f"https://api.github.com/repos/{owner}/{repo}",
            headers=headers, timeout=timeout,
        )
        return resp.status_code
    except Exception as exc:
        logging.warning("[repo-status] request error for %s/%s: %s", owner, repo, exc)
        return None


def commit_has_bot(commit, bot_set):
    """Return True if a commit was authored or co-authored by a known AI bot."""
    author = commit.get("commit", {}).get("author", {})
    email = (author.get("email") or "").lower()
    name = (author.get("name") or "").lower()
    if email in bot_set or name in bot_set:
        return True
    message = (commit.get("commit", {}).get("message") or "").lower()
    for line in message.splitlines():
        if line.strip().startswith("co-authored-by:"):
            if any(bot in line for bot in bot_set):
                return True
    return False


def _days_since(iso_str):
    if not iso_str:
        return None
    try:
        dt = datetime.fromisoformat(iso_str.replace("Z", "+00:00"))
    except (ValueError, AttributeError):
        return None
    return (datetime.now(timezone.utc) - dt).days


def repo_is_fork(data):
    return bool(data and data.get("fork"))


def repo_is_archived(data):
    return bool(data and data.get("archived"))


def repo_has_license(data):
    return bool(data and data.get("license"))


def repo_pushed_days_ago(data):
    """Days since last push, or None if unknown."""
    return _days_since(data.get("pushed_at")) if data else None


def repo_age_days(data):
    """Days since repo creation, or None if unknown."""
    return _days_since(data.get("created_at")) if data else None
