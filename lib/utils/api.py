"""Helpers for the unified Awesome Privacy API (enrichment endpoints)."""

import logging
import os
import re
from datetime import datetime, timezone

from .http import DEFAULT_TIMEOUT, make_session

API_URL = os.environ.get("API_URL", "https://api.awesome-privacy.xyz").rstrip("/")

_HIGH_SEVERITIES = {"high", "critical"}
_LOW_SEVERITIES = {"low", "medium"}


def enrich_get(path, params=None, token=None, session=None, timeout=DEFAULT_TIMEOUT,
               label=None, return_status=False):
    """GET a unified-API enrichment endpoint. Returns parsed JSON on 200, else None.

    With return_status=True, returns (data, http_status), where http_status is None on a
    network error, letting callers tell a genuine 404 apart from a transient failure.
    """
    session = session or make_session()
    headers = {"Authorization": f"Bearer {token}"} if token else None
    tag = f" ({label})" if label else ""
    data, status = None, None
    try:
        resp = session.get(f"{API_URL}/v1/enrich/{path}",
                           headers=headers, params=params, timeout=timeout)
        status = resp.status_code
        if status == 200:
            try:
                data = resp.json()
            except ValueError:
                logging.warning("[enrich] empty or invalid JSON body for %s%s", path, tag)
        else:
            logging.warning("[enrich] HTTP %d for %s%s", status, path, tag)
    except Exception as exc:
        logging.warning("[enrich] request error for %s%s: %s", path, tag, exc)
    return (data, status) if return_status else data


def fetch_security_report(owner, repo, token, session=None, timeout=DEFAULT_TIMEOUT, label=None):
    """Fetch a repo's security report from the unified API. Returns JSON or None."""
    return enrich_get(f"security/{owner}/{repo}",
                      token=token, session=session, timeout=timeout, label=label)


def fetch_android_app(pkg, token, session=None, timeout=DEFAULT_TIMEOUT, label=None):
    """Fetch an Android app's privacy report from the unified API. Returns JSON or None."""
    return enrich_get(f"android/{pkg}",
                      token=token, session=session, timeout=timeout, label=label)


def fetch_privacy(tosdr_id, token, session=None, timeout=DEFAULT_TIMEOUT, label=None):
    """Fetch a service's ToS;DR privacy report from the unified API. Returns JSON or None."""
    return enrich_get(f"privacy/{tosdr_id}",
                      token=token, session=session, timeout=timeout, label=label)


def unpatched_advisories(report):
    """Return (low_medium, high_critical) counts of open, unpatched advisories."""
    items = (report.get("advisories") or {}).get("items") or [] if report else []
    low_med = high_crit = 0
    for adv in items:
        if adv.get("isPatched"):
            continue
        sev = str(adv.get("severity", "")).lower()
        if sev in _HIGH_SEVERITIES:
            high_crit += 1
        elif sev in _LOW_SEVERITIES:
            low_med += 1
    return low_med, high_crit


def tracker_count(report):
    """Number of trackers in an Android app report, or None if unavailable."""
    trackers = report.get("trackers") if report else None
    return len(trackers) if isinstance(trackers, list) else None


def privacy_grade(report):
    """ToS;DR letter grade for a service (e.g. A to E), or None if absent."""
    grade = (report or {}).get("rating")
    return str(grade).upper() if grade else None


def degoogled_status(report):
    """Plexus de-Googled (no microG) status from an android report, or None."""
    native = ((report or {}).get("degoogled") or {}).get("native") or {}
    return native.get("status") if native.get("available") else None


_IOS_ID_RE = re.compile(r"(?:apps|itunes)\.apple\.com/\S*\bid(\d+)")
_IOS_COUNTRY_RE = re.compile(r"(?:apps|itunes)\.apple\.com/([a-z]{2})/")


def ios_app_id(app_url):
    """Numeric App Store id from an iosApp URL, or None if not a valid store URL."""
    match = _IOS_ID_RE.search(app_url or "")
    return match.group(1) if match else None


def fetch_ios(app_url, token, session=None, timeout=DEFAULT_TIMEOUT, label=None,
              return_status=False):
    """Fetch iTunes app info for an App Store URL from the unified API, or None."""
    app_id = ios_app_id(app_url)
    if not app_id:
        return (None, None) if return_status else None
    country = _IOS_COUNTRY_RE.search(app_url or "")
    return enrich_get(f"ios/{app_id}", params={"country": country.group(1) if country else "us"},
                      token=token, session=session, timeout=timeout, label=label,
                      return_status=return_status)


def ios_days_since_update(report):
    """Days since the iOS app's current version was released, or None."""
    raw = (report or {}).get("currentVersionReleaseDate")
    if not raw:
        return None
    try:
        dt = datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
    except ValueError:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return (datetime.now(timezone.utc) - dt).days


def ios_rating(report):
    """(averageUserRating, userRatingCount) from an iOS report, each None if absent."""
    data = report or {}
    return data.get("averageUserRating"), data.get("userRatingCount")
