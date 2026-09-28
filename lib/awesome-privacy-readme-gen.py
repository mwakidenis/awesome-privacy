"""
Reads app list from awesome-privacy.yml,
formats into markdown, and inserts into README.md
"""

import os
import re
import sys
import yaml
import logging
from urllib.parse import urlparse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import utils

# Configure Logging
LOG_LEVEL = os.environ.get("LOG_LEVEL", "INFO").upper()
utils.setup_logging(LOG_LEVEL)
logger = logging.getLogger(__name__)

# Determine the project root based on the script's location
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
app_list_file_path = os.path.join(project_root, 'awesome-privacy.yml')
readme_path = os.path.join(project_root, '.github/README.md')
icon_size=14

def iconElement(serviceUrl, serviceIcon):
  path = serviceIcon or f"https://icon.horse/icon/{urlparse(serviceUrl).netloc}"
  return f"<img src='{path}' width='{icon_size}' alt='' />"

def slugify(title):
    if not title:
        return ''
    title = title.lower()
    title = re.sub(r'\s+', '-', title)
    title = re.sub(r'\+|&', 'and', title)
    title = title.replace('?', '')
    return title

_MD_PATTERNS = [
    re.compile(r'\[([^\]]*)\]\([^)]*\)'),    # [text](url) — group 1 = visible text
    re.compile(r'\*\*(.+?)\*\*'),             # **bold**
    re.compile(r'`([^`]+)`'),                 # `code`
    re.compile(r'(?<!\*)\*([^*]+)\*(?!\*)'),  # *italic*
]

def truncateMarkdown(text, maxLen=200):
    """Returns (truncated_text, was_truncated) preserving markdown constructs."""
    if len(text) <= maxLen:
        return text, False

    result = []
    visible = 0
    i = 0

    while i < len(text) and visible < maxLen:
        for pattern in _MD_PATTERNS:
            m = pattern.match(text, i)
            if m:
                result.append(m.group(0))
                visible += len(m.group(1))
                i = m.end()
                break
        else:
            result.append(text[i])
            visible += 1
            i += 1

    return ''.join(result).rstrip(), True

def makeHref(text):
    if not text: return "#"
    return re.sub(r'[^\w\s-]', '', text.lower()).replace(" ", "-")

def makeContents(data):
    contents = "<blockquote><details open>\n"
    contents += "<summary>📋 <b>Contents</b></summary>\n"

    for category in data.get('categories'):
        contents += f"\n- **{category.get('name')}**"
        for section in category.get('sections'):
            if (len(section.get('services') or []) > 0):
                contents += (
                    f"\n\t- [{section.get('name')}](#{makeHref(section.get('name'))}) "
                    f"({len(section.get('services') or [])})"
            )
    contents += "\n</details></blockquote>\n\n"
    return contents

def makeAwesomePrivacy(data):
  markdown = ""
  for category in data.get('categories'):
      markdown += f"## {category.get('name')}\n\n"
      for section in category.get('sections'):
          markdown += f"### {section.get('name')}\n\n"
          # Add intro
          if section.get('intro'):
            markdown += f"{section.get('intro')}\n"
          # No services yet
          if not section.get('services') or len(section.get('services')) == 0:
            markdown += (
              "<p  align=\"center\">"
              "<b>⚠️ This section is still a work in progress ⚠️</b><br />"
              "<i>Check back soon, or help us complete it by submitting a pull request</i>"
              "</p>"
            )
          # For each service, list it's name, icon, url, and description
          for app in section.get('services') or []:
              description, was_truncated = truncateMarkdown(' '.join(app.get('description', '').split()))
              ap_link = (
                  f"https://awesome-privacy.xyz/"
                  f"{slugify(category.get('name'))}/{slugify(section.get('name'))}/{slugify(app.get('name'))}"
              )
              ellipsis = f"[…]({ap_link} \"View full {app.get('name')} report\")" if was_truncated else ""
              markdown += (
                  f"- **[{iconElement(app.get('url'), app.get('icon'))} {app.get('name')}]"
                  f"({app.get('url')})** - {description}{ellipsis} \n"
              )
          markdown += "\n"
          # If word of warning exists, append it
          if section.get('wordOfWarning'):
            markdown += "<details>\n<summary>⚠️ <b>Word of Warning</b></summary>\n\n"
            word_of_warning = '\n'.join(
              f"> {line}".rstrip() for line in section.get('wordOfWarning').strip().split('\n')
            )
            markdown += f"{word_of_warning}\n\n"
            markdown += "</details>\n\n"
          # If notable mentions exists, append it (either as a list or a single string)
          if section.get('notableMentions'):
            markdown += "<details>\n<summary>✳️ <b>Notable Mentions</b></summary>\n\n"
            if isinstance(section.get('notableMentions'), list):
              for mention in section.get('notableMentions'):
                markdown += f"> - [{mention.get('name')}]({mention.get('url')})" + (
                  f" - {mention.get('description')}" if mention.get('description') else "\n"
              )
            else:
              notable_mentions = section.get('notableMentions').replace('\n', '\n> ')
              markdown += f"> {notable_mentions}"

            markdown += "</details>\n\n"
          # If further info exists, append it
          if section.get('furtherInfo'):
            markdown += "<details>\n<summary>ℹ️ <b>Further Info</b></summary>\n\n"
            markdown += f"> {section.get('furtherInfo')}"
            markdown += "</details>\n\n"
          markdown += "<p align=\"right\"><sup><a href=\"#top\">⬆️ [Back to Top]</a></sub></p>\n"
          markdown += "\n---\n\n"
  return markdown

def update_content_between_markers(content, start_marker, end_marker, new_content):
    logger.info(f"Updating content between {start_marker} and {end_marker} markers...")
    start_index = content.find(start_marker)
    end_index = content.find(end_marker)

    if start_index != -1 and end_index != -1:
        before_section = content[:start_index + len(start_marker)]
        after_section = content[end_index:]
        updated_content = before_section + '\n' + new_content + after_section
        return updated_content
    else:
        logger.error(f"Markers {start_marker} and {end_marker} not found.")
        return content


def main():
    logger.info("Reading the awesome-privacy file...")
    with open(app_list_file_path, 'r') as file:
        data = yaml.safe_load(file)

    awesome_privacy_results = makeContents(data) + makeAwesomePrivacy(data)

    logger.info("Reading README.md file...")
    with open(readme_path, 'r') as file:
        readme_content = file.read()

    readme_content = update_content_between_markers(
        readme_content,
        "<!-- awesome-privacy-start -->",
        "<!-- awesome-privacy-end -->",
        awesome_privacy_results,
    )

    logger.info("Writing back to README.md...")
    with open(readme_path, 'w') as file:
        file.write(readme_content)

    # All done. Time to go home for tea and medals.
    logger.info("Script completed successfully!")


if __name__ == "__main__":
    main()
