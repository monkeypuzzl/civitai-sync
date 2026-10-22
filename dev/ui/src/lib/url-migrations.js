// Registry of URL-protocol migrations. See
// docs/guides/civitai-sync/explorer-url-protocol.md § Versioning.
//
// Each entry brings a URL from `_v=from` to `_v=to`. The runner walks the
// registry in order; a state whose `v` is already at or above an entry's
// `to` is left untouched. `_v=1` URLs (missing `_v` floors to 1) walk
// every later entry in order.
//
// Adding a migration is a four-step change:
//   1. Append a `{ from, to, migrate }` entry to `migrations` below.
//   2. Bump `CURRENT_PROTOCOL_VERSION`.
//   3. Document the change in explorer-url-protocol.md § Versioning.
//   4. Add a unit test covering the migration in tests/url-state.test.mjs.
//
// Each migration receives the structured `UrlState` (as produced by
// `parseUrl`) and returns a new `UrlState`. Migrations may mutate the
// returned object freely as long as they don't alias the input. They MUST
// set `state.v` to their own `to` value so the runner knows the work is
// done.

import { isRatingTagName } from './browsing-level.js';
import { stringLiftQuery } from '../../../../src/modelsQuery.mjs';

export const CURRENT_PROTOCOL_VERSION = 6;

function liftRatingParams (params) {
  const next = { ...(params || {}) };
  const parts = String(next.tag || '').split(',').map(s => s.trim()).filter(Boolean);
  if (!parts.length) return next;
  const tags = [];
  const lifted = [];
  for (const part of parts) {
    const key = part.toLowerCase();
    if (isRatingTagName(part)) lifted.push(key);
    else tags.push(part);
  }
  if (!lifted.length) return next;
  const existing = String(next.rating || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  const seen = new Set();
  const merged = [];
  for (const token of [...existing, ...lifted]) {
    if (seen.has(token)) continue;
    seen.add(token);
    merged.push(token);
  }
  next.rating = merged.join(',');
  if (tags.length) next.tag = tags.join(',');
  else delete next.tag;
  return next;
}

function leadingId (token) {
  const m = String(token ?? '').match(/^(\d+)/);
  return m ? m[1] : null;
}

export const migrations = [
  {
    // _v=1 → _v=2 (Phase 3): the legacy sort tokens `newest` / `oldest`
    // become the protocol's `<field>:<direction>` form. Left unmigrated, a
    // bare `sort=oldest` bookmark would silently resolve as newest-first —
    // a semantic flip, hence the version bump (see
    // explorer-url-protocol.md § Versioning). All other params pass through.
    from: 1,
    to: 2,
    migrate (state) {
      const params = { ...state.params };
      if (params.sort === 'newest') params.sort = 'date:desc';
      else if (params.sort === 'oldest') params.sort = 'date:asc';
      return { ...state, params, v: 2 };
    }
  },
  {
    // _v=2 → _v=3: Models catalog + model page. Old type/ecosystem/model/version
    // path folders become `/models/{modelId}-{slug}?modelVersionId=` (or
    // catalog query params for type/ecosystem interiors). `e.` scope terms
    // are not rewritten (lossy).
    from: 2,
    to: 3,
    migrate (state) {
      if (state.view !== 'models') {
        return { ...state, v: 3 };
      }
      const trail = Array.isArray(state.modelTrail) ? state.modelTrail : [];
      const params = { ...state.params };
      if (trail.length >= 4) {
        const verId = leadingId(trail[3]);
        if (verId) params.modelVersionId = verId;
        return { ...state, entityId: trail[2], modelTrail: null, params, v: 3 };
      }
      if (trail.length === 3) {
        return { ...state, entityId: trail[2], modelTrail: null, params, v: 3 };
      }
      if (trail.length === 2) {
        params.resourceType = trail[0];
        params.ecosystem = trail[1];
        return { ...state, entityId: null, modelTrail: null, params, v: 3 };
      }
      if (trail.length === 1) {
        params.resourceType = trail[0];
        return { ...state, entityId: null, modelTrail: null, params, v: 3 };
      }
      return { ...state, modelTrail: null, v: 3 };
    }
  },
  {
    // _v=3 → _v=4: Publication key rename. Posts/Comics used `status=` and
    // `groupBy=status`; Generations already used `publication=`. Copy
    // leftover `status` onto `publication` when publication is absent, then
    // drop `status`. `groupBy=status` becomes `groupBy=publication`.
    from: 3,
    to: 4,
    migrate (state) {
      const params = { ...state.params };
      const hasPublication = params.publication != null && params.publication !== '';
      const hasStatus = params.status != null && params.status !== '';
      if (!hasPublication && hasStatus) params.publication = params.status;
      delete params.status;
      if (params.groupBy === 'status') params.groupBy = 'publication';
      return { ...state, params, v: 4 };
    }
  },
  {
    // _v=4 → _v=5: Rating is the image browsing-level bit, not a content-tag
    // name. Ladder tokens move from tag= to rating=. Other tag values stay.
    // A URL already at _v=5 is untouched, including one that still names a
    // ladder word as a content tag.
    from: 4,
    to: 5,
    migrate (state) {
      return { ...state, params: liftRatingParams(state.params), v: 5 };
    }
  },
  {
    // _v=5 → _v=6: gallery model filters are one `models` term list.
    // Media type is mediaType. Model type is resourceType. mine=1 is a
    // mine term. The source is the v6.0.0 keys. A type. segment is not
    // rewritten. The models catalog keeps its own keys. A URL already at
    // _v=6 is untouched.
    from: 5,
    to: 6,
    migrate (state) {
      return { ...state, params: stringLiftQuery(state.params, { view: state.view }), v: 6 };
    }
  }
];

export function applyMigrations (state) {
  if (!state) return state;
  let current = state;
  for (const m of migrations) {
    const cv = current.v == null ? 1 : current.v;
    if (cv >= m.to) continue;
    current = m.migrate(current);
  }
  return current;
}
