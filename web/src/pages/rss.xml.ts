import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { fetchChangelog, type ChangelogEntry } from '../utils/fetch-changelog';
import { slugify } from '../utils/fetch-data';

const MAX_ITEMS = 50;
const FALLBACK_SITE = 'https://awesome-privacy.xyz';

const escapeHtml = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[c] as string,
  );

const pl = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

const serviceUrl = (
  site: URL,
  c: { category: string; section: string; name: string },
) =>
  new URL(
    `/${slugify(c.category)}/${slugify(c.section)}/${slugify(c.name)}`,
    site,
  ).toString();

const sectionUrl = (site: URL, s: { category: string; name: string }) =>
  new URL(`/${slugify(s.category)}/${slugify(s.name)}`, site).toString();

const categoryUrl = (site: URL, name: string) =>
  new URL(`/${slugify(name)}`, site).toString();

const hasAnyChange = (e: ChangelogEntry): boolean => {
  const { services: s, sections: sc, categories: ct } = e.changes ?? {};
  return Boolean(
    s?.added?.length ||
    s?.removed?.length ||
    s?.modified?.length ||
    s?.moved?.length ||
    s?.renamed?.length ||
    sc?.added?.length ||
    sc?.removed?.length ||
    sc?.moved?.length ||
    ct?.added?.length ||
    ct?.removed?.length,
  );
};

const summaryParts = (e: ChangelogEntry): string[] => {
  const { services: s, sections: sc, categories: ct } = e.changes ?? {};
  const parts: string[] = [];
  if (s?.added?.length) parts.push(pl(s.added.length, 'addition'));
  if (s?.removed?.length) parts.push(pl(s.removed.length, 'removal'));
  if (s?.modified?.length) parts.push(pl(s.modified.length, 'update'));
  if (s?.renamed?.length) parts.push(pl(s.renamed.length, 'rename'));
  if (s?.moved?.length) parts.push(pl(s.moved.length, 'move'));
  if (sc?.added?.length) parts.push(pl(sc.added.length, 'new section'));
  if (sc?.removed?.length) parts.push(pl(sc.removed.length, 'removed section'));
  if (sc?.moved?.length) parts.push(pl(sc.moved.length, 'moved section'));
  if (ct?.added?.length) parts.push(pl(ct.added.length, 'new category'));
  if (ct?.removed?.length)
    parts.push(pl(ct.removed.length, 'removed category'));
  return parts;
};

const buildContent = (e: ChangelogEntry, site: URL): string => {
  const { services: s, sections: sc, categories: ct } = e.changes ?? {};
  const blocks: string[] = [];
  const list = (title: string, inner: string) =>
    blocks.push(`<h3>${title}</h3><ul>${inner}</ul>`);
  const li = (html: string) => `<li>${html}</li>`;

  if (s?.added?.length)
    list(
      'Added',
      s.added
        .map((i) =>
          li(
            `<a href="${serviceUrl(site, i)}">${escapeHtml(i.name)}</a> — ${escapeHtml(i.category)} / ${escapeHtml(i.section)}`,
          ),
        )
        .join(''),
    );
  if (s?.removed?.length)
    list(
      'Removed',
      s.removed
        .map((i) =>
          li(
            `${escapeHtml(i.name)} — ${escapeHtml(i.category)} / ${escapeHtml(i.section)}`,
          ),
        )
        .join(''),
    );
  if (s?.modified?.length)
    list(
      'Updated',
      s.modified
        .map((i) =>
          li(
            `<a href="${serviceUrl(site, i)}">${escapeHtml(i.name)}</a>${
              i.fields?.length ? ` (${escapeHtml(i.fields.join(', '))})` : ''
            }`,
          ),
        )
        .join(''),
    );
  if (s?.renamed?.length)
    list(
      'Renamed',
      s.renamed
        .map((i) =>
          li(
            `${escapeHtml(i.previousName)} → <a href="${serviceUrl(site, { ...i.to, name: i.name })}">${escapeHtml(i.name)}</a>`,
          ),
        )
        .join(''),
    );
  if (s?.moved?.length)
    list(
      'Moved',
      s.moved
        .map((i) =>
          li(
            `<a href="${serviceUrl(site, { ...i.to, name: i.name })}">${escapeHtml(i.name)}</a>: ${escapeHtml(i.from.category)}/${escapeHtml(i.from.section)} → ${escapeHtml(i.to.category)}/${escapeHtml(i.to.section)}`,
          ),
        )
        .join(''),
    );
  if (sc?.added?.length)
    list(
      'New sections',
      sc.added
        .map((i) =>
          li(
            `<a href="${sectionUrl(site, i)}">${escapeHtml(i.name)}</a> in ${escapeHtml(i.category)}`,
          ),
        )
        .join(''),
    );
  if (sc?.removed?.length)
    list(
      'Removed sections',
      sc.removed
        .map((i) => li(`${escapeHtml(i.name)} (${escapeHtml(i.category)})`))
        .join(''),
    );
  if (ct?.added?.length)
    list(
      'New categories',
      ct.added
        .map((i) =>
          li(`<a href="${categoryUrl(site, i)}">${escapeHtml(i)}</a>`),
        )
        .join(''),
    );
  if (ct?.removed?.length)
    list(
      'Removed categories',
      ct.removed.map((i) => li(escapeHtml(i))).join(''),
    );

  if (e.pr) {
    const author = e.pr.author
      ? ` by <a href="https://github.com/${escapeHtml(e.pr.author)}">@${escapeHtml(e.pr.author)}</a>`
      : '';
    blocks.push(
      `<p>Contributed via <a href="${e.pr.url}">PR #${e.pr.number}</a>${author}.</p>`,
    );
  }

  return blocks.join('');
};

const itemLink = (e: ChangelogEntry, site: URL): string => {
  if (e.pr?.url) return e.pr.url;
  const anchor = e.sha || e.date;
  return new URL(`/changelog#${encodeURIComponent(anchor)}`, site).toString();
};

const formatDateGb = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

export async function GET(context: APIContext) {
  const site = new URL(context.site?.toString() || FALLBACK_SITE);
  const { entries } = await fetchChangelog();

  const items = entries
    .filter(hasAnyChange)
    .slice()
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, MAX_ITEMS)
    .map((e) => {
      const parts = summaryParts(e);
      const summary = parts.join(', ');
      return {
        title: `${formatDateGb(e.date)} — ${summary || 'Update'}`,
        link: itemLink(e, site),
        pubDate: new Date(e.date),
        description: summary,
        content: buildContent(e, site),
      };
    });

  return rss({
    title: 'Awesome Privacy - Changelog',
    description:
      'Latest additions, removals and updates to the directory of privacy-respecting software and services.',
    site: site.toString(),
    items,
    customData:
      '<language>en-gb</language>' +
      `<lastBuildDate>${new Date().toUTCString()}</lastBuildDate>`,
    trailingSlash: false,
  });
}
