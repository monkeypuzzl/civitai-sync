import {
  aspectTokenLabel
} from "./chunk-CI4B4ALB.js";
import {
  MODEL3D_PUBLICATION_LABELS,
  PUBLICATION_LABELS,
  USED_AS_INPUT_FACET,
  dropModelGroup,
  formatDateRange,
  modelChipGroups,
  modelChipLabel
} from "./chunk-LNGUPSA6.js";
import {
  WORKFLOW_ABBREVIATION_EXPANSIONS,
  describeTypeWorkflowQuery,
  formatWorkflowQueryLabel,
  getWorkflowDisplayLabel,
  getWorkflowModePhrase
} from "./chunk-KM3EBJGK.js";
import {
  modelTypeLabel
} from "./chunk-XQGXV6CL.js";
import {
  containerFilterKeyActive,
  containerHasActiveFilter
} from "./chunk-JB7JSPAG.js";
import {
  formatUrl
} from "./chunk-CPLX52FD.js";
import {
  d,
  getModelHierarchy,
  parseModels,
  ratingTagLabel,
  serializeModels,
  tagLabel,
  y
} from "./chunk-OGIWOTNU.js";

// dev/ui/src/lib/filter-chips.js
var EN = "\u2013";
var RANGE_BY_KEY = {
  cfgMin: { mate: "cfgMax", label: "CFG", kind: "number" },
  cfgMax: { mate: "cfgMin", label: "CFG", kind: "number" },
  stepsMin: { mate: "stepsMax", label: "Steps", kind: "number" },
  stepsMax: { mate: "stepsMin", label: "Steps", kind: "number" },
  dateFrom: { mate: "dateTo", label: "Date", kind: "date" },
  dateTo: { mate: "dateFrom", label: "Date", kind: "date" }
};
var FLAT_CONTEXT = {
  model: "Model",
  version: "Version",
  ecosystem: "Ecosystem",
  resource: "Additional resource",
  versionId: "Version"
};
var REACTION_WORDS = {
  favorite: "Favorite",
  "feedback:liked": "Liked",
  "feedback:disliked": "Disliked"
};
function written(value) {
  if (value == null || value === "") return "";
  if (Array.isArray(value)) return value.map((part) => String(part)).filter((part) => part !== "").join(",");
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value);
}
function tokensOf(value) {
  if (Array.isArray(value)) return value.map((part) => String(part).trim()).filter(Boolean);
  if (value == null || value === "") return [];
  if (typeof value === "boolean") return [value ? "true" : "false"];
  return String(value).split(",").map((part) => part.trim()).filter(Boolean);
}
function queryKeyOrder(view, id, params) {
  const href = formatUrl({ view, entityId: id, params });
  const q = href.indexOf("?");
  if (q < 0) return [];
  return href.slice(q + 1).split("&").map((part) => {
    const eq = part.indexOf("=");
    const raw = eq < 0 ? part : part.slice(0, eq);
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  });
}
function copyParams(params) {
  return { ...params || {} };
}
function hrefAfter(view, id, params, edit) {
  const next = copyParams(params);
  edit(next);
  return formatUrl({ view, entityId: id, params: next });
}
function chip(text, title, href, ariaLabel) {
  const meaning = title && title !== text ? title : void 0;
  return {
    text,
    ...meaning ? { title: meaning } : {},
    href,
    ariaLabel: ariaLabel || `Remove ${meaning || text}`
  };
}
function titled(context, text) {
  if (!context || context === text) return void 0;
  return `${context}: ${text}`;
}
function numberSpan(min, max) {
  return `${written(min)}${EN}${written(max)}`;
}
function dropTokens(next, key, value, index) {
  const tokens = tokensOf(value);
  const rest = tokens.filter((_, i) => i !== index);
  if (!rest.length) delete next[key];
  else next[key] = Array.isArray(value) ? rest : rest.join(",");
}
function publicationLabels(view) {
  return view === "model3ds" ? MODEL3D_PUBLICATION_LABELS : PUBLICATION_LABELS;
}
function inPostText(value) {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === 0 || raw === "0" || raw === false || raw === "false") return "Not in a post";
  if (raw === 1 || raw === "1" || raw === true || raw === "true") return "In a post";
  return written(value);
}
function typeText(token) {
  const parts = describeTypeWorkflowQuery({ mediaType: token });
  return parts[0] || token;
}
function modeText(token) {
  const parts = describeTypeWorkflowQuery({ workflowMode: token });
  return parts[0] || token;
}
function workflowTitle(id, text) {
  const phrase = getWorkflowModePhrase(id);
  const label = getWorkflowDisplayLabel(id);
  if (phrase && label && phrase !== label) return `${phrase}: ${label}`;
  if (phrase && phrase !== text) return phrase;
  if (label && label !== text) return label;
  return void 0;
}
function rangeChip(view, id, params, key) {
  const spec = RANGE_BY_KEY[key];
  const href = hrefAfter(view, id, params, (next) => {
    delete next[key];
    delete next[spec.mate];
  });
  if (spec.kind === "date") {
    const text2 = formatDateRange(params.dateFrom, params.dateTo);
    return chip(text2, titled("Date", text2), href);
  }
  const text = spec.label === "Steps" ? numberSpan(params.stepsMin, params.stepsMax) : numberSpan(params.cfgMin, params.cfgMax);
  return chip(text, titled(spec.label, text), href);
}
function valueChips(view, id, params, key, modelTree, ownKnown) {
  const value = params[key];
  const hrefFor = (edit) => hrefAfter(view, id, params, edit);
  if (RANGE_BY_KEY[key]) return [rangeChip(view, id, params, key)];
  if (key === "mine") return [];
  if (key === "usedAsInput") {
    return [chip(USED_AS_INPUT_FACET.label, void 0, hrefFor((next) => {
      delete next.usedAsInput;
    }))];
  }
  if (key === "inPost") {
    const text = inPostText(value);
    return [chip(text, titled("Publication", text), hrefFor((next) => {
      delete next.inPost;
    }))];
  }
  if (key === "q") {
    const text = written(value);
    return [chip(text, titled("Search prompts", text), hrefFor((next) => {
      delete next.q;
    }))];
  }
  if (key === "title") {
    const text = written(value);
    return [chip(text, titled("Search titles", text), hrefFor((next) => {
      delete next.title;
    }))];
  }
  if (key === "models") {
    const raw = Array.isArray(value) ? value.map((part) => String(part)).join(",") : value;
    const terms = parseModels(raw);
    if (!terms.length) {
      const text = written(value);
      return [chip(text, "Models", hrefFor((next) => {
        delete next.models;
      }))];
    }
    const groups = modelChipGroups(modelTree, terms).filter((group) => {
      if (ownKnown !== false) return true;
      return !terms[group.termIndexes[0]]?.mine;
    });
    return groups.map((group) => {
      const row = chip(
        group.text,
        group.title,
        hrefFor((next) => {
          const rest = dropModelGroup(terms, group);
          const serial = serializeModels(rest);
          if (serial) next.models = serial;
          else delete next.models;
        }),
        group.ariaLabel
      );
      row.kind = group.kind;
      if (group.kind !== "cluster") return row;
      row.members = group.termIndexes.map((index) => {
        const term = terms[index];
        const text = term?.mine ? "Mine" : modelChipLabel(term, modelTree);
        const title = term?.mine ? "My models" : "Models";
        return chip(text, title, hrefFor((next) => {
          const rest = terms.filter((_, i) => i !== index);
          const serial = serializeModels(rest);
          if (serial) next.models = serial;
          else delete next.models;
        }));
      });
      return row;
    });
  }
  const tokens = tokensOf(value);
  const list = tokens.length ? tokens : [written(value)].filter(Boolean);
  return list.map((token, index) => {
    const href = hrefFor((next) => dropTokens(next, key, value, index));
    if (key === "rating") {
      const text = ratingTagLabel(token) || token;
      return chip(text, titled("Rating", text), href);
    }
    if (key === "tag") return chip(token, titled("Content", token), href);
    if (key === "postTag") return chip(token, titled("Posts", token), href);
    if (key === "reaction") {
      const text = tagLabel(token);
      const word = REACTION_WORDS[token] || token;
      return chip(text, titled("Reactions", word), href);
    }
    if (key === "publication") {
      const labels = publicationLabels(view);
      const text = labels[token] || token;
      return chip(text, titled("Publication", text), href);
    }
    if (key === "status") {
      const text = PUBLICATION_LABELS[token] || token;
      return chip(text, titled("Publication", text), href);
    }
    if (key === "aspect") {
      const text = aspectTokenLabel(token);
      return chip(text, titled("Aspect Ratio", text), href);
    }
    if (key === "workflow") {
      const text = formatWorkflowQueryLabel(token);
      return chip(text, workflowTitle(token, text), href);
    }
    if (key === "workflowMode") {
      const text = modeText(token);
      const expansion = WORKFLOW_ABBREVIATION_EXPANSIONS[token] || "";
      const title = expansion && expansion !== text ? expansion : titled("Media Type", text);
      return chip(text, title, href);
    }
    if (key === "mediaType") {
      const text = typeText(token);
      const known = text === "Image" || text === "Video" || text === "Audio" || text === "3D";
      return chip(text, known ? void 0 : titled("Media Type", text), href);
    }
    if (key === "resourceType") {
      const text = modelTypeLabel(token) || token;
      return chip(text, titled("Model type", text), href);
    }
    if (FLAT_CONTEXT[key]) {
      return chip(token, titled(FLAT_CONTEXT[key], token), href);
    }
    return chip(token, titled(key, token), href);
  });
}
function containerFilterChips(view, id, params, { modelTree, ownKnown = true } = {}) {
  if (id == null || id === "") return [];
  if (!containerHasActiveFilter(view, params)) return [];
  const src = params || {};
  const consumed = /* @__PURE__ */ new Set();
  const chips = [];
  for (const key of queryKeyOrder(view, id, src)) {
    if (consumed.has(key)) continue;
    if (!containerFilterKeyActive(view, key, src[key])) continue;
    const range = RANGE_BY_KEY[key];
    if (range) {
      consumed.add(key);
      consumed.add(range.mate);
    }
    const rows = valueChips(view, id, src, key, modelTree || null, ownKnown).filter((row) => row && row.text);
    if (rows.length) chips.push(...rows);
    else if (!(key === "models" && ownKnown === false)) {
      const text = written(src[key]) || key;
      chips.push(chip(text, void 0, hrefAfter(view, id, src, (next) => {
        delete next[key];
      })));
    }
  }
  return chips;
}

// dev/ui/src/lib/scope-chip-tree.js
function useScopeChipTree(scope) {
  const [tree, setTree] = d(null);
  const wanted = typeof scope === "string" && scope !== "";
  y(() => {
    if (!wanted) return void 0;
    let cancelled = false;
    getModelHierarchy().then((body) => {
      if (!cancelled) setTree(body || null);
    }).catch(() => {
    });
    return () => {
      cancelled = true;
    };
  }, [wanted]);
  return wanted ? tree : null;
}

export {
  containerFilterChips,
  useScopeChipTree
};
