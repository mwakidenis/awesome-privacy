import { fetchEnrich } from './fetch-enrich';

const normalizeRepo = (github: string): string =>
  github.replace(/^https?:\/\/github\.com\//, '').replace(/\/+$/, '');

export const fetchSecurityReport = (
  github: string,
): Promise<SecurityReportResponse | null> => {
  const repo = normalizeRepo(github);
  return fetchEnrich<SecurityReportResponse>(
    'Security Report',
    `/v1/enrich/security/${repo}`,
    repo,
  );
};

export interface SecurityCheck {
  name: string;
  score: number;
  reason: string;
  url: string;
}

export interface SecurityAdvisory {
  ghsaId: string;
  cveId: string | null;
  summary: string;
  severity: string;
  cvssScore: number | null;
  publishedAt: string;
  url: string;
  firstPatchedVersion: string | null;
  vulnerableRange: string;
  isPatched: boolean;
}

export interface SecurityReportResponse {
  repo: string;
  scorecard: {
    available: boolean;
    overallScore: number | null;
    generatedAt: string;
    checks: SecurityCheck[];
  };
  advisories: {
    count: number;
    items: SecurityAdvisory[];
  };
  fuzzed: boolean;
}
