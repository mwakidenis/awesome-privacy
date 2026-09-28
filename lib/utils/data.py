"""YAML loading, service iteration, slug generation."""

import os
import re

import yaml

PROJECT_ROOT = os.path.dirname(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
)
DATA_PATH = os.path.join(PROJECT_ROOT, "awesome-privacy.yml")


def load_yaml(path=DATA_PATH):
    with open(path) as f:
        return yaml.safe_load(f)


def iter_services(data):
    """Yield (category_name, section_name, service_dict) for every service."""
    for cat in data.get("categories", []) or []:
        cat_name = cat.get("name", "")
        for sec in cat.get("sections", []) or []:
            sec_name = sec.get("name", "")
            for svc in sec.get("services", []) or []:
                yield cat_name, sec_name, svc


def slugify(title):
    """Match the slug format used by awesome-privacy.xyz and the README generator."""
    if not title:
        return ""
    title = title.lower()
    title = re.sub(r"\s+", "-", title)
    title = re.sub(r"[+&]", "and", title)
    return title.replace("?", "")
