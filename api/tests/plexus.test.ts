// Unit tests for Plexus de-Googled rating aggregation
import { describe, it, expect } from 'vitest'
import { summarizeRatings, type PlexusRating } from '@/lib/plexus'

const r = (type: string, num: number): PlexusRating => ({
  rating_type: type,
  score: { numerator: num, denominator: 4 },
})

describe('summarizeRatings', () => {
  it('maps perfect native scores to gold', () => {
    const out = summarizeRatings([r('native', 4), r('native', 4)])
    expect(out.native).toMatchObject({
      available: true,
      status: 'gold',
      score: 4,
      ratings: 2,
    })
    expect(out.microg).toEqual({ available: false })
  })

  it('grades silver, bronze and broken by average score', () => {
    expect(summarizeRatings([r('native', 3)]).native).toMatchObject({ status: 'silver' })
    expect(summarizeRatings([r('native', 2)]).native).toMatchObject({ status: 'bronze' })
    expect(summarizeRatings([r('native', 1)]).native).toMatchObject({ status: 'broken' })
  })

  it('separates native from micro_g ratings', () => {
    const out = summarizeRatings([r('native', 4), r('micro_g', 2)])
    expect(out.native).toMatchObject({ status: 'gold', ratings: 1 })
    expect(out.microg).toMatchObject({ status: 'bronze', ratings: 1 })
  })

  it('marks a type unavailable when it has no ratings', () => {
    expect(summarizeRatings([]).native).toEqual({ available: false })
  })

  it('ignores ratings with a missing or zero score', () => {
    const bad = [
      { rating_type: 'native' },
      { rating_type: 'native', score: { denominator: 0 } },
    ]
    expect(summarizeRatings(bad as PlexusRating[]).native).toEqual({ available: false })
  })
})
