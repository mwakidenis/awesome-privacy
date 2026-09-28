import { fetchEnrich } from './fetch-enrich';

export const fetchDockerData = (
  serviceName: string,
): Promise<TemplateResponse | null> =>
  fetchEnrich<TemplateResponse>(
    'Docker',
    `/v1/enrich/docker/${encodeURIComponent(serviceName)}`,
    serviceName,
    { missingIsExpected: true },
  );

export const dockerHubUrl = (image: string): string | null => {
  const segments = image.split('/');
  if (segments.length > 1 && /[.:]/.test(segments[0])) return null;
  const path = image.replace(/:[^/]*$/, '');
  const [namespace, repo] = path.includes('/')
    ? path.split('/')
    : ['library', path];
  if (!repo) return null;
  return namespace === 'library'
    ? `https://hub.docker.com/_/${repo}`
    : `https://hub.docker.com/r/${namespace}/${repo}`;
};

interface DockerTemplateEnvironmentVariable {
  name: string;
  label?: string;
  default?: string;
  description?: string;
}

interface DockerTemplateVolume {
  container: string;
  bind?: string;
  readonly?: boolean;
}

interface DockerTemplate {
  name?: string;
  title?: string;
  description?: string;
  logo?: string;
  image?: string;
  categories?: string[];
  ports?: string[];
  env?: DockerTemplateEnvironmentVariable[];
  volumes?: DockerTemplateVolume[];
  restart_policy?: string;
}

interface DockerHubData {
  user: string;
  name: string;
  namespace: string;
  repository_type: string;
  status: number;
  description: string;
  is_private: boolean;
  is_automated: boolean;
  can_edit: boolean;
  star_count: number;
  pull_count: number;
  last_updated: string;
  date_registered: string;
  build_status: string;
  permissions: {
    read: boolean;
    write: boolean;
    admin: boolean;
  };
}

interface DockerUsage {
  dockerRunCommand: string;
  dockerComposeFile: string;
}

export interface TemplateResponse {
  found: boolean;
  error: string | null;
  template?: DockerTemplate;
  dockerHubData?: DockerHubData | null;
  usage?: DockerUsage;
}
