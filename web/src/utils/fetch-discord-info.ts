import { fetchEnrich } from './fetch-enrich';

export const fetchDiscordInfo = (
  discordInvite: string,
): Promise<DiscordInfo | null> =>
  fetchEnrich<DiscordInfo>(
    'Discord',
    `/v1/enrich/discord/${discordInvite}`,
    discordInvite,
  );

export interface DiscordInfo {
  inviteCode: string;
  name: string;
  memberCount: number;
  memberOnlineCount: number;
  channel: string;
  icon: string;
  banner: string;
  inviter: string | null;
}
