import { fetchEnrich } from './fetch-enrich';

// Wrap the flat ToS;DR v3 record in the shape the app already consumes.
export const fetchTosdrPrivacy = async (
  serviceId: string,
): Promise<PrivacyPolicyResponse | null> => {
  const parameters = await fetchEnrich<Params>(
    'ToS;DR',
    `/v1/enrich/privacy/${serviceId}`,
    `service ${serviceId}`,
  );
  return parameters && { error: 0, message: '', parameters };
};

interface Document {
  id: number;
  name: string;
  url: string;
  updated_at: string;
  created_at: string;
}

interface Case {
  id: number;
  weight: number;
  title: string;
  description: string;
  updated_at: string;
  created_at: string;
  topic_id: number;
  classification: string;
}

interface Point {
  id: number;
  title: string;
  source: string;
  status: string;
  analysis: string;
  case: Case;
  document_id: number | null;
  updated_at: string;
  created_at: string;
}

interface Params {
  id: number;
  is_comprehensively_reviewed: boolean;
  name: string;
  updated_at: string;
  created_at: string;
  slug: string;
  rating: string;
  urls: string[];
  image: string;
  documents: Document[];
  points: Point[];
}

export interface PrivacyPolicyResponse {
  error: number;
  message: string;
  parameters: Params;
}
