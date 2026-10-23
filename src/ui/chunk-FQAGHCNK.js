import {
  getWorkflowAbbreviationExpansion,
  getWorkflowDisplayLabel,
  getWorkflowModeAbbreviation,
  getWorkflowModePhrase
} from "./chunk-TQWSKHC6.js";
import {
  modelSectionHref
} from "./chunk-QOFOVBU3.js";
import {
  MemoMediaTile
} from "./chunk-M6EGXWFI.js";
import {
  formatUrl,
  navigate
} from "./chunk-K4YW4PKR.js";
import {
  k,
  u
} from "./chunk-GOKE7NMO.js";

// dev/ui/src/lib/sidebar-links.js
var KIND_WORD = { post: "Post", comic: "Comic" };
var LINK_BASE = "\u{1F517} On Civitai";
var SEP = " \xB7 ";
function mediaNoun(type) {
  if (type === "image" || type === "video" || type === "audio") return type;
  return "media";
}
function downloadTitle(type) {
  return `Download ${mediaNoun(type)}`;
}
function mediaFileCopy({ count, types, comicFolder } = {}) {
  if (!(count >= 1)) return null;
  if (comicFolder && count > 1) {
    return { label: "Media files", title: "Open comic media folder" };
  }
  if (count === 1) {
    const noun = mediaNoun(Array.isArray(types) ? types[0] : types);
    return {
      label: "Media file",
      title: `Open Media folder, with ${noun} file selected`
    };
  }
  return { label: "Media files", title: "Open Media folder" };
}
function civitaiInstanceLabels(items) {
  if (!Array.isArray(items) || items.length === 0) return [];
  const multi = items.length > 1;
  const kinds = new Set(items.map((i) => i && i.kind).filter(Boolean));
  const mixed = kinds.size > 1;
  return items.map((item) => {
    const parts = [LINK_BASE];
    if (multi && mixed) {
      const word = KIND_WORD[item.kind];
      if (word) parts.push(word);
      if (item.date) parts.push(item.date);
    } else if (multi && item.date) {
      parts.push(item.date);
    }
    return parts.join(SEP);
  });
}
function postAccessChips(availability) {
  if (availability === "Private") return ["Private"];
  if (availability === "EarlyAccess") return ["Early Access"];
  return [];
}
function comicPublication(statuses) {
  if (!Array.isArray(statuses) || statuses.length === 0) return "draft";
  const rank = { published: 3, scheduled: 2, draft: 1 };
  let best = "draft";
  for (const raw of statuses) {
    const key = String(raw || "draft").toLowerCase();
    const norm = rank[key] ? key : "draft";
    if (rank[norm] > rank[best]) best = norm;
  }
  return best;
}
function comicAccessChips(chapters, now = Date.now()) {
  const chips = [];
  let hasPrivate = false;
  let hasEarly = false;
  for (const ch of chapters || []) {
    if (!ch) continue;
    if (ch.availability === "Private") hasPrivate = true;
    if (ch.availability === "EarlyAccess" && ch.earlyAccessEndsAt) {
      const t = new Date(ch.earlyAccessEndsAt).getTime();
      if (Number.isFinite(t) && t > now) hasEarly = true;
    }
  }
  if (hasPrivate) chips.push("Private");
  if (hasEarly) chips.push("Early Access");
  return chips;
}

// dev/ui/src/components/SidebarSections.jsx
function onModelsLinkClick(e, href) {
  if (!href) return;
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
  e.preventDefault();
  e.stopPropagation();
  navigate(href);
}
function inputTileType(kind) {
  if (kind === "video") return "video";
  if (kind === "audio") return "audio";
  return "image";
}
function RelatedStrip({ title, items, hrefFor, captionFor, countHref, count, onCountClick }) {
  if (!items.length) return null;
  return /* @__PURE__ */ u("div", { class: "meta-section", children: [
    /* @__PURE__ */ u("h2", { class: "meta-label", children: [
      title,
      countHref ? /* @__PURE__ */ u(k, { children: [
        " ",
        /* @__PURE__ */ u("a", { class: "used-in-count", href: countHref, onClick: onCountClick, children: count })
      ] }) : null
    ] }),
    /* @__PURE__ */ u("div", { class: "detail-related", children: items.map((inp, i) => {
      const type = inputTileType(inp.kind || inp.type);
      const href = hrefFor(inp);
      return /* @__PURE__ */ u("div", { children: [
        /* @__PURE__ */ u(
          MemoMediaTile,
          {
            compact: true,
            href,
            item: {
              id: inp.id,
              type,
              hasInputs: false,
              inputKinds: [],
              media: [{
                mediaId: inp.id,
                type,
                thumbnailPath: inp.thumbnailPath,
                coverPath: inp.coverPath,
                tags: []
              }]
            },
            onActivate: (e) => onModelsLinkClick(e, href)
          }
        ),
        /* @__PURE__ */ u("div", { class: "detail-related-role", children: captionFor(inp, i) })
      ] }, `${inp.id}:${inp.role || ""}:${inp.slot ?? ""}`);
    }) })
  ] });
}
function resourceTitle(name, version) {
  return [name, version].filter(Boolean).join(" \xB7 ");
}
function ResourceIdentityBody({ name, version, title }) {
  return /* @__PURE__ */ u("div", { class: "resource-identity one-line", title: title || void 0, children: [
    name ? /* @__PURE__ */ u("span", { class: "resource-name", children: name }) : null,
    name && version ? /* @__PURE__ */ u("span", { class: "resource-sep", children: " \xB7 " }) : null,
    version ? /* @__PURE__ */ u("span", { class: "resource-version", children: version }) : null
  ] });
}
function ResourceIdentity({ name, version, href, showTitle = true }) {
  const inner = /* @__PURE__ */ u(ResourceIdentityBody, { name, version });
  if (!href) return inner;
  return /* @__PURE__ */ u(
    "a",
    {
      class: "meta-resource-link",
      href,
      title: showTitle ? resourceTitle(name, version) : void 0,
      onClick: (e) => onModelsLinkClick(e, href),
      children: inner
    }
  );
}
function resourceTypeChip(resource) {
  if (resource?.typeHref) {
    return /* @__PURE__ */ u(
      "a",
      {
        class: "resource-type",
        href: resource.typeHref,
        onClick: (e) => onModelsLinkClick(e, resource.typeHref),
        children: resource.typeLabel
      }
    );
  }
  if (resource?.typeLabel) {
    return /* @__PURE__ */ u("span", { class: "resource-type", children: resource.typeLabel });
  }
  return null;
}
function AdditionalResource({ resource, mode }) {
  const linked = mode === "link";
  const modeClass = mode === "target" ? " meta-sole-target" : mode === "plain" ? " meta-sole-plain" : "";
  return /* @__PURE__ */ u("div", { class: `resource-item${modeClass}`, children: [
    /* @__PURE__ */ u("div", { class: "resource-item-main", children: [
      linked ? /* @__PURE__ */ u(ResourceIdentity, { name: resource.name, version: resource.version, href: resource.href }) : /* @__PURE__ */ u(
        ResourceIdentityBody,
        {
          name: resource.name,
          version: resource.version,
          title: mode === "target" ? resourceTitle(resource.name, resource.version) : ""
        }
      ),
      resourceTypeChip(resource),
      resource.mine && /* @__PURE__ */ u(
        "a",
        {
          class: "resource-type",
          href: "/models?mine=1",
          onClick: (e) => onModelsLinkClick(e, "/models?mine=1"),
          children: "Mine"
        }
      )
    ] }),
    resource.strength != null && /* @__PURE__ */ u("span", { class: "resource-strength", children: [
      "Strength: ",
      resource.strength
    ] })
  ] });
}
function membershipRows(modelBlock, additional, rows) {
  if (Array.isArray(rows)) return rows.filter(Boolean);
  const list = [];
  if (modelBlock) list.push({ kind: "model", strength: null, ...modelBlock, key: "model" });
  (additional || []).forEach((resource, i) => {
    list.push({
      kind: "additional",
      ...resource,
      key: resource.href || `${resource.name}:${resource.version}:${i}`
    });
  });
  return list;
}
function isClassicMembership(rows) {
  let models = 0;
  let modelAt = -1;
  rows.forEach((row, i) => {
    if (row.kind !== "model") return;
    models += 1;
    if (modelAt < 0) modelAt = i;
  });
  return models === 0 || models === 1 && modelAt === 0;
}
function modelRowBody(row, mode) {
  const linked = mode === "link" && row.href;
  if (linked) {
    return /* @__PURE__ */ u(ResourceIdentity, { name: row.name, version: row.version, href: row.href });
  }
  const isTarget = mode === "target";
  return /* @__PURE__ */ u(
    ResourceIdentityBody,
    {
      name: row.name,
      version: row.version,
      title: isTarget ? resourceTitle(row.name, row.version) : ""
    }
  );
}
function rowRuns(rows) {
  const runs = [];
  let buf = [];
  const flush = () => {
    if (!buf.length) return;
    runs.push(buf);
    buf = [];
  };
  for (const row of rows) {
    if (row.kind === "model") {
      flush();
      runs.push([row]);
    } else {
      buf.push(row);
    }
  }
  flush();
  return runs;
}
function renderMembershipRuns(rows, mode) {
  const target = mode === "sole" ? rows[rows.length - 1] : null;
  return rowRuns(rows).map((run) => {
    const head = run[0];
    if (head.kind === "model") {
      const rowMode = mode === "sole" ? head === target ? "target" : "plain" : mode;
      const valueClass = rowMode === "target" ? "meta-value meta-sole-target" : rowMode === "plain" ? "meta-value meta-sole-plain" : "meta-value";
      return /* @__PURE__ */ u("div", { class: valueClass, children: /* @__PURE__ */ u("div", { class: "resource-item-main", children: [
        modelRowBody(head, rowMode === "plain" ? "text" : rowMode === "target" ? "target" : "link"),
        mode !== "sole" ? resourceTypeChip(head) : null,
        head.mine && /* @__PURE__ */ u(
          "a",
          {
            class: "resource-type",
            href: "/models?mine=1",
            onClick: (e) => onModelsLinkClick(e, "/models?mine=1"),
            children: "Mine"
          }
        )
      ] }) }, head.key || head.versionId || head.name);
    }
    return /* @__PURE__ */ u("div", { class: "meta-resources", children: run.map((row) => {
      let resourceMode = "text";
      if (mode === "link") resourceMode = row.href ? "link" : "text";
      else if (mode === "sole") resourceMode = row === target ? "target" : "plain";
      return /* @__PURE__ */ u(
        AdditionalResource,
        {
          resource: row,
          mode: resourceMode
        },
        row.key || row.href || `${row.name}:${row.version}`
      );
    }) }, head.key || head.href || head.name);
  });
}
function MixedModelMembership({ rows, soleHref, sectionClass }) {
  if (!soleHref) {
    return /* @__PURE__ */ u("div", { class: sectionClass, children: [
      /* @__PURE__ */ u("h2", { class: "meta-label", children: "Model" }),
      renderMembershipRuns(rows, "link")
    ] });
  }
  const linkAt = rows.findIndex((row) => row.href);
  const inside = rows.slice(0, linkAt + 1);
  const outside = rows.slice(linkAt + 1);
  return /* @__PURE__ */ u("div", { class: sectionClass, children: [
    /* @__PURE__ */ u(
      "a",
      {
        class: "meta-sole-link",
        href: soleHref,
        onClick: (e) => onModelsLinkClick(e, soleHref),
        children: [
          /* @__PURE__ */ u("h2", { class: "meta-label meta-label-link", children: "Model" }),
          renderMembershipRuns(inside, "sole")
        ]
      }
    ),
    outside.length > 0 ? renderMembershipRuns(outside, "text") : null
  ] });
}
function ModelMembership({ modelBlock, additional, rows, soleHref, sectionClass }) {
  const list = membershipRows(modelBlock, additional, rows);
  if (!list.length) return null;
  const href = modelSectionHref(list, soleHref);
  if (!isClassicMembership(list)) {
    return /* @__PURE__ */ u(
      MixedModelMembership,
      {
        rows: list,
        soleHref: href,
        sectionClass
      }
    );
  }
  const classicModel = list[0]?.kind === "model" ? list[0] : null;
  const classicAdditional = list.filter((row) => row.kind === "additional");
  return /* @__PURE__ */ u(
    ClassicModelMembership,
    {
      modelBlock: classicModel,
      additional: classicAdditional,
      soleHref: href,
      sectionClass
    }
  );
}
function ClassicModelMembership({ modelBlock, additional, soleHref, sectionClass }) {
  if (!soleHref) {
    return /* @__PURE__ */ u("div", { class: sectionClass, children: [
      /* @__PURE__ */ u("h2", { class: "meta-label", children: "Model" }),
      modelBlock && /* @__PURE__ */ u("div", { class: "meta-value", children: /* @__PURE__ */ u("div", { class: "resource-item-main", children: [
        /* @__PURE__ */ u(
          ResourceIdentity,
          {
            name: modelBlock.name,
            version: modelBlock.version,
            href: modelBlock.href
          }
        ),
        resourceTypeChip(modelBlock),
        modelBlock.mine && /* @__PURE__ */ u(
          "a",
          {
            class: "resource-type",
            href: "/models?mine=1",
            onClick: (e) => onModelsLinkClick(e, "/models?mine=1"),
            children: "Mine"
          }
        )
      ] }) }),
      additional.length > 0 && /* @__PURE__ */ u("div", { class: "meta-resources", children: additional.map((resource, i) => /* @__PURE__ */ u(
        AdditionalResource,
        {
          resource,
          mode: resource.href ? "link" : "text"
        },
        resource.href || `${resource.name}:${resource.version}:${i}`
      )) })
    ] });
  }
  const rows = [];
  if (modelBlock) rows.push({ kind: "model", resource: modelBlock, key: "model" });
  additional.forEach((resource, i) => {
    rows.push({
      kind: "additional",
      resource,
      key: resource.href || `${resource.name}:${resource.version}:${i}`
    });
  });
  const linkAt = rows.findIndex((row) => row.resource.href);
  const target = rows[linkAt];
  const before = rows.slice(0, linkAt);
  const after = rows.slice(linkAt + 1);
  const leadingModel = before[0]?.kind === "model" ? before[0] : null;
  const beforeAdditionals = before.filter((row) => row.kind === "additional");
  const insideAdditionals = target.kind === "additional" ? [...beforeAdditionals, target] : beforeAdditionals;
  return /* @__PURE__ */ u("div", { class: sectionClass, children: [
    /* @__PURE__ */ u(
      "a",
      {
        class: "meta-sole-link",
        href: soleHref,
        onClick: (e) => onModelsLinkClick(e, soleHref),
        children: [
          /* @__PURE__ */ u("h2", { class: "meta-label meta-label-link", children: "Model" }),
          leadingModel && /* @__PURE__ */ u("div", { class: "meta-value meta-sole-plain", children: /* @__PURE__ */ u(
            ResourceIdentityBody,
            {
              name: leadingModel.resource.name,
              version: leadingModel.resource.version
            }
          ) }),
          target.kind === "model" && /* @__PURE__ */ u("div", { class: "meta-value meta-sole-target", children: /* @__PURE__ */ u(
            ResourceIdentityBody,
            {
              name: target.resource.name,
              version: target.resource.version,
              title: resourceTitle(target.resource.name, target.resource.version)
            }
          ) }),
          insideAdditionals.length > 0 && /* @__PURE__ */ u("div", { class: "meta-resources", children: insideAdditionals.map((row) => /* @__PURE__ */ u(
            AdditionalResource,
            {
              resource: row.resource,
              mode: row === target ? "target" : "plain"
            },
            row.key
          )) })
        ]
      }
    ),
    after.length > 0 && /* @__PURE__ */ u("div", { class: "meta-resources", children: after.map((row) => /* @__PURE__ */ u(AdditionalResource, { resource: row.resource, mode: "text" }, row.key)) })
  ] });
}
function WorkflowRow({ line }) {
  const typeTitle = line.typeTitle || "";
  const typeText = typeTitle ? /* @__PURE__ */ u("abbr", { title: typeTitle, children: line.typeLabel }) : line.typeLabel;
  const chip = line.typeLabel ? line.modeHref ? /* @__PURE__ */ u(
    "a",
    {
      class: "resource-type",
      href: line.modeHref,
      onClick: (e) => onModelsLinkClick(e, line.modeHref),
      children: typeText
    }
  ) : /* @__PURE__ */ u("span", { class: "resource-type", children: typeText }) : null;
  return /* @__PURE__ */ u("div", { class: "resource-item", children: /* @__PURE__ */ u("div", { class: "resource-item-main", children: [
    /* @__PURE__ */ u(ResourceIdentity, { name: line.name, version: line.version, href: line.href, showTitle: false }),
    chip
  ] }) });
}
function WorkflowSection({ line, lines }) {
  const rows = Array.isArray(lines) ? lines.filter(Boolean) : line ? [line] : [];
  if (!rows.length) return null;
  return /* @__PURE__ */ u("div", { class: "meta-section", children: [
    /* @__PURE__ */ u("h2", { class: "meta-label", children: "Workflow" }),
    rows.map((row, i) => /* @__PURE__ */ u(WorkflowRow, { line: row }, row.id || `${row.name}:${row.version}:${i}`))
  ] });
}

// dev/ui/src/lib/workflow-line.js
var HREF_VIEWS = /* @__PURE__ */ new Set(["generations", "posts", "comics"]);
function hasMembers(containers, key) {
  const list = containers && containers[key];
  return Array.isArray(list) && list.length > 0;
}
function modelsWorkflowView(containers) {
  if (hasMembers(containers, "generations")) return "generations";
  if (hasMembers(containers, "posts")) return "posts";
  if (hasMembers(containers, "comics")) return "comics";
  return "";
}
function workflowHrefView(originScope, containers) {
  if (HREF_VIEWS.has(originScope)) return originScope;
  if (originScope === "models") return modelsWorkflowView(containers);
  return "";
}
function workflowSidebarLine(workflowId, originScope, containers) {
  if (typeof workflowId !== "string") return null;
  const id = workflowId.trim();
  if (!id) return null;
  const phrase = getWorkflowModePhrase(id);
  const name = phrase || id;
  const display = getWorkflowDisplayLabel(id);
  const version = display && display !== name ? display : "";
  const abbreviation = getWorkflowModeAbbreviation(id);
  const typeLabel = abbreviation || "";
  const expansion = getWorkflowAbbreviationExpansion(id);
  const typeTitle = expansion || "";
  const view = workflowHrefView(originScope, containers);
  const href = view ? formatUrl({ view, params: { workflow: id } }) : "";
  const modeHref = href && abbreviation ? formatUrl({ view, params: { workflowMode: abbreviation } }) : "";
  return { id, name, version, typeLabel, typeTitle, href, modeHref };
}
function unionContainerWorkflows(members) {
  const seen = /* @__PURE__ */ new Set();
  const ids = [];
  const list = Array.isArray(members) ? members : [];
  for (const member of list) {
    if (typeof member?.workflow !== "string") continue;
    const id = member.workflow.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}
var USED_IN_DOT = " \xB7 ";
function usedInCaption(workflowId) {
  if (typeof workflowId !== "string") {
    return { caption: "", abbreviation: "", title: "" };
  }
  const id = workflowId.trim();
  if (!id) return { caption: "", abbreviation: "", title: "" };
  const abbreviation = getWorkflowModeAbbreviation(id);
  const display = getWorkflowDisplayLabel(id);
  const title = getWorkflowAbbreviationExpansion(id);
  let caption = id;
  if (abbreviation && display) caption = abbreviation + USED_IN_DOT + display;
  else if (abbreviation) caption = abbreviation;
  return { caption, abbreviation, title };
}

export {
  mediaNoun,
  downloadTitle,
  mediaFileCopy,
  civitaiInstanceLabels,
  postAccessChips,
  comicPublication,
  comicAccessChips,
  onModelsLinkClick,
  RelatedStrip,
  ModelMembership,
  WorkflowSection,
  workflowSidebarLine,
  unionContainerWorkflows,
  usedInCaption
};
