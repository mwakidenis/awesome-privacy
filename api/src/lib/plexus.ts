/**
 * Aggregates Plexus crowdsourced ratings into de-Googled compatibility status.
 * Each rating scores an app out of 4, native is no-microG and micro_g is with it.
 * Scores map to gold (flawless), silver, bronze (limited) and broken.
 */

export interface PlexusRating {
  rating_type?: string
  score?: { numerator?: number; denominator?: number }
}

const statusFor = (ratio: number) =>
  ratio >= 0.875
    ? 'gold'
    : ratio >= 0.625
      ? 'silver'
      : ratio >= 0.375
        ? 'bronze'
        : 'broken'

// Mean the matching scores into a status summary, or mark the type unavailable
const summarize = (ratings: PlexusRating[], type: string) => {
  const ratios: number[] = []
  for (const r of ratings) {
    const num = r.score?.numerator
    const den = r.score?.denominator
    if (
      r.rating_type === type &&
      typeof num === 'number' &&
      typeof den === 'number' &&
      den > 0
    ) {
      ratios.push(num / den)
    }
  }
  if (ratios.length === 0) return { available: false as const }
  const ratio = ratios.reduce((sum, x) => sum + x, 0) / ratios.length
  return {
    available: true as const,
    status: statusFor(ratio),
    score: Math.round(ratio * 40) / 10,
    ratings: ratios.length,
  }
}

export const summarizeRatings = (ratings: PlexusRating[]) => ({
  native: summarize(ratings, 'native'),
  microg: summarize(ratings, 'micro_g'),
})
