import { fetchEnrich } from './fetch-enrich';

export const fetchRedditInfo = (
  subreddit: string,
): Promise<RedditData | null> =>
  fetchEnrich<RedditData>(
    'Reddit',
    `/v1/enrich/reddit/${subreddit}`,
    `r/${subreddit}`,
  );

interface SubredditInfo {
  name: string | null;
  title: string | null;
  description: string | null;
  longDescription: string | null;
  icon: string | null;
  banner: string | null;
  color: string | null;
  subscribers: number | null;
  activeSubscribers: number | null;
  dateCreated: number | null;
  descriptionHtml: string | null;
}

interface Post {
  title: string;
  body: string;
  upVotes: number;
  downVotes: number;
  date: number;
  url: string;
}

export interface RedditData {
  info: SubredditInfo;
  posts: Post[];
}
