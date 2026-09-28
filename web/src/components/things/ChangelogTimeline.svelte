<script lang="ts">
  import type {
    ChangelogEntry,
    ServiceChange,
    Rejection,
    ChangelogPr,
  } from '../../utils/fetch-changelog';
  import { slugify } from '@utils/fetch-data';

  interface Props {
    entries?: ChangelogEntry[];
    rejections?: Rejection[];
  }
  const { entries = [], rejections = [] }: Props = $props();

  type Filter = 'added' | 'removed' | 'modified' | 'rejected';

  const filterDefs: { key: Filter; label: string; icon: string }[] = [
    { key: 'added', label: 'Additions', icon: '+' },
    { key: 'removed', label: 'Removals', icon: '−' },
    { key: 'modified', label: 'Amendments', icon: '✎' },
    { key: 'rejected', label: 'Rejections', icon: '✕' },
  ];

  let on: Record<Filter, boolean> = $state({
    added: true,
    removed: true,
    modified: true,
    rejected: true,
  });
  let searchQuery = $state('');

  const MAX_VISIBLE_CHANGES = 8;
  let expanded: Record<string, boolean> = $state({});

  function toggle(key: Filter) {
    on = { ...on, [key]: !on[key] };
  }

  function toggleExpanded(sha: string) {
    expanded = { ...expanded, [sha]: !expanded[sha] };
  }

  type TimelineItem =
    | {
        kind: 'entry';
        date: string;
        sha: string;
        pr?: ChangelogPr | null;
        data: ChangelogEntry;
      }
    | {
        kind: 'rejection';
        date: string;
        sha: string;
        pr: ChangelogPr;
        data: Rejection;
      };

  const svc = (e: ChangelogEntry) => {
    const s = e.changes?.services;
    return {
      added: s?.added || [],
      removed: s?.removed || [],
      modified: s?.modified || [],
      moved: s?.moved || [],
      renamed: s?.renamed || [],
    };
  };
  const sec = (e: ChangelogEntry) => {
    const s = e.changes?.sections;
    return {
      added: s?.added || [],
      removed: s?.removed || [],
      moved: s?.moved || [],
    };
  };
  const cat = (e: ChangelogEntry) => {
    const c = e.changes?.categories;
    return { added: c?.added || [], removed: c?.removed || [] };
  };

  function matchesFilters(
    item: TimelineItem,
    f: Record<Filter, boolean>,
  ): boolean {
    if (item.kind === 'rejection') return f.rejected;
    const s = svc(item.data),
      sc = sec(item.data),
      ct = cat(item.data);
    return (
      (f.added &&
        (s.added.length > 0 || sc.added.length > 0 || ct.added.length > 0)) ||
      (f.removed &&
        (s.removed.length > 0 ||
          sc.removed.length > 0 ||
          ct.removed.length > 0)) ||
      (f.modified &&
        (s.modified.length > 0 ||
          s.moved.length > 0 ||
          s.renamed.length > 0 ||
          sc.moved.length > 0))
    );
  }

  function matchesSearch(item: TimelineItem, query: string): boolean {
    if (!query) return true;
    const q = query.toLowerCase();
    if (item.kind === 'rejection') {
      return (
        item.data.title.toLowerCase().includes(q) ||
        (item.pr.author?.toLowerCase().includes(q) ?? false)
      );
    }
    const s = svc(item.data);
    const all = [
      ...s.added,
      ...s.removed,
      ...s.modified,
      ...s.moved.flatMap((m) => [
        { name: m.name, category: m.from.category, section: m.from.section },
        { name: m.name, category: m.to.category, section: m.to.section },
      ]),
      ...s.renamed.flatMap((m) => [
        {
          name: m.previousName,
          category: m.from.category,
          section: m.from.section,
        },
        { name: m.name, category: m.to.category, section: m.to.section },
      ]),
    ];
    return (
      all.some(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          `${c.category} ${c.section}`.toLowerCase().includes(q),
      ) ||
      (item.pr?.author?.toLowerCase().includes(q) ?? false)
    );
  }

  const pl = (n: number, word: string) => `${n} ${word}${n > 1 ? 's' : ''}`;

  function summarize(entry: ChangelogEntry): string {
    const s = svc(entry),
      sc = sec(entry);
    const parts: string[] = [];
    if (s.added.length) parts.push(pl(s.added.length, 'addition'));
    if (s.removed.length) parts.push(pl(s.removed.length, 'removal'));
    if (s.modified.length) parts.push(pl(s.modified.length, 'amendment'));
    if (s.moved.length) parts.push(pl(s.moved.length, 'move'));
    if (s.renamed.length) parts.push(pl(s.renamed.length, 'rename'));
    if (sc.added.length) parts.push(pl(sc.added.length, 'new section'));
    if (sc.removed.length) parts.push(pl(sc.removed.length, 'section removal'));
    if (sc.moved.length) parts.push(pl(sc.moved.length, 'section rename'));
    return parts.join(', ') || 'Changes';
  }

  function serviceLink(s: ServiceChange, isRemoval: boolean): string {
    const c = slugify(s.category),
      sc = slugify(s.section);
    return isRemoval ? `/${c}/${sc}/` : `/${c}/${sc}/${slugify(s.name)}/`;
  }

  type ChangeRow = {
    badge: string;
    cls: string;
    name: string;
    href: string;
    path?: string;
    fields?: string[];
  };

  function changeRows(e: ChangelogEntry): ChangeRow[] {
    const s = svc(e),
      sc = sec(e),
      ct = cat(e);
    return [
      ...s.added.map((v) => ({
        badge: 'Added',
        cls: 'add',
        name: v.name,
        href: serviceLink(v, false),
        path: `into ${v.category} › ${v.section}`,
      })),
      ...s.removed.map((v) => ({
        badge: 'Removed',
        cls: 'rem',
        name: v.name,
        href: serviceLink(v, true),
        path: `from ${v.category} › ${v.section}`,
      })),
      ...s.modified.map((v) => ({
        badge: 'Amended',
        cls: 'mod',
        name: v.name,
        href: serviceLink(v, false),
        path: `in ${v.category} › ${v.section}`,
        fields: v.fields,
      })),
      ...s.moved.map((v) => ({
        badge: 'Moved',
        cls: 'mod',
        name: v.name,
        href: serviceLink(
          { name: v.name, category: v.to.category, section: v.to.section },
          false,
        ),
        path: `from ${v.from.category} › ${v.from.section} → ${v.to.category} › ${v.to.section}`,
      })),
      ...s.renamed.map((v) => {
        const sameLoc =
          v.from.category === v.to.category && v.from.section === v.to.section;
        return {
          badge: 'Renamed',
          cls: 'mod',
          name: `${v.previousName} → ${v.name}`,
          href: serviceLink(
            { name: v.name, category: v.to.category, section: v.to.section },
            false,
          ),
          path: sameLoc
            ? `in ${v.to.category} › ${v.to.section}`
            : `from ${v.from.category} › ${v.from.section} → ${v.to.category} › ${v.to.section}`,
        };
      }),
      ...sc.added.map((v) => ({
        badge: 'New Section',
        cls: 'add',
        name: v.name,
        href: `/${slugify(v.category)}/${slugify(v.name)}/`,
      })),
      ...sc.removed.map((v) => ({
        badge: 'Section Removed',
        cls: 'rem',
        name: v.name,
        href: '',
      })),
      ...sc.moved.map((v) => ({
        badge: 'Section Renamed',
        cls: 'mod',
        name: `${v.from.section} → ${v.to.section}`,
        href: `/${slugify(v.to.category)}/${slugify(v.to.section)}/`,
        path:
          v.from.category === v.to.category
            ? `in ${v.to.category}`
            : `from ${v.from.category} to ${v.to.category}`,
      })),
      ...ct.added.map((v) => ({
        badge: 'New Category',
        cls: 'add',
        name: v,
        href: '',
      })),
      ...ct.removed.map((v) => ({
        badge: 'Category Removed',
        cls: 'rem',
        name: v,
        href: '',
      })),
    ];
  }

  const allItems = $derived(
    [
      ...entries.map((e): TimelineItem => ({
        kind: 'entry',
        date: e.date,
        sha: e.sha,
        pr: e.pr,
        data: e,
      })),
      ...rejections.map((r): TimelineItem => ({
        kind: 'rejection',
        date: r.date,
        sha: `rej-${r.pr.number}`,
        pr: r.pr,
        data: r,
      })),
    ].sort((a, b) => b.date.localeCompare(a.date)),
  );

  const filtered = $derived(
    allItems.filter(
      (item) => matchesFilters(item, on) && matchesSearch(item, searchQuery),
    ),
  );

  const grouped = $derived(
    filtered.reduce<Record<string, TimelineItem[]>>((acc, item) => {
      const d = new Date(item.date + 'T00:00:00Z');
      const key = d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        timeZone: 'UTC',
      });
      (acc[key] ??= []).push(item);
      return acc;
    }, {}),
  );

  function formatDate(dateStr: string): string {
    return new Date(dateStr + 'T00:00:00Z').toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    });
  }
</script>

<details class="controls">
  <summary>Search &amp; Filter</summary>
  <div class="controls-body">
    <input
      class="search"
      type="search"
      aria-label="Filter changes by service, category or user"
      placeholder="Filter by service, category, user.."
      bind:value={searchQuery}
    />
    <div class="filters">
      {#each filterDefs as f (f.key)}
        <button
          class="pill {f.key}"
          class:active={on[f.key]}
          aria-pressed={on[f.key]}
          onclick={() => toggle(f.key)}
        >
          <span class="icon">{f.icon}</span>{f.label}
        </button>
      {/each}
    </div>
  </div>
</details>

<p class="sr-only" role="status">
  Showing {filtered.length} of {allItems.length} entries
</p>

{#if filtered.length === 0}
  <p class="empty">No matching changes found.</p>
{/if}

{#each Object.entries(grouped) as [month, monthItems] (month)}
  <h2 class="month-header">{month}</h2>
  {#each monthItems as item (item.sha)}
    <article class="entry">
      <time class="entry-date">{formatDate(item.date)}</time>
      <div class="entry-body">
        <div class="summary">
          {#if item.pr?.authorAvatar}
            <a
              href={`https://github.com/${item.pr.author}`}
              target="_blank"
              rel="noreferrer"
              aria-hidden="true"
              tabindex="-1"
            >
              <img
                class="avatar"
                src={item.pr.authorAvatar}
                alt=""
                width="20"
                height="20"
                loading="lazy"
              />
            </a>
          {/if}
          {#if item.pr?.author}
            <span class="author"
              ><a
                href={`https://github.com/${item.pr.author}`}
                target="_blank"
                rel="noreferrer">@{item.pr.author}</a
              ></span
            >
          {/if}
          <span class="summary-text">
            {item.kind === 'rejection'
              ? 'Submission Reviewed'
              : summarize(item.data)}
          </span>
          {#if item.pr}
            <a
              class="pr-link"
              href={item.pr.url}
              target="_blank"
              rel="noreferrer">#{item.pr.number}</a
            >
          {/if}
        </div>

        <div class="changes">
          {#if item.kind === 'rejection'}
            <div class="change">
              <span class="badge rej">Rejected</span>
              <a
                class="svc-name"
                href={item.pr.url}
                target="_blank"
                rel="noreferrer">{item.data.title}</a
              >
              <span class="path">Not merged</span>
            </div>
          {:else}
            {@const rows = changeRows(item.data)}
            {@const overflow = rows.length - MAX_VISIBLE_CHANGES}
            {@const isOpen = !!expanded[item.sha]}
            {#each rows.slice(0, MAX_VISIBLE_CHANGES) as row, i (i)}
              {@render change(row)}
            {/each}
            {#if overflow > 0}
              <div
                class="extra"
                class:open={isOpen}
                id={`changes-${item.sha}`}
                inert={!isOpen}
              >
                <div>
                  {#each rows.slice(MAX_VISIBLE_CHANGES) as row, i (i)}
                    {@render change(row)}
                  {/each}
                </div>
              </div>
              <button
                class="show-more"
                aria-expanded={isOpen}
                aria-controls={`changes-${item.sha}`}
                onclick={() => toggleExpanded(item.sha)}
              >
                {isOpen ? 'Show less' : `+${overflow} more`}
              </button>
            {/if}
          {/if}
        </div>
      </div>
    </article>
  {/each}
{/each}

{#snippet change(row: ChangeRow)}
  <div class="change">
    <span class="badge {row.cls}">{row.badge}</span>
    {#if row.href}
      <a class="svc-name" href={row.href}>{row.name}</a>
    {:else}
      <strong>{row.name}</strong>
    {/if}
    {#if row.fields}<span class="fields">updated {row.fields.join(', ')}</span
      >{/if}
    {#if row.path && !row.fields}<span class="path">{row.path}</span>{/if}
  </div>
{/snippet}

<style lang="scss">
  @use '../../styles/mixins' as *;
  .controls {
    margin-bottom: var(--space-md);

    summary {
      cursor: pointer;
      width: fit-content;
      font-family: var(--font-subtitle);
      opacity: var(--opacity-muted);
      &:hover {
        opacity: 1;
      }
    }

    .controls-body {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: var(--space-md);
      margin-top: var(--space-sm);
    }

    .search {
      width: 200px;
      padding: 0.35rem 0.75rem;
      border: var(--border-heavy);
      border-radius: var(--curve-lg);
      box-shadow: var(--shadow-xs);
      background: var(--surface);
      color: var(--foreground);
      &:focus {
        outline: none;
        border-color: var(--accent);
        box-shadow: 2px 2px 0 var(--accent);
      }
      &::placeholder {
        opacity: var(--opacity-dim);
      }
    }

    .filters {
      display: flex;
      gap: 0.3rem;
      flex-wrap: wrap;
    }

    .pill {
      display: flex;
      align-items: center;
      gap: var(--space-xs);
      min-height: 24px;
      padding: 0.15rem var(--space-sm);
      border: 1px solid transparent;
      border-radius: var(--curve-md);
      background: var(--background);
      color: var(--foreground);
      cursor: pointer;
      font-family: var(--font-subtitle);
      font-size: var(--text-xs);
      opacity: var(--opacity-dim);
      transition: var(--transition-normal);

      .icon {
        font-size: var(--text-sm);
        line-height: 1;
      }
      &.active {
        opacity: 1;
        border-color: currentColor;
      }
      &.added {
        &.active {
          color: var(--changelog-add);
        }
        &:hover {
          background: color-mix(in srgb, var(--changelog-add) 10%, transparent);
        }
      }
      &.removed {
        &.active {
          color: var(--changelog-rem);
        }
        &:hover {
          background: color-mix(in srgb, var(--changelog-rem) 10%, transparent);
        }
      }
      &.modified {
        &.active {
          color: var(--changelog-mod);
        }
        &:hover {
          background: color-mix(in srgb, var(--changelog-mod) 10%, transparent);
        }
      }
      &.rejected {
        &.active {
          color: var(--changelog-rej);
        }
        &:hover {
          background: color-mix(in srgb, var(--changelog-rej) 10%, transparent);
        }
      }
    }
  }

  .empty {
    text-align: center;
    opacity: var(--opacity-muted);
    margin: var(--space-lg) 0;
  }

  .month-header {
    font-size: var(--text-lg);
    margin: 1.5rem 0 var(--space-sm) 0;
    padding-bottom: 0.3rem;
    border-bottom: 1px solid var(--accent-3);
    color: var(--accent-3-text);
    font-family: var(--font-subtitle);
  }

  .entry {
    display: flex;
    gap: var(--space-md);
    padding: 0.6rem 0;
    border-bottom: 1px solid var(--background-hr-color);
    &:last-child {
      border-bottom: none;
    }

    .entry-date {
      min-width: 7rem;
      opacity: 0.75;
      padding-top: 0.15rem;
      font-family: var(--font-subtitle);
    }

    .entry-body {
      flex: 1;
      min-width: 0;
    }
  }

  .summary {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    flex-wrap: wrap;
    margin-bottom: 0.3rem;
    font-size: var(--text-sm);
    opacity: var(--opacity-subtle);
    .author a {
      color: var(--foreground);
      &:hover {
        color: var(--accent-text);
      }
    }
    .avatar {
      border-radius: 50%;
    }
    .pr-link {
      padding: 0 0.4rem;
      border-radius: var(--curve-sm);
      background: var(--accent-3);
      color: var(--bright);
      text-decoration: none;
      font-family: var(--font-subtitle);
      &:hover {
        opacity: 0.85;
      }
    }
  }

  .changes {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    .change {
      display: flex;
      align-items: baseline;
      gap: 0.4rem;
      flex-wrap: wrap;
    }
  }

  .extra {
    display: grid;
    grid-template-rows: 0fr;
    transition: var(--transition-normal);
    &.open {
      grid-template-rows: 1fr;
    }
    > div {
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
      overflow: hidden;
    }
  }

  .show-more {
    align-self: flex-start;
    min-height: 24px;
    margin-top: 0.2rem;
    padding: 0.1rem var(--space-sm);
    border: 1px solid currentColor;
    border-radius: var(--curve-md);
    background: none;
    color: var(--accent-3-text);
    cursor: pointer;
    font-family: var(--font-subtitle);
    font-size: var(--text-xs);
    transition: var(--transition-normal);
    &:hover {
      background: color-mix(in srgb, var(--accent-3) 15%, transparent);
    }
  }

  .badge {
    @include changelog-badge;
    &.add {
      background: color-mix(in srgb, var(--changelog-add) 33%, transparent);
      color: var(--changelog-add);
    }
    &.rem {
      background: color-mix(in srgb, var(--changelog-rej) 33%, transparent);
      color: var(--changelog-rej);
    }
    &.mod {
      background: color-mix(in srgb, var(--changelog-mod) 33%, transparent);
      color: var(--changelog-mod);
    }
    &.rej {
      background: color-mix(in srgb, var(--changelog-rem) 33%, transparent);
      color: var(--changelog-rem);
    }
  }

  .svc-name {
    font-weight: 500;
    color: var(--foreground);
    text-decoration: none;
  }
  a.svc-name:hover {
    color: var(--accent-text);
    text-decoration: underline;
  }

  .path,
  .fields {
    font-size: var(--text-sm);
    opacity: var(--opacity-muted);
  }
  .fields {
    font-style: italic;
  }

  @media (max-width: 768px) {
    .entry {
      flex-direction: column;
      gap: 0.2rem;
      .entry-date {
        min-width: unset;
      }
    }
  }
</style>
