# `src/vendor/` — vendored snapshots from civitai-src

Generated, committed snapshots of small upstream tables that civitai-sync needs at runtime. **Do not edit files in this directory by hand.**

## What lives here

| File | Refreshed by | Source |
|---|---|---|
| `civitai-ecosystems.mjs` | `node dev/tools/refresh-vendored-civitai.mjs ecosystems` | `civitai-src/src/shared/constants/basemodel.constants.ts` (the `ecosystems` table) |
| `orchestrator-model-map.mjs` | `node dev/tools/refresh-vendored-civitai.mjs orchestrator-model-map` | `engine.utils.ts` + `generation/version-ids.ts` + `form-graph/generation/video/wan.graph.ts` + `ecosystemSettings` defaults |
| `civitai-workflows.mjs` | `node dev/tools/refresh-vendored-civitai.mjs workflows` | `workflowConfigs`, plus five derived maps (media tokens, mode phrases, mode abbreviations, abbreviation expansions, display labels). A derivation rejection is exit 5 — [Capture failures](../../docs/guides/civitai-sync/internal/vendored-snapshots.md#capture-failures). |
| `civitai-model-families.mjs` | `node dev/tools/refresh-vendored-civitai.mjs families` | Eco groups + official version pickers + `workflowConfigs` coverage |

Each file's own header documents its source path, line range, fields read, transformation rules, and the upstream commit SHA at refresh time.

The named archetype is a **source-table snapshot (STS)**. The agent-executable protocol for adding a new artefact — flavours, shared vs artefact-specific code, isolation, probe signal, and the rule that Explorer facets are a separate change — lives in [`docs/guides/civitai-sync/internal/vendored-snapshots.md`](../../docs/guides/civitai-sync/internal/vendored-snapshots.md) § "Source-table snapshot (STS) protocol".

## Isolation policy

`src/vendor/` is one of three structurally-separated **data classes** in civitai-sync:

| Data class | Lives at | Trust contract |
|---|---|---|
| **User data** | `data/` (per-account) | Authoritative for the user's corpus, reactions, overrides |
| **API data** | `data/model-cache/` (per-account) and the in-memory caches | Authoritative for live model identity & metadata |
| **Vendored data** | `src/vendor/` (committed; same for every install) | Authoritative for display labels & structural mappings *as upstream declared them at refresh time* |

Each module imports from at most one of these classes. Specifically:

- **Files in `src/vendor/`** are imported only by their **artifact-specific lookup module** (e.g. `src/ecosystemDisplay.mjs` for `civitai-ecosystems.mjs`, `src/orchestratorModelMap.mjs` for `orchestrator-model-map.mjs`, `src/workflowVocab.mjs` for `civitai-workflows.mjs`, `src/modelFamily.mjs` for `civitai-model-families.mjs`). The lint test in `tests/vendor-isolation.test.mjs` enforces this: any other module that reaches into `src/vendor/` will fail the test.
- **Lookup modules** (e.g. `src/ecosystemDisplay.mjs`) wrap the raw vendored data and add the fallback rule (e.g. title-casing for unknown keys). Other modules call the lookup, never the raw map.

## How to refresh

When upstream evolves (Civitai ships a new base model, renames an ecosystem, etc.):

```bash
# Refresh civitai-src first, then regenerate every artifact under src/vendor/:
node dev/tools/refresh-vendored-civitai.mjs all --pull

# Or refresh just one artifact:
node dev/tools/refresh-vendored-civitai.mjs ecosystems --pull

# Verify the committed snapshot still matches upstream (no write):
node dev/tools/refresh-vendored-civitai.mjs verify

# Preview a refresh without writing:
node dev/tools/refresh-vendored-civitai.mjs ecosystems --dry-run
```

The tool prints a structural diff (added / removed entries) on every refresh so the change is reviewable before committing. Verify or `--dry-run` before the write. A removed key is reviewed under [Corpus permanence](../../docs/guides/civitai-sync/internal/vendored-snapshots.md#corpus-permanence): current Civitai definitions ship, and a token the generator could have stored on a generation stays resolvable. This machine's library is not that test. The refresh tool replaces the file and does not keep retired keys.

## Refresh triggers

See [`docs/guides/civitai-sync/internal/vendored-snapshots.md`](../../docs/guides/civitai-sync/internal/vendored-snapshots.md) for the full set of triggers and the per-artifact specifications. Common ones:

- A user reports an unfamiliar ecosystem rendering as a lowercase technical key (means a refresh is overdue).
- The data shape probe surfaces a previously-unseen AIR URN ecosystem segment.
- Release prep: `node dev/tools/refresh-vendored-civitai.mjs verify` flags drift.
- Quarterly cadence backstop.

## Adding a new vendored artifact

Follow the **STS protocol** in [`docs/guides/civitai-sync/internal/vendored-snapshots.md`](../../docs/guides/civitai-sync/internal/vendored-snapshots.md) § "Source-table snapshot (STS) protocol" (eleven steps: data class → flavour → canonical declaration → identity/fields → shared vs specific → register → generate → lookup → tests → document → **stop**). Do not add Explorer facets, URL params, or FacetBar chrome as part of creating the artefact. The driver in `dev/tools/refresh-vendored-civitai.mjs` is shared; extractors, lookup modules, and lookup tests are artefact-specific.
