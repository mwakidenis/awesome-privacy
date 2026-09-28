// Discord invite info, projected to a compact response shape
import { createRoute, z } from '@hono/zod-openapi'
import { fetchJson } from '@/lib/fetch'
import { freshSeconds } from '@/lib/cache/freshness'
import { newApp } from '@/lib/openapi'
import { DiscordInviteSchema, ErrorResponse, Ok } from '@/schemas'

const app = newApp()

const FRESH_TTL = freshSeconds('discord')

interface Invite {
  code?: string
  guild?: { id?: string; name?: string; icon?: string; splash?: string }
  channel?: { name?: string }
  inviter?: { global_name?: string }
  approximate_member_count?: number
  approximate_presence_count?: number
}

const iconUrl = (guildId?: string, icon?: string) =>
  guildId && icon ? `https://cdn.discordapp.com/icons/${guildId}/${icon}.webp` : null

const bannerUrl = (guildId?: string, splash?: string) =>
  guildId && splash
    ? `https://cdn.discordapp.com/splashes/${guildId}/${splash}.webp?size=1024`
    : null

const route = createRoute({
  method: 'get',
  path: '/enrich/discord/{invite}',
  tags: ['Enrichment'],
  summary: 'Discord server info',
  request: { params: z.object({ invite: z.string().min(4) }) },
  responses: {
    200: Ok(DiscordInviteSchema),
    400: ErrorResponse,
    401: ErrorResponse,
    500: ErrorResponse,
    502: ErrorResponse,
  },
})

// Hit Discord invite endpoint, return the small fields the site needs
app.openapi(route, async (c) => {
  const { invite } = c.req.valid('param')
  const headers: Record<string, string> = {}
  if (c.env.DISCORD_BOT_TOKEN) {
    headers.Authorization = `Bot ${c.env.DISCORD_BOT_TOKEN}`
  }
  const upstream =
    `https://discord.com/api/v9/invites/${encodeURIComponent(invite)}` +
    '?with_counts=true&with_expiration=true'
  const data = await c.var.storage.fetch(`discord:${invite}`, FRESH_TTL, async () => {
    const raw = await fetchJson<Invite>(upstream, { headers })
    const guild = raw.guild
    return {
      inviteCode: raw.code ?? null,
      name: guild?.name ?? null,
      memberCount: raw.approximate_member_count ?? null,
      memberOnlineCount: raw.approximate_presence_count ?? null,
      channel: raw.channel?.name ?? null,
      icon: iconUrl(guild?.id, guild?.icon),
      banner: bannerUrl(guild?.id, guild?.splash),
      inviter: raw.inviter?.global_name ?? null,
    }
  })
  return c.json(data, 200)
})

export default app
