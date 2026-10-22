import {
  modelTypeLabel
} from "./chunk-XQGXV6CL.js";
import {
  formatUrl,
  parseUrl
} from "./chunk-CPLX52FD.js";

// dev/ui/src/lib/modelSlug.js
function slugForName(name) {
  if (name == null) return "";
  return String(name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
function pathToken(id, name) {
  const slug = slugForName(name);
  return slug ? `${id}-${slug}` : String(id);
}
function idFromToken(token) {
  const m = String(token ?? "").match(/^(\d+)/);
  return m ? m[1] : null;
}

// dev/ui/src/lib/detail-resources.js
var UNKNOWN_NAMES = /* @__PURE__ */ new Set(["", "(unknown)"]);
function lineName(r) {
  const n = r?.modelName;
  if (typeof n === "string" && !UNKNOWN_NAMES.has(n)) return n;
  return "";
}
function versionSubtitle(name, version) {
  if (typeof version !== "string" || !version) return "";
  if (name && version === name) return "";
  return version;
}
function isPrimaryResource(r, checkpoint) {
  if (!r || !checkpoint) return false;
  if (r === checkpoint) return true;
  const cv = checkpoint.versionId;
  const rv = r.versionId;
  if (cv != null && cv !== "" && rv != null && rv !== "") {
    return String(cv) === String(rv);
  }
  if (r.type === "Checkpoint" && checkpoint.type === "Checkpoint") {
    const cn = lineName(checkpoint);
    const rn = lineName(r);
    if (cn && cn === rn && (cv == null || cv === "") && (rv == null || rv === "")) {
      return true;
    }
  }
  return false;
}
function resourceTypeLabel(type) {
  if (!type) return "";
  return modelTypeLabel(type) || type;
}
function modelsTypeHref(type) {
  if (type == null || type === "") return "";
  return formatUrl({
    view: "models",
    params: { resourceType: String(type) }
  });
}
function modelSectionHref(rows, soleHref) {
  if (!soleHref) return "";
  const list = Array.isArray(rows) ? rows : [];
  if (list.some((row) => row && row.mine)) return "";
  const linkAt = list.findIndex((row) => row && row.href);
  if (linkAt < 0) return soleHref;
  for (let i = 0; i <= linkAt; i++) {
    const row = list[i];
    if (row && row.typeHref) return "";
  }
  return soleHref;
}
function modelsVersionHref(r) {
  if (!r || typeof r !== "object") return "";
  const type = r.type;
  const modelId = r.modelId;
  const versionId = r.versionId;
  if (!type) return "";
  if (modelId == null || modelId === "") return "";
  if (versionId == null || versionId === "") return "";
  const name = lineName(r);
  return formatUrl({
    view: "models",
    entityId: pathToken(modelId, name),
    params: { modelVersionId: String(versionId) }
  });
}
function resourceForVersion(versionId, checkpoint, resources) {
  const list = [];
  if (checkpoint && typeof checkpoint === "object") list.push(checkpoint);
  if (Array.isArray(resources)) {
    for (const r of resources) {
      if (r && typeof r === "object") list.push(r);
    }
  }
  return list.find((r) => r.versionId != null && r.versionId !== "" && String(r.versionId) === versionId) || null;
}
function modelsOriginReturnHref({ versionId, sort, checkpoint, resources, familyId } = {}) {
  const withSort = (href) => {
    if (!href) return "";
    if (sort == null || sort === "" || String(sort) === "date:desc") return href;
    const parsed = parseUrl(href);
    return formatUrl({
      view: parsed.view,
      entityId: parsed.entityId,
      modelTrail: parsed.modelTrail,
      params: { ...parsed.params, sort: String(sort) }
    });
  };
  if (versionId != null && versionId !== "") {
    return withSort(modelsVersionHref(resourceForVersion(String(versionId), checkpoint, resources)));
  }
  if (familyId == null || familyId === "") return "";
  return withSort(formatUrl({ view: "models", params: { familyId: String(familyId) } }));
}
function generatorFamilyModelBlock(family) {
  if (!family || !family.id || !family.label) return null;
  return {
    name: family.label,
    version: "",
    href: formatUrl({ view: "models", params: { familyId: String(family.id) } }),
    versionId: ""
  };
}
function additionalRow(r) {
  const name = lineName(r);
  const version = versionSubtitle(name, r.versionName || "");
  const fallback = r.versionId != null ? `Version ${r.versionId}` : "";
  const displayName = name || fallback;
  if (!displayName && !version && !r.type) return null;
  const strength = typeof r.strength === "number" && r.strength !== 1 ? r.strength : null;
  return {
    name: displayName,
    version,
    type: r.type || "",
    typeLabel: resourceTypeLabel(r.type),
    typeHref: modelsTypeHref(r.type),
    strength,
    href: modelsVersionHref(r),
    versionId: r.versionId != null && r.versionId !== "" ? String(r.versionId) : "",
    mine: r.mine === true
  };
}
function composeDetailResources({ checkpoint, resources, model } = {}) {
  const list = Array.isArray(resources) ? resources.filter((r) => r && typeof r === "object") : [];
  const primary = checkpoint && typeof checkpoint === "object" ? checkpoint : null;
  let modelOut = null;
  if (primary) {
    const name = lineName(primary);
    const version = versionSubtitle(name, primary.versionName || "");
    if (name || version) {
      modelOut = {
        name: name || version,
        version: name ? version : "",
        href: modelsVersionHref(primary),
        versionId: primary.versionId != null && primary.versionId !== "" ? String(primary.versionId) : "",
        mine: primary.mine === true,
        type: primary.type || "",
        typeLabel: resourceTypeLabel(primary.type),
        typeHref: modelsTypeHref(primary.type)
      };
    }
  } else if (typeof model === "string" && model && !UNKNOWN_NAMES.has(model)) {
    modelOut = { name: model, version: "", href: "", versionId: "" };
  }
  const additional = [];
  for (const r of list) {
    if (isPrimaryResource(r, primary)) continue;
    const row = additionalRow(r);
    if (row) additional.push(row);
  }
  return { model: modelOut, additional };
}
function containerResourceKey(row) {
  if (row?.versionId != null && row.versionId !== "") return `v:${String(row.versionId)}`;
  const name = typeof row?.name === "string" ? row.name.trim() : "";
  if (name) return `n:${name}`;
  return "";
}
function unionContainerResources(members) {
  const seen = /* @__PURE__ */ new Set();
  const rows = [];
  const list = Array.isArray(members) ? members : [];
  for (const member of list) {
    const { model, additional } = composeDetailResources({
      checkpoint: member?.checkpoint,
      resources: member?.resources,
      model: member?.model
    });
    const itemRows = [];
    if (model) itemRows.push({ kind: "model", strength: null, ...model });
    for (const resource of additional) {
      itemRows.push({ kind: "additional", ...resource, strength: null });
    }
    for (const row of itemRows) {
      const key = containerResourceKey(row);
      if (key && seen.has(key)) continue;
      if (key) seen.add(key);
      rows.push({ ...row, key: key || `anon:${rows.length}` });
    }
  }
  return rows;
}

export {
  pathToken,
  idFromToken,
  modelsTypeHref,
  modelSectionHref,
  modelsOriginReturnHref,
  generatorFamilyModelBlock,
  composeDetailResources,
  unionContainerResources
};
