// Zod schemas plus inferred types, single source of truth
import { z } from '@hono/zod-openapi'

export const ServiceSchema = z
  .object({
    name: z.string(),
    url: z.string(),
    description: z.string().optional(),
    icon: z.string().optional(),
    github: z.string().optional(),
    followWith: z.string().optional(),
    securityAudited: z.boolean().optional(),
    openSource: z.boolean().optional(),
    acceptsCrypto: z.boolean().optional(),
    tosdrId: z.union([z.number(), z.string()]).optional(),
    androidApp: z.string().optional(),
    iosApp: z.string().optional(),
    subreddit: z.string().optional(),
    discordInvite: z.string().optional(),
  })
  .openapi('Service')

export const FlatServiceSchema = ServiceSchema.extend({
  slug: z.string(),
  category: z.string(),
  categorySlug: z.string(),
  section: z.string(),
  sectionSlug: z.string(),
}).openapi('FlatService')

export const SectionSchema = z
  .object({
    name: z.string(),
    slug: z.string(),
    intro: z.string().optional(),
    furtherInfo: z.string().optional(),
    wordOfWarning: z.string().optional(),
    alternativeTo: z.array(z.string()).optional(),
    services: z.array(ServiceSchema),
  })
  .openapi('Section')

export const CategorySchema = z
  .object({
    name: z.string(),
    slug: z.string(),
    sections: z.array(z.object({ name: z.string(), slug: z.string() })),
  })
  .openapi('Category')

export const PaginationSchema = z
  .object({
    page: z.number(),
    limit: z.number(),
    total: z.number(),
    hasMore: z.boolean(),
  })
  .openapi('Pagination')

export const ErrorSchema = z
  .object({
    error: z.object({
      code: z.enum([
        'NOT_FOUND',
        'BAD_REQUEST',
        'UNAUTHORIZED',
        'RATE_LIMITED',
        'UPSTREAM_ERROR',
        'INTERNAL',
      ]),
      message: z.string(),
      status: z.number(),
    }),
  })
  .openapi('Error')

export const Envelope = <T extends z.ZodTypeAny>(data: T) => z.object({ data })

export const ListEnvelope = <T extends z.ZodTypeAny>(item: T) =>
  z.object({
    data: z.array(item),
    pagination: PaginationSchema,
  })

export const StatsSchema = z
  .object({
    categories: z.number(),
    sections: z.number(),
    services: z.number(),
    openSource: z.number(),
    securityAudited: z.number(),
    acceptsCrypto: z.number(),
  })
  .openapi('Stats')

export const HealthSchema = z
  .object({
    status: z.literal('ok'),
    uptime: z.number(),
  })
  .openapi('Health')

export const SearchHitSchema = z
  .object({
    slug: z.string(),
    name: z.string(),
    url: z.string(),
    description: z.string().optional(),
    category: z.string(),
    categorySlug: z.string(),
    section: z.string(),
    sectionSlug: z.string(),
    score: z.number(),
  })
  .openapi('SearchHit')

// 200 response cell builder, keeps routes free of repetitive content wiring
export const Ok = (schema: z.ZodTypeAny) => ({
  description: 'OK',
  content: { 'application/json': { schema } },
})

// Shared error response, reused across every route that declares errors
export const ErrorResponse = {
  description: 'Error',
  content: { 'application/json': { schema: ErrorSchema } },
}

// Enrichment passthroughs, upstream shapes are wide so we don't enumerate every field
export const TosdrServiceSchema = z
  .object({})
  .openapi('TosdrService', { description: 'ToS;DR v3 service record, passthrough' })

export const ItunesAppSchema = z
  .object({})
  .openapi('ItunesApp', { description: 'iTunes lookup result, passthrough' })

export const AndroidReportSchema = z.object({}).openapi('AndroidReport', {
  description:
    'Exodus Privacy trackers merged with Plexus de-Googled compatibility (degoogled)',
})

export const WebsiteReportSchema = z
  .object({})
  .openapi('WebsiteReport', { description: 'APIVoid url reputation report, passthrough' })

export const DockerInfoSchema = z.object({}).openapi('DockerInfo', {
  description: 'Portainer template, Docker Hub metrics and generated run/compose usage',
})

// GitHub repo summary, shape is fixed by the mapper functions
export const GithubRepoSchema = z
  .object({
    info: z.object({
      ownerUsername: z.string(),
      ownerAvatar: z.string(),
      description: z.string(),
      url: z.string(),
      homepage: z.string(),
      language: z.string(),
      topics: z.array(z.string()),
      license: z.string(),
      licenseName: z.string(),
      isFork: z.boolean(),
      isArchived: z.boolean(),
      forkParent: z.string(),
      createdAt: z.string(),
      updatedAt: z.string(),
      pushedAt: z.string(),
      size: z.number(),
      starCount: z.number(),
      forksCount: z.number(),
      watchersCount: z.number(),
      openIssues: z.number(),
    }),
    languages: z.record(z.number()),
    versions: z.array(
      z.object({
        name: z.string(),
        commit: z.string(),
        zipball: z.string(),
        tarball: z.string(),
      }),
    ),
    contributors: z.array(
      z.object({
        username: z.string(),
        avatar: z.string(),
        url: z.string(),
        contributions: z.number(),
      }),
    ),
    commits: z.array(
      z.object({
        sha: z.string(),
        authorName: z.string(),
        authorDate: z.string(),
        message: z.string(),
        authorUsername: z.string(),
        authorAvatar: z.string(),
      }),
    ),
  })
  .openapi('GithubRepo')

// Repo security report, merges deps.dev scorecard with GitHub advisories
export const SecurityReportSchema = z
  .object({
    repo: z.string(),
    scorecard: z.object({
      available: z.boolean(),
      overallScore: z.number().nullable(),
      generatedAt: z.string(),
      checks: z.array(
        z.object({
          name: z.string(),
          score: z.number(),
          reason: z.string(),
          url: z.string(),
        }),
      ),
    }),
    advisories: z.object({
      count: z.number(),
      items: z.array(
        z.object({
          ghsaId: z.string(),
          cveId: z.string().nullable(),
          summary: z.string(),
          severity: z.string(),
          cvssScore: z.number().nullable(),
          publishedAt: z.string(),
          url: z.string(),
          firstPatchedVersion: z.string().nullable(),
          vulnerableRange: z.string(),
          isPatched: z.boolean(),
        }),
      ),
    }),
    fuzzed: z.boolean(),
  })
  .openapi('SecurityReport')

export const DiscordInviteSchema = z
  .object({
    inviteCode: z.string().nullable(),
    name: z.string().nullable(),
    memberCount: z.number().nullable(),
    memberOnlineCount: z.number().nullable(),
    channel: z.string().nullable(),
    icon: z.string().nullable(),
    banner: z.string().nullable(),
    inviter: z.string().nullable(),
  })
  .openapi('DiscordInvite')

export const SubredditSchema = z
  .object({
    info: z.object({
      name: z.string().nullable(),
      title: z.string().nullable(),
      description: z.string().nullable(),
      longDescription: z.string().nullable(),
      icon: z.string().nullable(),
      banner: z.string().nullable(),
      color: z.string().nullable(),
      subscribers: z.number().nullable(),
      activeSubscribers: z.number().nullable(),
      dateCreated: z.number().nullable(),
      descriptionHtml: z.string().nullable(),
    }),
    posts: z.array(
      z.object({
        title: z.string(),
        body: z.string(),
        upVotes: z.number(),
        downVotes: z.number(),
        date: z.number(),
        url: z.string(),
      }),
    ),
  })
  .openapi('Subreddit')
