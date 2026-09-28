import { fetchChangelog } from './fetch-changelog';
import { slugify } from './fetch-data';
import type { ChangelogEntry } from './fetch-changelog';

type Crumbs = Array<string | undefined>;

/**
 * Really over-complicated way to get the last modified date from changelog
 * for any given page, for the sitemap to be accurate and correct
 * (even tho no one uses the lastmod field)
 */
const listChanged = ({
  services,
  sections,
  categories,
}: ChangelogEntry['changes']): Crumbs[] => [
  ...[
    ...(services?.added || []),
    ...(services?.removed || []),
    ...(services?.modified || []),
  ].map((s) => [s.category, s.section, s.name]),
  ...[...(services?.moved || []), ...(services?.renamed || [])].flatMap((s) => [
    [s.from.category, s.from.section, s.name],
    [s.to.category, s.to.section, s.name],
  ]),
  ...[...(sections?.added || []), ...(sections?.removed || [])].map((s) => [
    s.category,
    s.name,
  ]),
  ...(sections?.moved || []).flatMap((s) => [
    [s.from.category, s.from.section],
    [s.to.category, s.to.section],
  ]),
  ...(categories?.added || []).map((c) => [c]),
  ...(categories?.removed || []).map((c) => [c]),
];

/** Every ancestor page a change touches, e.g. `/essentials/`, `/essentials/browsers/`. */
const ancestorPaths = (crumbs: Crumbs) => {
  const parts = crumbs.filter(Boolean).map((part) => slugify(part as string));
  return parts.map((_, index) => `/${parts.slice(0, index + 1).join('/')}/`);
};

/** Maps each listing page to the date its content last changed, for sitemap `lastmod`. */
export const fetchLastmod = async (): Promise<Record<string, string>> => {
  const { entries } = await fetchChangelog();
  const lastmod: Record<string, string> = {};
  entries.forEach((entry) => {
    listChanged(entry.changes)
      .flatMap(ancestorPaths)
      .forEach((path) => {
        if (!lastmod[path] || entry.date > lastmod[path]) {
          lastmod[path] = entry.date;
        }
      });
  });
  return lastmod;
};
