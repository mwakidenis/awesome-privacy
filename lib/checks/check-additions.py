"""Validates data quality for added/modified services using the diff JSON."""

import json
import logging
import os
import sys

import yaml

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import utils

utils.setup_logging()
logger = logging.getLogger(__name__)

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DATA_PATH = os.path.join(PROJECT_ROOT, "awesome-privacy.yml")
DIFF_PATH = "/tmp/pr-diff.json"
FINDINGS_PATH = "/tmp/findings-data.json"
SCHEMA_ERRORS_PATH = "/tmp/schema-errors.json"
MAX_SCHEMA_ERRORS_SHOWN = 10

REQUIRED_FIELDS = ("name", "description", "url", "icon")
REPO_FIELDS = ("github", "codeberg", "git")

CONTRIBUTING = "https://github.com/Lissy93/awesome-privacy/blob/main/.github/CONTRIBUTING.md"

SCHEMA_MSG = (
    "Some of the schema checks have failed. Please check that your addition"
    " contains all the required fields, with acceptable values, nothing"
    " additional and that it is following valid YAML syntax"
)
MULTIPLE_MSG = "Please make just one addition per pull request"
MISSING_TPL = (
    "Did you include all required fields? Looks like {fields} is missing or"
    f" invalid. Please see the [required fields]({CONTRIBUTING}#service-fields)"
    " for available fields."
)
POSITION_MSG = (
    "New entries must be added to the end of the section, unless otherwise requested"
)
OPENSOURCE_MSG = (
    "You indicated this app/service is not open source. This will likely make"
    " it ineligible for listing on Awesome Privacy in accordance with our"
    f" [Requirements]({CONTRIBUTING}#requirements)."
    " Please ensure that this is justified in your PR body."
)
DUPLICATE_NAME_MSG = (
    "A service named `{name}` already exists (in {location})."
    " If this is a different service, please clarify in your PR description"
)
DUPLICATE_URL_MSG = (
    "The URL `{url}` is already associated with `{existing}`."
    " Please check this isn't a duplicate submission"
)
DESC_LENGTH_MSG = (
    "Description length ({length} chars) is outside the recommended 50\u2013250"
    f" character range. Please see our [Contributing Guidelines]({CONTRIBUTING}#description)"
)
OPENSOURCE_GITHUB_MSG = (
    "You marked this service as open source but didn't include a repository link."
    " Please add a `github`, `codeberg` or `git` field"
)


def _has_repo(fields):
    """Return True if a service has any source-repository field set."""
    return any(fields.get(f) for f in REPO_FIELDS)


def load_json(path):
    """Load JSON from a file, returning None on any error."""
    try:
        with open(path) as f:
            return json.load(f)
    except Exception:
        return None


def load_yaml_data(path):
    """Load YAML from a file, returning None on any error."""
    try:
        with open(path) as f:
            return yaml.safe_load(f)
    except Exception:
        return None


def find_section_services(head, category, section):
    """Return the services list for a category/section pair, or None."""
    for cat in head.get("categories", []):
        if cat.get("name") == category:
            for sec in cat.get("sections", []):
                if sec.get("name") == section:
                    return sec.get("services", [])
    return None


def find_service_fields(head, category, section, service_name):
    """Look up a service's fields in the head YAML."""
    services = find_section_services(head, category, section)
    if services:
        for svc in services:
            if svc.get("name") == service_name:
                return svc
    return None


def check_required_fields(diff, head):
    """Return a finding if any added/modified service is missing required fields."""
    missing = set()
    for svc in diff.get("services", {}).get("added", []):
        fields = svc.get("fields", {})
        for f in REQUIRED_FIELDS:
            if fields.get(f) is None:
                missing.add(f)
    for svc in diff.get("services", {}).get("modified", []):
        if not head:
            continue
        changed = svc.get("changed_fields", [])
        fields = find_service_fields(
            head, svc["category"], svc["section"], svc["service"]
        )
        if fields:
            for f in REQUIRED_FIELDS:
                if f in changed and fields.get(f) is None:
                    missing.add(f)
    if missing:
        names = ", ".join(f"`{f}`" for f in sorted(missing))
        return MISSING_TPL.format(fields=names)
    return None


def check_position(diff, head):
    """Return a finding if a newly added service is not at the end of its section."""
    if not head:
        return None
    for svc in diff.get("services", {}).get("added", []):
        services = find_section_services(head, svc["category"], svc["section"])
        if services and services[-1].get("name") != svc["service"]:
            return POSITION_MSG
    return None


def check_open_source(diff):
    """Return a finding if an added service has openSource missing or not true."""
    for svc in diff.get("services", {}).get("added", []):
        fields = svc.get("fields", {})
        if fields.get("openSource") is not True and not _has_repo(fields):
            return OPENSOURCE_MSG
    return None


def check_single_entry(diff):
    """Return a finding if the diff adds multiple new services or sections."""
    services = diff.get("services", {})
    added_count = len(services.get("added", []))
    if added_count > 1:
        return MULTIPLE_MSG
    if added_count == 0:
        added_sections = [s for s in diff.get("sections", [])
                          if s.get("change_type") == "added_section"]
        if len(added_sections) > 1:
            return MULTIPLE_MSG
    return None


def _added_keys(diff):
    """Build a set of (category, section, lowercase_name) for added services."""
    keys = set()
    for svc in diff.get("services", {}).get("added", []):
        name = svc.get("fields", {}).get("name", "").lower().strip()
        keys.add((svc.get("category", ""), svc.get("section", ""), name))
    return keys


def build_name_index(head, diff):
    """Build {lowercase_name: "category > section"} from all services, excluding additions."""
    index = {}
    if not head:
        return index
    exclude = _added_keys(diff)
    for cat in head.get("categories", []):
        cn = cat.get("name", "")
        for sec in cat.get("sections", []):
            sn = sec.get("name", "")
            for svc in sec.get("services", []):
                name = svc.get("name", "").lower().strip()
                if name and (cn, sn, name) not in exclude:
                    index[name] = f"{cn} > {sn}"
    return index


def build_url_index(head, diff):
    """Build {url: service_name} from all services, excluding additions."""
    index = {}
    if not head:
        return index
    exclude = _added_keys(diff)
    for cat in head.get("categories", []):
        cn = cat.get("name", "")
        for sec in cat.get("sections", []):
            sn = sec.get("name", "")
            for svc in sec.get("services", []):
                name = svc.get("name", "").lower().strip()
                if (cn, sn, name) in exclude:
                    continue
                url = svc.get("url", "")
                if url:
                    index[url] = svc.get("name", "")
    return index


def check_duplicate_name(diff, name_index):
    """Return a finding if an added service name already exists in the YAML."""
    for svc in diff.get("services", {}).get("added", []):
        name = svc.get("fields", {}).get("name", "").lower().strip()
        if name and name in name_index:
            return DUPLICATE_NAME_MSG.format(
                name=svc["fields"]["name"], location=name_index[name],
            )
    return None


def check_duplicate_url(diff, url_index):
    """Return a finding if an added service URL already exists in the YAML."""
    for svc in diff.get("services", {}).get("added", []):
        url = svc.get("fields", {}).get("url", "")
        if url and url in url_index:
            return DUPLICATE_URL_MSG.format(url=url, existing=url_index[url])
    return None


def check_description_length(diff):
    """Return a finding if an added service description is outside 50-250 chars."""
    for svc in diff.get("services", {}).get("added", []):
        desc = svc.get("fields", {}).get("description", "")
        length = len(desc)
        if length < 50 or length > 280:
            return DESC_LENGTH_MSG.format(length=length)
    return None


def check_opensource_github(diff):
    """Return a finding if an added service is open source but has no github field."""
    for svc in diff.get("services", {}).get("added", []):
        fields = svc.get("fields", {})
        if fields.get("openSource") is True and not _has_repo(fields):
            return OPENSOURCE_GITHUB_MSG
    return None


def load_schema_errors():
    """Load detailed schema/YAML errors written by validate-awesome-privacy.py, if any."""
    try:
        with open(SCHEMA_ERRORS_PATH) as f:
            data = json.load(f)
        return [str(x) for x in data] if isinstance(data, list) else []
    except (OSError, ValueError):
        return []


def schema_findings():
    """Return one error-level finding per detailed schema error, or the generic fallback."""
    errors = load_schema_errors()
    if not errors:
        return [{"msg": SCHEMA_MSG, "level": "error"}]
    shown = errors[:MAX_SCHEMA_ERRORS_SHOWN]
    out = [{"msg": e, "level": "error"} for e in shown]
    extra = len(errors) - len(shown)
    if extra > 0:
        out.append({"msg": f"…and {extra} more schema error(s)", "level": "error"})
    return out


def main():
    findings = []
    critical = False
    try:
        if os.environ.get("SCHEMA_OUTCOME") == "failure":
            logger.warning("Schema validation failed upstream, surfacing schema errors")
            findings.extend(schema_findings())

        diff = load_json(DIFF_PATH)
        head = load_yaml_data(DATA_PATH)

        if not diff:
            logger.info("No diff at %s, nothing to validate", DIFF_PATH)
        else:
            added = diff.get("services", {}).get("added", [])
            modified = diff.get("services", {}).get("modified", [])
            logger.info("Validating additions: %d added, %d modified service(s)",
                        len(added), len(modified))

            name_index = build_name_index(head, diff)
            url_index = build_url_index(head, diff)

            checks = [
                ("single-entry", check_single_entry(diff), False),
                ("required-fields", check_required_fields(diff, head), True),
                ("position", check_position(diff, head), False),
                ("open-source", check_open_source(diff), False),
                ("duplicate-name", check_duplicate_name(diff, name_index), False),
                ("duplicate-url", check_duplicate_url(diff, url_index), False),
                ("description-length", check_description_length(diff), False),
                ("opensource-repo", check_opensource_github(diff), False),
            ]
            for name, finding, is_error in checks:
                if not finding:
                    continue
                logger.info("flagged: %s", name)
                if is_error:
                    findings.append({"msg": finding, "level": "error"})
                    critical = True
                else:
                    findings.append(finding)
    except Exception as exc:
        logger.error("Unhandled error in main: %s", exc, exc_info=True)

    logger.info("Additions check: %d finding(s)%s, writing to %s",
                len(findings), " (critical)" if critical else "", FINDINGS_PATH)
    with open(FINDINGS_PATH, "w") as f:
        json.dump(findings, f)
    sys.exit(1 if critical else 0)


if __name__ == "__main__":
    main()
