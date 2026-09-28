/**
 * Loads the pre-build awesome-privacy JSON data
 * Exposes it as both flat and nested structure
 * Used by all public routes which use this data
 */

import raw from '@/generated/data.json'
import type { AwesomePrivacy, Category, Section, Service, FlatService } from '@/types'

const data = raw as unknown as AwesomePrivacy

// Turn any listing/section/category name into a URL-safe slug
export const slugify = (input: string) =>
  input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

// Returns a given listing by it's name
export const findBySlug = <T extends { name: string }>(items: T[], slug: string) =>
  items.find((item) => slugify(item.name) === slug)

let flatCache: FlatService[] | null = null

// Flatten every service with its parent category and section attached
export const allServices = (): FlatService[] => {
  if (flatCache) return flatCache
  const out: FlatService[] = []
  for (const category of data.categories) {
    for (const section of category.sections) {
      for (const service of section.services ?? []) {
        out.push({
          ...service,
          slug: slugify(service.name),
          category: category.name,
          categorySlug: slugify(category.name),
          section: section.name,
          sectionSlug: slugify(section.name),
        })
      }
    }
  }
  flatCache = out
  return out
}

// Top-level list of categories from the source data
export const categories = (): Category[] => data.categories

// Resolve a category by its slug
export const findCategory = (slug: string) => findBySlug(categories(), slug)

interface SectionHit {
  category: Category
  section: Section
}

// Look up a section by slug across every category, returning its parent too
export const findSection = (slug: string): SectionHit | null => {
  for (const category of categories()) {
    const section = findBySlug(category.sections, slug)
    if (section) return { category, section }
  }
  return null
}

// Resolve a single service by its slug from the flat list
export const findService = (slug: string): FlatService | undefined =>
  allServices().find((service) => service.slug === slug)

// Aggregate counts for all data, used for stats endpoint
export const stats = () => {
  const services = allServices()
  return {
    categories: categories().length,
    sections: categories().reduce((total, cat) => total + cat.sections.length, 0),
    services: services.length,
    openSource: services.filter((service) => service.openSource).length,
    securityAudited: services.filter((service) => service.securityAudited).length,
    acceptsCrypto: services.filter((service) => service.acceptsCrypto).length,
  }
}

export type { Service, Section, Category }
