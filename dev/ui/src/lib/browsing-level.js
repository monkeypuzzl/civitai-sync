// Re-export. The body is src/browsingLevel.mjs. The release zip ships that
// file and does not ship dev/. esbuild bundles the src module.

export {
  browsingLevelOf,
  BROWSING_LEVEL,
  BROWSING_LEVEL_LABELS,
  browsingLevelLabel,
  isRatingTagName,
  ratingTagLabel,
  ratingTagRank,
  ratingTokenForLevel,
  tagsWithoutRating
} from '../../../../src/browsingLevel.mjs';
