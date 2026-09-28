import { fetchEnrich } from './fetch-enrich';

const normalizeRepo = (github: string): string =>
  github.replace(/^https?:\/\/github\.com\//, '').replace(/\/+$/, '');

export const fetchGitHubStats = (
  github: string,
): Promise<GitHubStatsResponse | null> => {
  const repo = normalizeRepo(github);
  return fetchEnrich<GitHubStatsResponse>(
    'GitHub Stats',
    `/v1/enrich/github/${repo}`,
    repo,
  );
};

export interface GitHubStatsResponse {
  info: {
    ownerUsername: string;
    ownerAvatar: string;
    description: string;
    url: string;
    homepage: string;
    language: string;
    topics: string[];
    license: string;
    licenseName: string;
    isFork: boolean;
    isArchived: boolean;
    forkParent: string;
    createdAt: string;
    updatedAt: string;
    pushedAt: string;
    size: number;
    starCount: number;
    forksCount: number;
    watchersCount: number;
    openIssues: number;
  };
  languages: {
    [key: string]: number;
  };
  versions: Array<{
    name: string;
    commit: string;
    zipball: string;
    tarball: string;
  }>;
  contributors: Array<{
    username: string;
    avatar: string;
    url: string;
    contributions: number;
  }>;
  commits: Array<{
    sha: string;
    authorName: string;
    authorDate: string;
    message: string;
    authorUsername: string;
    authorAvatar: string;
  }>;
}
