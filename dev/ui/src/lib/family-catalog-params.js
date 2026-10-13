// Params for the model-page family crumb. The router drops empty values,
// so the address is `/models?family={id}` and a version page's
// modelVersionId does not ride along.

export function familyCatalogParams (familyId) {
  return {
    resourceType: [],
    family: [String(familyId)],
    variant: [],
    modelVersionId: '',
    mine: null,
    sort: '',
    familyId: ''
  };
}
