"""
This fetches info about a project/service which is being submitted.
It's used when a PR is open, to show some additional context.

Everything fetched here, is basically just a sneak peek of
what will be fetched by the main awesome-privacy.xyz website
once this submission is deployed. And it uses all the same endpoints.
It covers (where applicable) the following look ups:
    - Repo - basic community checks
    - Website - security sanity checks
    - Android app - permissions, trackers, meta
    - iOS app - reviews, and meta info
    - Privacy policy - overall grade, link (if tosdr)

The output is in markdown, and has some color grading with circle emojis.
This is not a pass/fail check, and is not required for a PR to get merged.
It just adds a bit of context, to make reviewing it a tiny bit quicker!
Excuse the code, it's a bit scrappy! But it's never used in the prod app.
"""

import argparse
import json
import logging
import os
import re
import sys
from datetime import datetime, timezone
from urllib.parse import urlparse

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import utils

utils.setup_logging()
logger = logging.getLogger(__name__)

DIFF_PATH = "/tmp/pr-diff.json"
OUTPUT_PATH = "/tmp/repo-stats.md"
TIMEOUT = 10
MAX_SUBMISSIONS = 5
USER_AGENT = "awesome-privacy-ci/1.0"
RESTRICTIVE_LICENSES = {
    "AGPL-3.0-only", "AGPL-3.0-or-later", "SSPL-1.0", "BSL-1.0", "BUSL-1.1",
}

SESSION = utils.make_session(user_agent=USER_AGENT)

API_TOKEN = os.environ.get("API_TOKEN", "")

GREEN, ORANGE, RED, BLUE, WHITE = "\U0001f7e2", "\U0001f7e0", "\U0001f534", "\U0001f535", "\u26aa"


def _enrich_get(path, params=None, timeout=TIMEOUT):
    """GET a unified-API enrichment endpoint with this script's session and token."""
    return utils.enrich_get(path, params=params, token=API_TOKEN, session=SESSION, timeout=timeout)


def relative_time(iso_str):
    """Convert ISO timestamp to human-readable relative time, or None."""
    if not iso_str:
        return None
    try:
        dt = datetime.fromisoformat(str(iso_str).replace("Z", "+00:00"))
        days = (datetime.now(timezone.utc) - dt).days
        if days < 1:
            return "today"
        if days < 7:
            return f"{days} day{'s' if days != 1 else ''}"
        if days < 30:
            w = days // 7
            return f"{w} week{'s' if w != 1 else ''}"
        if days < 365:
            m = days // 30
            return f"{m} month{'s' if m != 1 else ''}"
        y, rm = days // 365, (days % 365) // 30
        s = f"{y} year{'s' if y != 1 else ''}"
        return f"{s}, {rm} month{'s' if rm != 1 else ''}" if rm else s
    except Exception:
        return None


def _friendly_date(iso_str):
    """Return relative time string with 'ago' suffix, falling back to raw string."""
    if not iso_str:
        return None
    rt = relative_time(iso_str)
    if rt is None:
        return str(iso_str)
    return rt if rt == "today" else f"{rt} ago"


def _format_bytes(n):
    """Format bytes to human-readable size."""
    try:
        n = int(n)
    except (TypeError, ValueError):
        return None
    for unit, threshold in [("GB", 1e9), ("MB", 1e6), ("KB", 1e3)]:
        if n >= threshold:
            return f"{n / threshold:.1f} {unit}"
    return f"{n} B"


def _info_or_unknown(label, value):
    """Return a blue info stat, or white Unknown if value is falsy."""
    return (BLUE, label, value) if value else (WHITE, label, "Unknown")


def format_markdown(stats):
    """Format graded stats as markdown bullet list."""
    return "\n".join(f"- {emoji} **{label}:** {value}" for emoji, label, value in stats)


def gh_get(path, token, params=None):
    """GET a GitHub API endpoint. Returns JSON on 200, else None."""
    return utils.gh_get(path, token, session=SESSION, params=params, timeout=TIMEOUT, label="repos")


def fetch_all_data(owner, repo, token):
    """Fetch all repo data. Returns dict or None if main repo call fails."""
    base = gh_get(f"/repos/{owner}/{repo}", token)
    if not base:
        return None

    data = {
        "license": base.get("license"),
        "created_at": base.get("created_at"),
        "pushed_at": base.get("pushed_at"),
        "stars": base.get("stargazers_count", 0),
        "fork": base.get("fork", False),
        "archived": base.get("archived", False),
        "homepage": base.get("homepage"),
        "owner": base.get("owner", {}).get("login"),
        "open_issues_count": base.get("open_issues_count", 0),
    }

    releases = gh_get(f"/repos/{owner}/{repo}/releases", token, {"per_page": 11})
    data["release_count"] = len(releases) if releases is not None else None

    contributors = gh_get(
        f"/repos/{owner}/{repo}/contributors", token, {"per_page": 11, "anon": "true"},
    )
    data["contributor_count"] = len(contributors) if contributors is not None else None

    commits = gh_get(f"/repos/{owner}/{repo}/commits", token, {"per_page": 100})
    if commits is not None:
        bot_set = {a.lower() for a in utils.AI_BOT_AUTHORS}
        data["commit_count"] = len(commits)
        data["ai_commit_count"] = sum(1 for c in commits if utils.commit_has_bot(c, bot_set))
    else:
        data["commit_count"] = None
        data["ai_commit_count"] = None

    languages = gh_get(f"/repos/{owner}/{repo}/languages", token)
    data["languages"] = list(languages.keys()) if languages is not None else None

    report = _enrich_get(f"security/{owner}/{repo}")
    data["unpatched_advisories"] = _count_unpatched_advisories(report)

    return data


SECURITY_SEVERITIES = {"medium", "high", "critical"}


def _count_unpatched_advisories(report):
    """Count open advisories of medium severity or above that are unpatched, or None."""
    if not report:
        return None
    items = (report.get("advisories") or {}).get("items") or []
    return sum(
        1 for a in items
        if not a.get("isPatched")
        and str(a.get("severity", "")).lower() in SECURITY_SEVERITIES
    )


def grade_stats(data):
    """Grade repo stats, returning list of (emoji, label, value_str) tuples."""
    stats = []

    lic = data.get("license")
    if not lic:
        stats.append((RED, "License", "Missing"))
    else:
        spdx = lic.get("spdx_id", "")
        if spdx == "NOASSERTION":
            stats.append((WHITE, "License", "Unknown"))
        elif spdx in RESTRICTIVE_LICENSES:
            stats.append((ORANGE, "License", spdx))
        else:
            stats.append((GREEN, "License", lic.get("name") or spdx or "Present"))

    age_days = utils.repo_age_days(data)
    age_str = relative_time(data.get("created_at"))
    if age_days is None:
        stats.append((WHITE, "Repo Age", "Unknown"))
    elif age_days >= 730:
        stats.append((GREEN, "Repo Age", age_str))
    elif age_days >= 180:
        stats.append((ORANGE, "Repo Age", age_str))
    else:
        stats.append((RED, "Repo Age", age_str))

    updated_days = utils.repo_pushed_days_ago(data)
    updated_str = _friendly_date(data.get("pushed_at"))
    if updated_days is None:
        stats.append((WHITE, "Last Updated", "Unknown"))
    elif updated_days <= 7:
        stats.append((GREEN, "Last Updated", updated_str))
    elif updated_days <= 56:
        stats.append((ORANGE, "Last Updated", updated_str))
    else:
        stats.append((RED, "Last Updated", updated_str))

    rc = data.get("release_count")
    if rc is None:
        stats.append((WHITE, "Releases", "Unknown"))
    elif rc >= 10:
        stats.append((GREEN, "Releases", f"{rc}+" if rc >= 11 else str(rc)))
    elif rc >= 1:
        stats.append((ORANGE, "Releases", str(rc)))
    else:
        stats.append((RED, "Releases", "0"))

    stars = data.get("stars")
    if stars is None:
        stats.append((WHITE, "Stars", "Unknown"))
    elif stars >= 1000:
        stats.append((GREEN, "Stars", f"{stars:,}"))
    elif stars >= 100:
        stats.append((ORANGE, "Stars", f"{stars:,}"))
    else:
        stats.append((RED, "Stars", f"{stars:,}"))

    cc = data.get("contributor_count")
    if cc is None:
        stats.append((WHITE, "Contributors", "Unknown"))
    elif cc >= 10:
        stats.append((GREEN, "Contributors", f"{cc}+" if cc >= 11 else str(cc)))
    elif cc >= 3:
        stats.append((ORANGE, "Contributors", str(cc)))
    else:
        stats.append((RED, "Contributors", str(cc)))

    fork = data.get("fork")
    if fork is None:
        stats.append((WHITE, "Is Fork", "Unknown"))
    else:
        stats.append((ORANGE if fork else GREEN, "Is Fork", "Yes" if fork else "No"))

    archived = data.get("archived")
    if archived is None:
        stats.append((WHITE, "Is Archived", "Unknown"))
    else:
        stats.append((RED if archived else GREEN, "Is Archived", "Yes" if archived else "No"))

    adv = data.get("unpatched_advisories")
    if adv is None:
        stats.append((WHITE, "Security Advisories", "Unknown"))
    elif adv > 0:
        stats.append((ORANGE, "Security Advisories", f"{adv} potentially unpatched CVEs"))
    else:
        stats.append((GREEN, "Security Advisories", "No unpatched active CVEs found"))

    ai = data.get("ai_commit_count")
    if ai is None:
        stats.append((WHITE, "Vibe Coded", "Unknown"))
    elif ai >= 20:
        stats.append((RED, "Vibe Coded", f"{ai} AI commits"))
    elif ai >= 1:
        stats.append((ORANGE, "Vibe Coded", f"{ai} AI commit{'s' if ai != 1 else ''}"))
    else:
        stats.append((GREEN, "Vibe Coded", "0 AI commits"))

    commit_count = data.get("commit_count")
    if commit_count is None:
        stats.append((WHITE, "Commits", "Unknown"))
    else:
        stats.append((BLUE, "Commits", f"{commit_count:,}+" if commit_count >= 100 else f"{commit_count:,}"))

    issues = data.get("open_issues_count")
    stats.append((BLUE, "Open Issues", f"{issues:,}") if issues is not None else (WHITE, "Open Issues", "Unknown"))

    stats.append(_info_or_unknown("Website", data.get("homepage")))
    stats.append(_info_or_unknown("Author", data.get("owner")))

    langs = data.get("languages")
    stats.append(_info_or_unknown("Languages", ", ".join(langs) if langs else None))

    return stats


def fetch_website_data(url):
    """Fetch site info from the unified API."""
    return _enrich_get("website", params={"url": url}, timeout=15)


def check_security_txt(url):
    """Check for a valid security.txt. Returns True/False/None on error."""
    parsed = urlparse(url)
    base = f"{parsed.scheme}://{parsed.netloc}"
    for path in ("/.well-known/security.txt", "/security.txt"):
        try:
            resp = SESSION.get(base + path, timeout=TIMEOUT, allow_redirects=True)
            if resp.status_code == 200 and "contact:" in resp.text.lower():
                return True
        except Exception:
            continue
    try:
        SESSION.head(base, timeout=TIMEOUT)
        return False
    except Exception:
        return None


def _header_present(data, key):
    """Check if a response header is present. Returns GREEN/RED/WHITE tuple helper."""
    if not data:
        return WHITE
    val = data.get("response_headers", {}).get(key)
    if key == "content_security_policy" and not val:
        val = data.get("response_headers", {}).get("content_security_policy_report_only")
    return GREEN if val else RED


def grade_website_stats(data, url, has_security_txt):
    """Grade website stats."""
    stats = []

    code = data.get("response_headers", {}).get("code") if data else None
    if code is None:
        stats.append((WHITE, "Status", "Unknown"))
    elif 200 <= code < 300:
        stats.append((GREEN, "Status", str(code)))
    elif 300 <= code < 400:
        stats.append((ORANGE, "Status", str(code)))
    else:
        stats.append((RED, "Status", str(code)))

    stats.append((GREEN, "HTTPS", "Yes") if url.startswith("https://") else (RED, "HTTPS", "No"))

    bl = data.get("domain_blacklist", {}) if data else {}
    detections = bl.get("detections") if isinstance(bl, dict) else None
    if detections is None:
        stats.append((WHITE, "Blacklist", "Unknown"))
    elif detections == 0:
        stats.append((GREEN, "Blacklist", "Not listed"))
    else:
        stats.append((RED, "Blacklist", f"{detections} detection(s)"))

    redir = data.get("redirection", {}) if data else {}
    if not isinstance(redir, dict):
        redir = {}
    found, external = redir.get("found"), redir.get("external")
    if found is None:
        stats.append((WHITE, "Redirect", "Unknown"))
    elif not found:
        stats.append((GREEN, "Redirect", "None"))
    elif external:
        stats.append((RED, "Redirect", "External redirect"))
    else:
        stats.append((ORANGE, "Redirect", "Internal redirect"))

    risk_data = data.get("risk_score", {}) if data else {}
    risk = risk_data.get("result") if isinstance(risk_data, dict) else None
    if risk is None:
        stats.append((WHITE, "Risk Score", "Unknown"))
    elif risk == 0:
        stats.append((GREEN, "Risk Score", "0"))
    elif risk <= 5:
        stats.append((ORANGE, "Risk Score", str(risk)))
    else:
        stats.append((RED, "Risk Score", str(risk)))

    for key, label in [("strict_transport_security", "HSTS"),
                        ("content_security_policy", "CSP"),
                        ("x_frame_options", "X-Frame-Options")]:
        emoji = _header_present(data, key)
        stats.append((emoji, label, "Present" if emoji == GREEN else "Missing" if emoji == RED else "Unknown"))

    if has_security_txt is None:
        stats.append((WHITE, "Security.txt", "Unknown"))
    else:
        stats.append((GREEN if has_security_txt else RED, "Security.txt",
                       "Present" if has_security_txt else "Missing"))

    sd = data.get("server_details", {}) if data else {}
    if not isinstance(sd, dict):
        sd = {}
    server_parts = [v for k in ("ip", "country", "asn") if (v := sd.get(k))]
    stats.append(_info_or_unknown("Server", ", ".join(server_parts) if server_parts else None))

    loc_parts = [v for k in ("city_name", "region_name", "country_name") if (v := sd.get(k))]
    stats.append(_info_or_unknown("Server Location", ", ".join(loc_parts) if loc_parts else None))

    title = None
    if data and isinstance(data.get("web_page"), dict):
        title = data["web_page"].get("title")
    stats.append(_info_or_unknown("Title", title))

    return stats


def fetch_android_data(package_id):
    """Fetch Android app privacy data."""
    package_id = (package_id.split("id=")[-1] if "id=" in package_id else package_id).split("&")[0]
    data = _enrich_get(f"android/{package_id}")
    return data if data and not data.get("error") else None


_DEGOOGLED = {
    "gold": (GREEN, "Gold (works)"),
    "silver": (GREEN, "Silver (minor issues)"),
    "bronze": (ORANGE, "Bronze (limited)"),
    "broken": (RED, "Broken"),
}


def grade_android_stats(data):
    """Grade Android app stats."""
    stats = []

    trackers = data.get("trackers")
    if trackers is None:
        stats.append((WHITE, "Trackers", "Unknown"))
    else:
        n = len(trackers)
        stats.append((GREEN if n == 0 else ORANGE if n <= 2 else RED, "Trackers", str(n)))

    perms = data.get("permissions")
    if perms is None:
        stats.append((WHITE, "Permissions", "Unknown"))
    else:
        n = len(perms)
        stats.append((GREEN if n <= 2 else ORANGE if n <= 10 else RED, "Permissions", str(n)))

    stats.append(_info_or_unknown("Downloads", data.get("downloads")))
    stats.append(_info_or_unknown("Created", _friendly_date(data.get("created"))))
    stats.append(_info_or_unknown("Last Updated", _friendly_date(data.get("updated"))))

    status = utils.degoogled_status(data)
    if status:
        color, label = _DEGOOGLED.get(status, (BLUE, status.title()))
        stats.append((color, "De-Googled", label))

    return stats


def fetch_ios_data(app_url):
    """Fetch iOS app info, extracting the numeric id and country from the store URL."""
    if not app_url:
        return None
    id_match = re.search(r"/id(\d+)", app_url)
    if not id_match:
        return None
    country_match = re.search(r"apps\.apple\.com/([a-z]{2})/", app_url)
    country = country_match.group(1) if country_match else "us"
    return _enrich_get(f"ios/{id_match.group(1)}", params={"country": country})


def grade_ios_stats(data):
    """Grade iOS app stats."""
    stats = []

    rating = data.get("averageUserRating")
    if rating is None:
        stats.append((WHITE, "Rating", "Unknown"))
    else:
        stats.append((GREEN if rating >= 4.5 else ORANGE if rating >= 3.5 else RED,
                       "Rating", f"{rating:.1f} / 5"))

    stats.append(_info_or_unknown("Created", _friendly_date(data.get("releaseDate"))))
    stats.append(_info_or_unknown("Last Updated", _friendly_date(data.get("currentVersionReleaseDate"))))
    stats.append(_info_or_unknown("Size", _format_bytes(data.get("fileSizeBytes"))))

    return stats


def fetch_tosdr_data(service_id):
    """Fetch ToS;DR privacy policy data."""
    return _enrich_get(f"privacy/{service_id}")


def grade_tosdr_stats(data):
    """Grade ToS;DR privacy policy stats."""
    stats = []
    params = data or {}

    rating = params.get("rating")
    if not rating:
        stats.append((WHITE, "Score", "Unknown"))
    else:
        r = str(rating).upper()
        stats.append((GREEN if r == "A" else ORANGE if r in ("B", "C") else RED,
                       "Score", f"Grade {r}"))

    doc_url = None
    docs = params.get("documents")
    if docs and isinstance(docs, list) and isinstance(docs[0], dict):
        doc_url = docs[0].get("url")
    stats.append(_info_or_unknown("Privacy Policy", doc_url))

    return stats


def _resolve_args(argv):
    """Return list of dicts with keys: name, owner, repo, url, android, ios, tosdr."""
    parser = argparse.ArgumentParser(description="Generate submission info stats")
    parser.add_argument("--repo", default=None, help="owner/repo")
    parser.add_argument("--url", default=None, help="Website URL to check")
    parser.add_argument("--android", default=None, help="Android package ID")
    parser.add_argument("--ios", default=None, help="iOS App Store URL")
    parser.add_argument("--tosdr", default=None, help="ToS;DR service ID")
    args = parser.parse_args(argv[1:])

    if any(vars(args).values()):
        result = {"name": None, "owner": None, "repo": None, "url": args.url,
                  "android": args.android, "ios": args.ios, "tosdr": args.tosdr}
        if args.repo:
            owner, repo = utils.parse_github_field(args.repo)
            if not owner:
                logger.error("Invalid repo format: %s", args.repo)
                sys.exit(1)
            result["owner"], result["repo"] = owner, repo
        return [result]

    # CI mode: extract from diff file
    try:
        with open(DIFF_PATH) as f:
            diff = json.load(f)
    except Exception:
        logger.info("No arguments and no diff file found, nothing to look up")
        sys.exit(0)

    field_map = {"github": "owner", "url": "url", "androidApp": "android",
                 "iosApp": "ios", "tosdrId": "tosdr"}
    services = []
    for svc in diff.get("services", {}).get("added", [])[:MAX_SUBMISSIONS]:
        result = {"name": svc.get("service"), "owner": None, "repo": None,
                  "url": None, "android": None, "ios": None, "tosdr": None}
        fields = svc.get("fields", {})
        for yaml_key, result_key in field_map.items():
            if fields.get(yaml_key):
                if yaml_key == "github":
                    result["owner"], result["repo"] = utils.parse_github_field(fields[yaml_key])
                else:
                    result[result_key] = str(fields[yaml_key])
        if any(v for k, v in result.items() if k != "name"):
            services.append(result)

    if not services:
        logger.info("No checkable fields found in diff")
        sys.exit(0)

    logger.info("Found %d service(s) with checkable fields in diff", len(services))
    return services


def _build_service_sections(args, token):
    """Build (heading, body) section tuples for a single service."""
    sections = []

    if args["owner"] and args["repo"]:
        logger.info("Fetching repo stats for %s/%s", args["owner"], args["repo"])
        data = fetch_all_data(args["owner"], args["repo"], token)
        if data:
            sections.append(("Repo Stats", format_markdown(grade_stats(data))))
        else:
            logger.warning("Failed to fetch repo data for %s/%s", args["owner"], args["repo"])

    if args["url"]:
        parsed_url = urlparse(args["url"])
        if parsed_url.hostname and parsed_url.hostname.rstrip(".").endswith("github.com"):
            logger.info("Skipped website checks, github repo was specified: %s", args["url"])
            sections.append(("Website Checks",
                             f"- {ORANGE} **Skipped** web checks, since repo URL was submitted instead of a website"))
        else:
            logger.info("Fetching website checks for %s", args["url"])
            site_data = fetch_website_data(args["url"])
            has_sec_txt = check_security_txt(args["url"])
            if site_data or has_sec_txt is not None:
                sections.append(("Website Checks",
                                 format_markdown(grade_website_stats(site_data, args["url"], has_sec_txt))))

    if args["android"]:
        logger.info("Fetching Android app info for %s", args["android"])
        data = fetch_android_data(args["android"])
        if data:
            sections.append(("Android App", format_markdown(grade_android_stats(data))))
        else:
            logger.warning("Failed to fetch Android data for %s", args["android"])

    if args["ios"]:
        logger.info("Fetching iOS app info for %s", args["ios"])
        data = fetch_ios_data(args["ios"])
        if data:
            sections.append(("iOS App", format_markdown(grade_ios_stats(data))))
        else:
            logger.warning("Failed to fetch iOS data for %s", args["ios"])

    if args["tosdr"]:
        logger.info("Fetching ToS;DR privacy policy for %s", args["tosdr"])
        data = fetch_tosdr_data(args["tosdr"])
        if data:
            sections.append(("Privacy Policy", format_markdown(grade_tosdr_stats(data))))
        else:
            logger.warning("Failed to fetch ToS;DR data for %s", args["tosdr"])

    return sections


def main():
    try:
        all_services = _resolve_args(sys.argv)
        cli_mode = len(sys.argv) > 1
        multi = len(all_services) > 1
        token = os.environ.get("GITHUB_TOKEN", "")
        all_md_parts = []

        for svc_args in all_services:
            if svc_args.get("name"):
                logger.info("Looking up submission info for %s", svc_args["name"])
            sections = _build_service_sections(svc_args, token)
            if not sections:
                continue
            md_parts = []
            if multi and svc_args.get("name"):
                md_parts.append(f"### {svc_args['name']}")
            for heading, body in sections:
                md_parts.append(f"#### {heading}\n{body}")
            all_md_parts.append("\n\n".join(md_parts))

        if not all_md_parts:
            sys.exit(0)

        md = "\n\n---\n\n".join(all_md_parts)
        md += "\n\n<sup>The above data does not determine a submissions eligibility. Human review is still needed.</sup>\n"
        md += "<sup><b>Key:</b> 🟢 = good. 🟠 = warning. 🔴 = attention required. 🔵 = info. ⚪ = unknown. </sup>\n\n"

        if cli_mode:
            print(md)
        else:
            with open(OUTPUT_PATH, "w") as f:
                f.write(md + "\n")
            logger.info("Submission stats written to %s", OUTPUT_PATH)
    except Exception as e:
        logger.error("make-info-stats failed: %s", e, exc_info=True)

    sys.exit(0)


if __name__ == "__main__":
    main()
