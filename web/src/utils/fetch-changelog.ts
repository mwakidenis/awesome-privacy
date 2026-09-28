import { error } from './logger';
import { safeFetch } from './safe-fetch';

const changelogUrl =
  'https://raw.githubusercontent.com/Lissy93/awesome-privacy/main/.github/changelog.json';
// 'https://gist.githubusercontent.com/Lissy93/ddae176f3f21a0d3c0251f5f6cbd3b09/raw/9e62d21ea8866709520331dd2ec6a67494460707/changelog.json';

export interface ChangelogPr {
  number: number;
  url: string;
  author?: string;
  authorAvatar?: string;
}

export interface ServiceChange {
  name: string;
  category: string;
  section: string;
  fields?: string[];
}

export interface ServiceMoved {
  name: string;
  from: { category: string; section: string };
  to: { category: string; section: string };
}

export interface SectionMoved {
  from: { category: string; section: string };
  to: { category: string; section: string };
}

export interface ServiceRenamed {
  previousName: string;
  name: string;
  from: { category: string; section: string };
  to: { category: string; section: string };
}

export interface ChangelogEntry {
  date: string;
  sha: string;
  pr?: ChangelogPr | null;
  changes: {
    services?: {
      added?: ServiceChange[];
      removed?: ServiceChange[];
      modified?: ServiceChange[];
      moved?: ServiceMoved[];
      renamed?: ServiceRenamed[];
    };
    sections?: {
      added?: { name: string; category: string }[];
      removed?: { name: string; category: string }[];
      moved?: SectionMoved[];
    };
    categories?: {
      added?: string[];
      removed?: string[];
    };
  };
}

export interface Rejection {
  date: string;
  title: string;
  pr: ChangelogPr;
}

export interface Changelog {
  generatedAt: string;
  entries: ChangelogEntry[];
  rejections?: Rejection[];
}

export const fetchChangelog = async (): Promise<Changelog> => {
  try {
    const res = await safeFetch(changelogUrl);
    if (!res.ok) {
      error('Changelog', `HTTP ${res.status} fetching changelog.json`);
      return { generatedAt: '', entries: [] };
    }
    const data: Changelog = await res.json();
    return data;
  } catch (err) {
    error('Changelog', `Failed to fetch changelog.json: ${err}`);
    return { generatedAt: '', entries: [] };
  }
};
