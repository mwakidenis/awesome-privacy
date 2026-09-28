import * as yaml from 'js-yaml';
import { error } from './logger';
import { safeFetch } from './safe-fetch';

import type { AwesomePrivacy } from '../types/Service';

export interface LineNumberRange {
  start: number;
  end: number;
}

export interface ServiceSource {
  lineNumbers: LineNumberRange | null;
  yaml: string;
}

export type LineNumberData = Record<
  string,
  Record<string, Record<string, ServiceSource>>
>;

const awesomePrivacyYamlPath =
  'https://raw.githubusercontent.com/Lissy93/awesome-privacy/main/awesome-privacy.yml';

const isServiceEnd = (line: string) =>
  line.trim().length === 0 ||
  line.startsWith('  - ') ||
  line.includes('- name:') ||
  line.includes('notableMentions:') ||
  line.includes('furtherInfo:') ||
  line.includes('wordOfWarning:');

const findServiceRange = (
  serviceName: string,
  yamlLines: string[],
  from: number,
): LineNumberRange | null => {
  const offset = yamlLines
    .slice(from)
    .findIndex((line) => line.trim() === `- name: ${serviceName}`);
  if (offset === -1) return null;

  const start = from + offset + 1;
  const endOffset = yamlLines.slice(start).findIndex(isServiceEnd);
  return {
    start,
    end: endOffset === -1 ? yamlLines.length : start + endOffset,
  };
};

const makeResults = (
  yamlObject: AwesomePrivacy,
  yamlLines: string[],
): LineNumberData => {
  const results: LineNumberData = {};
  let cursor = 0;
  (yamlObject.categories || []).forEach((category) => {
    results[category.name] = {};
    (category.sections || []).forEach((section) => {
      results[category.name][section.name] = {};
      (section.services || []).forEach((service) => {
        const lineNumbers = findServiceRange(service.name, yamlLines, cursor);
        if (lineNumbers) cursor = lineNumbers.start;
        results[category.name][section.name][service.name] = {
          lineNumbers,
          yaml: yaml.dump(service),
        };
      });
    });
  });
  return results;
};

const buildLineNumbers = async (): Promise<LineNumberData> => {
  try {
    const res = await safeFetch(awesomePrivacyYamlPath, {}, 15000);
    if (!res.ok) {
      error('Data', `HTTP ${res.status} fetching awesome-privacy.yml`);
      return {};
    }
    const text = await res.text();
    return makeResults(yaml.load(text) as AwesomePrivacy, text.split('\n'));
  } catch (err) {
    error('Data', `Failed to build line numbers: ${err}`);
    return {};
  }
};

let cached: Promise<LineNumberData> | null = null;

export const fetchLineNumbers = (): Promise<LineNumberData> =>
  (cached ??= buildLineNumbers());

export const fetchServiceSources = async (
  categoryName: string,
  sectionName: string,
): Promise<Record<string, ServiceSource>> =>
  (await fetchLineNumbers())[categoryName]?.[sectionName] ?? {};
