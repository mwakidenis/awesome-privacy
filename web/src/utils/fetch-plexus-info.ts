import { error } from './logger';
import { safeFetch } from './safe-fetch';

const extractPackage = (str: string): string =>
  str.includes('id=') ? str.split('id=')[1] : str;

const BASE = 'https://plexus.techlore.tech';
const RATINGS_LIMIT = 100;
const TOP_ROMS = 6;
const MIN_RATINGS_PER_ROM = 2;

export interface PlexusScore {
  numerator: number;
  denominator: number;
  total_count: number;
}

export interface PlexusRomSummary {
  rom_name: string;
  rating_type: 'native' | 'micro_g';
  avg: number;
  count: number;
  denominator: number;
  sources: Record<string, number>;
}

export interface PlexusInfo {
  package: string;
  name: string;
  updated_at: string;
  scores: { native?: PlexusScore; micro_g?: PlexusScore };
  roms: PlexusRomSummary[];
  androidVersions?: { min: string; max: string };
  link: string;
}

interface RawAppResponse {
  data: {
    package: string;
    name: string;
    updated_at: string;
    scores?: { native?: PlexusScore; micro_g?: PlexusScore };
  };
}

interface RawRating {
  rom_name?: string;
  rating_type: 'native' | 'micro_g';
  score: { numerator: number; denominator: number };
  installation_source?: string;
  android_version?: string;
}

interface RawRatingsResponse {
  data: RawRating[];
}

const summariseRoms = (ratings: RawRating[]): PlexusRomSummary[] => {
  const groups = new Map<
    string,
    {
      rom_name: string;
      rating_type: 'native' | 'micro_g';
      total: number;
      count: number;
      denominator: number;
      sources: Record<string, number>;
    }
  >();
  for (const r of ratings) {
    if (!r.rom_name || !r.score) continue;
    const key = `${r.rom_name}|${r.rating_type}`;
    const cur = groups.get(key);
    if (cur) {
      cur.total += r.score.numerator;
      cur.count += 1;
      if (r.installation_source)
        cur.sources[r.installation_source] =
          (cur.sources[r.installation_source] || 0) + 1;
    } else {
      const sources: Record<string, number> = {};
      if (r.installation_source) sources[r.installation_source] = 1;
      groups.set(key, {
        rom_name: r.rom_name,
        rating_type: r.rating_type,
        total: r.score.numerator,
        count: 1,
        denominator: r.score.denominator,
        sources,
      });
    }
  }
  return [...groups.values()]
    .filter((g) => g.count >= MIN_RATINGS_PER_ROM)
    .map((g) => ({
      rom_name: g.rom_name,
      rating_type: g.rating_type,
      avg: g.total / g.count,
      count: g.count,
      denominator: g.denominator,
      sources: g.sources,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, TOP_ROMS);
};

const summariseAndroidVersions = (
  ratings: RawRating[],
): { min: string; max: string } | undefined => {
  const majors = ratings
    .map((r) => parseInt(r.android_version || '', 10))
    .filter((n) => Number.isFinite(n));
  if (!majors.length) return undefined;
  return { min: String(Math.min(...majors)), max: String(Math.max(...majors)) };
};

export const fetchPlexusInfo = async (
  androidPackage: string,
): Promise<PlexusInfo | null> => {
  const pkg = extractPackage(androidPackage);
  try {
    const [appRes, ratingsRes] = await Promise.all([
      safeFetch(`${BASE}/api/v1/apps/${pkg}?scores=true`),
      safeFetch(`${BASE}/api/v1/apps/${pkg}/ratings?limit=${RATINGS_LIMIT}`),
    ]);
    if (!appRes.ok) {
      if (appRes.status !== 404) {
        error('Plexus', `HTTP ${appRes.status} for ${pkg}`);
      }
      return null;
    }
    const app: RawAppResponse = await appRes.json();
    let roms: PlexusRomSummary[] = [];
    let androidVersions: { min: string; max: string } | undefined;
    if (ratingsRes.ok) {
      const ratings: RawRatingsResponse = await ratingsRes.json();
      const data = ratings.data || [];
      roms = summariseRoms(data);
      androidVersions = summariseAndroidVersions(data);
    }
    return {
      package: app.data.package,
      name: app.data.name,
      updated_at: app.data.updated_at,
      scores: app.data.scores || {},
      roms,
      androidVersions,
      link: `https://plexus.techlore.tech/?app=${encodeURIComponent(pkg)}`,
    };
  } catch (err) {
    error('Plexus', `Network error for ${pkg}: ${err}`);
    return null;
  }
};
