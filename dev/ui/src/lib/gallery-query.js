// Wire query for the Generations, Posts, and Comics galleries.
// FacetBar writes URL state. useGalleryData fetches this object.
// `usedAsInput` is true or null: false is not a constraint.
// `toQuery` turns true into `1`. View-specific fields (publication, title)
// arrive in `extra`. Mine is a term inside `models`.

export function galleryRequestQuery (state, extra = {}) {
  const s = state || {};
  const more = { ...(extra && typeof extra === 'object' ? extra : {}) };
  delete more.mine;
  delete more.usedAsInput;
  return {
    tag: s.tag,
    postTag: s.postTag,
    rating: s.rating,
    reaction: s.reaction,
    q: s.q,
    sort: s.sort,
    mediaType: s.mediaType,
    models: s.models,
    aspect: s.aspect,
    dateFrom: s.dateFrom,
    dateTo: s.dateTo,
    cfgMin: s.cfgMin,
    cfgMax: s.cfgMax,
    stepsMin: s.stepsMin,
    stepsMax: s.stepsMax,
    usedAsInput: s.usedAsInput === true ? true : null,
    workflow: s.workflow,
    workflowMode: s.workflowMode,
    groupBy: s.groupBy,
    groupSort: s.groupSort,
    granularity: s.granularity,
    ...more
  };
}
