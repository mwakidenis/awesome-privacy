import { fetchEnrich } from './fetch-enrich';

const extractPackage = (str: string): string =>
  str.includes('id=') ? str.split('id=')[1] : str;

export const fetchAndroidInfo = (
  androidPackage: string,
): Promise<AndroidInfo | null> =>
  fetchEnrich<AndroidInfo>(
    'Android',
    `/v1/enrich/android/${extractPackage(androidPackage)}`,
    androidPackage,
  );

interface Tracker {
  id: number;
  name: string;
  description: string;
  creation_date: string;
  code_signature: string;
  network_signature: string;
  website: string;
  categories: string[];
  documentation: string[];
}

export interface AndroidInfo {
  error?: string;
  handle: string;
  app_name: string;
  uaid: string;
  version_name: string;
  version_code: string;
  source: string;
  icon_hash: string;
  apk_hash: string;
  created: string;
  updated: string;
  report: number;
  creator: string;
  downloads: string;
  trackers: Tracker[];
  permissions: string[];
}
