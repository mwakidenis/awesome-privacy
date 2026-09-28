import * as yaml from 'js-yaml';
import { error } from './logger';
import { safeFetch } from './safe-fetch';

import type { AwesomePrivacy, Category } from '../types/Service';

const awesomePrivacyData =
  'https://raw.githubusercontent.com/Lissy93/awesome-privacy/main/awesome-privacy.yml';

export const fetchData = async (): Promise<AwesomePrivacy> => {
  try {
    const res = await safeFetch(awesomePrivacyData, {}, 15000);
    if (!res.ok) {
      error(
        'Data',
        `HTTP ${res.status} fetching awesome-privacy.yml (${awesomePrivacyData})`,
      );
      return {} as AwesomePrivacy;
    }
    const text = await res.text();
    return yaml.load(text) as AwesomePrivacy;
  } catch (err) {
    error('Data', `Failed to fetch awesome-privacy.yml: ${err}`);
    return {} as AwesomePrivacy;
  }
};

/**
 * Loads the dataset from the browser, ready for the islands who need it
 */
export const fetchCategories = async (): Promise<Category[]> => {
  try {
    const res = await fetch('/api/awesome-privacy.json');
    return (await res.json())?.categories || [];
  } catch (err) {
    error('Data', `Failed to fetch dataset: ${err}`);
    return [];
  }
};

export const slugify = (title: string) => {
  return (title || '')
    .toLowerCase()
    .replace(/\s/g, '-')
    .replace(/\+|&/g, 'and')
    .replaceAll('?', '');
};
