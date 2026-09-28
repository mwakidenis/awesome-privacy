type Level = 'warn' | 'error';

interface LogEntry {
  level: Level;
  source: string;
  message: string;
}

// Astro loads the config and the bundled page code as separate instances of
// this module, so the entries have to live somewhere both of them can see
const store = globalThis as typeof globalThis & { buildFetchLog?: LogEntry[] };
const entries = (store.buildFetchLog ??= []);

const MAX_SHOWN_PER_SOURCE = 5;

const plural = (count: number, noun: string) =>
  `${count} ${noun}${count === 1 ? '' : 's'}`;

export const warn = (source: string, message: string) => {
  console.warn(`[${source}] ${message}`);
  entries.push({ level: 'warn', source, message });
};

export const error = (source: string, message: string) => {
  console.error(`[${source}] ${message}`);
  entries.push({ level: 'error', source, message });
};

export const printSummary = () => {
  if (!entries.length) return;

  const grouped = new Map<string, LogEntry[]>();
  for (const entry of entries) {
    const group = grouped.get(entry.source);
    if (group) group.push(entry);
    else grouped.set(entry.source, [entry]);
  }

  console.log('\n───────────── Build fetch summary ──────────────');
  for (const [source, group] of grouped) {
    const errors = group.filter((entry) => entry.level === 'error').length;
    const warnings = group.length - errors;
    const tally = [
      ...(errors ? [plural(errors, 'error')] : []),
      ...(warnings ? [plural(warnings, 'warning')] : []),
    ];
    console.log(`[${source}] ${tally.join(', ')}`);
    for (const { level, message } of group.slice(0, MAX_SHOWN_PER_SOURCE)) {
      console.log(`  ${level.toUpperCase()}: ${message}`);
    }
    const hidden = group.length - MAX_SHOWN_PER_SOURCE;
    if (hidden > 0) console.log(`  ...and ${hidden} more`);
  }
  console.log('────────────────────────────────────────────────\n');

  entries.length = 0;
};
