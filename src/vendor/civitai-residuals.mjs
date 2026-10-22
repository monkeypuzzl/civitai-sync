// =============================================================================
// NOT GENERATED. Do not refresh this file.
//
// Retired keys a generator could still have stored, after the current
// extract dropped them. Lookups read the generated table first. A key
// that is still on the current table must not appear here.
// `node dev/tools/refresh-vendored-civitai.mjs residuals-check` exits 6
// when one does.
//
// Policy: docs/guides/civitai-sync/internal/vendored-snapshots.md
// =============================================================================

// Workflow identity records the generated table no longer has.
// Shape matches CIVITAI_WORKFLOWS values: identifier, label, category, modeLabel?.
export const WORKFLOW_RESIDUALS = Object.freeze({});

// Families, or variants of a family the current extract still has.
// A whole family is used when its id is absent. A variant is appended when
// none of its version ids sit on the current family.
export const FAMILY_RESIDUALS = Object.freeze([
  Object.freeze({
    id: 'Imagen4',
    label: 'Imagen 4',
    outputType: 'image',
    members: Object.freeze(['Imagen4']),
    variants: Object.freeze([
      Object.freeze({
        id: 'Imagen4:1889632',
        optionKey: '1889632',
        label: 'Imagen 4',
        ecosystemKeys: Object.freeze(['Imagen4']),
        versionIds: Object.freeze([1889632])
      })
    ])
  }),
  Object.freeze({
    id: 'Sora2',
    label: 'Sora 2',
    outputType: 'video',
    members: Object.freeze(['Sora2']),
    variants: Object.freeze([
      Object.freeze({
        id: 'Sora2:2320065',
        optionKey: '2320065',
        label: 'Sora 2',
        ecosystemKeys: Object.freeze(['Sora2']),
        versionIds: Object.freeze([2320065])
      })
    ])
  }),
  Object.freeze({
    id: 'OpenAI',
    label: 'OpenAI',
    outputType: 'image',
    members: Object.freeze(['OpenAI']),
    variants: Object.freeze([
      Object.freeze({
        id: 'OpenAI:1733399',
        optionKey: '1733399',
        label: 'v1',
        ecosystemKeys: Object.freeze(['OpenAI']),
        versionIds: Object.freeze([1733399])
      })
    ])
  })
]);

// baseModel string → ecosystem key, only when the current map dropped the string.
// This extract kept "Imagen4" and "Sora 2". Leave the object empty until a review drops one.
export const BASE_MODEL_RESIDUALS = Object.freeze({});

// Ecosystem key → implied model version id, only when the current map dropped the key.
// A key the current map still has, including OpenAI, stays out of this object.
export const ECOSYSTEM_VERSION_RESIDUALS = Object.freeze({
  Imagen4: 1889632,
  Sora2: 2320065
});
