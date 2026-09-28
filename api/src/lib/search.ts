/**
 * Full-text search over every service in the awesome-privacy dataset
 * Builds a MiniSearch index lazily on first call, then reuses it
 * Used for the public /search endpoint and MCP search_services tool
 */

import MiniSearch from 'minisearch'
import { allServices } from '@/lib/data'
import type { FlatService } from '@/types'

type Indexed = FlatService & { id: string }

let index: MiniSearch<Indexed> | null = null

const STORED_FIELDS = [
  'slug',
  'name',
  'url',
  'description',
  'category',
  'categorySlug',
  'section',
  'sectionSlug',
]

const build = () => {
  // Service slugs repeat across sections, so build a composite id
  const items: Indexed[] = allServices().map((service) => ({
    ...service,
    id: `${service.sectionSlug}/${service.slug}`,
  }))
  const ms = new MiniSearch<Indexed>({
    idField: 'id',
    fields: ['name', 'description', 'category', 'section'],
    storeFields: STORED_FIELDS,
    searchOptions: { boost: { name: 3, section: 1.5 }, fuzzy: 0.2, prefix: true },
  })
  ms.addAll(items)
  return ms
}

export const search = (query: string, limit = 20) => {
  index ??= build()
  return index.search(query).slice(0, limit)
}
