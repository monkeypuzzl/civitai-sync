import {
  SafeRichText
} from "./chunk-S3H3QIJP.js";
import {
  PublishedAs3d
} from "./chunk-6KQMUFRU.js";
import {
  containerFilterChips,
  useScopeChipTree
} from "./chunk-LDP6J7D5.js";
import "./chunk-CI4B4ALB.js";
import "./chunk-LNGUPSA6.js";
import {
  ModelMembership,
  WorkflowSection,
  mediaFileCopy,
  postAccessChips,
  unionContainerWorkflows,
  workflowSidebarLine
} from "./chunk-27AHSJBH.js";
import {
  DetailPage,
  EntityHeader,
  OriginSiblingNav
} from "./chunk-TINO5HDV.js";
import "./chunk-KM3EBJGK.js";
import {
  unionContainerResources
} from "./chunk-XXC5O5XC.js";
import {
  MemoMediaTile
} from "./chunk-2VK77LR3.js";
import {
  useMagicEscape
} from "./chunk-4VS5UKZ5.js";
import "./chunk-TO3P2SCC.js";
import "./chunk-XQGXV6CL.js";
import {
  OpenFolderButton,
  OpenJsonButton
} from "./chunk-JTARL5PA.js";
import {
  detailCacheKey,
  loadContainerDetail,
  prefetchOriginNeighbours,
  useHeldDetail
} from "./chunk-4Z26PAQ4.js";
import "./chunk-SNTDJ2GX.js";
import {
  useOwnModelsKnown,
  useOwnModelsRevision
} from "./chunk-UASMX4HS.js";
import "./chunk-UFLKPWQW.js";
import {
  memberMediaHref,
  openPreservingOriginBag
} from "./chunk-R5EOPP5W.js";
import "./chunk-OJSJHKVX.js";
import {
  containerUnfilteredHref,
  quietSlotPatch
} from "./chunk-JB7JSPAG.js";
import {
  useIndexEpoch
} from "./chunk-TI5I7VA3.js";
import {
  originMembershipKind,
  pushState,
  replaceState
} from "./chunk-CPLX52FD.js";
import {
  A,
  T,
  browsingLevelLabel,
  browsingLevelOf,
  copyToClipboard,
  d,
  formatDate,
  k,
  memberReactionFields,
  openFiles,
  u,
  useDocumentTitle,
  y
} from "./chunk-OGIWOTNU.js";

// src/safeHtml.mjs
var KEEP = /* @__PURE__ */ new Set([
  "p",
  "h1",
  "h2",
  "h3",
  "ul",
  "ol",
  "li",
  "blockquote",
  "pre",
  "hr",
  "br",
  "strong",
  "em",
  "u",
  "s",
  "code",
  "a"
]);
var VOID = /* @__PURE__ */ new Set([
  "br",
  "hr",
  "img",
  "source",
  "embed",
  "area",
  "base",
  "col",
  "link",
  "meta",
  "wbr",
  "input"
]);
var DROP = /* @__PURE__ */ new Set([
  "img",
  "picture",
  "source",
  "video",
  "audio",
  "iframe",
  "embed",
  "object",
  "canvas",
  "svg",
  "edge-media",
  "script",
  "style",
  "noscript"
]);
var EMBED_DATA_TYPES = /* @__PURE__ */ new Set(["youtube", "instagram", "strawpoll", "blurb"]);
var NAMED_ENTITIES = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: "\xA0"
};
function decodeHtmlEntities(str) {
  if (typeof str !== "string" || str === "") return "";
  return str.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z][a-zA-Z0-9]+);/g, (full, body) => {
    if (body[0] === "#") {
      const code = body[1] === "x" || body[1] === "X" ? Number.parseInt(body.slice(2), 16) : Number.parseInt(body.slice(1), 10);
      if (!Number.isFinite(code) || code < 0) return full;
      try {
        return String.fromCodePoint(code);
      } catch {
        return full;
      }
    }
    const named = NAMED_ENTITIES[body.toLowerCase()];
    return named === void 0 ? full : named;
  });
}
function parseAttrs(raw) {
  const attrs = {};
  if (typeof raw !== "string" || raw === "") return attrs;
  const re = /([^\s=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let m;
  while (m = re.exec(raw)) {
    const name = m[1].toLowerCase();
    if (name === "/" || name === "") continue;
    attrs[name] = decodeHtmlEntities(m[2] ?? m[3] ?? m[4] ?? "");
  }
  return attrs;
}
function readTag(s, i) {
  if (s[i] !== "<") return null;
  let j = i + 1;
  if (j >= s.length) return null;
  const isEnd = s[j] === "/";
  if (isEnd) j++;
  const nameStart = j;
  if (j >= s.length || !/[A-Za-z]/.test(s[j])) return null;
  j++;
  while (j < s.length && /[A-Za-z0-9:-]/.test(s[j])) j++;
  const name = s.slice(nameStart, j).toLowerCase();
  if (!name) return null;
  let quote = null;
  const attrStart = j;
  while (j < s.length) {
    const ch = s[j];
    if (quote) {
      if (ch === quote) quote = null;
      j++;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      j++;
      continue;
    }
    if (ch === ">") {
      const attrRaw = s.slice(attrStart, j).trim();
      const selfClosing = attrRaw.endsWith("/") || VOID.has(name);
      return {
        next: j + 1,
        kind: isEnd ? "end" : "start",
        name,
        attrs: isEnd ? {} : parseAttrs(attrRaw.replace(/\/\s*$/, "")),
        selfClosing: isEnd ? false : selfClosing
      };
    }
    j++;
  }
  return null;
}
function tokenize(html) {
  const s = String(html);
  const tokens = [];
  let i = 0;
  while (i < s.length) {
    if (s.startsWith("<!--", i)) {
      const end2 = s.indexOf("-->", i + 4);
      i = end2 === -1 ? s.length : end2 + 3;
      continue;
    }
    if (s[i] === "<") {
      const tag = readTag(s, i);
      if (tag) {
        tokens.push(tag);
        i = tag.next;
        continue;
      }
    }
    const next = s.indexOf("<", i + 1);
    const end = next === -1 ? s.length : next;
    tokens.push({ kind: "text", value: s.slice(i, end) });
    i = end;
  }
  return tokens;
}
function buildRaw(tokens) {
  const root = { type: "element", name: "#root", attrs: {}, children: [] };
  const stack = [root];
  for (const tok of tokens) {
    const parent = stack[stack.length - 1];
    if (tok.kind === "text") {
      parent.children.push({ type: "text", value: tok.value });
      continue;
    }
    if (tok.kind === "start") {
      const el = { type: "element", name: tok.name, attrs: tok.attrs, children: [] };
      parent.children.push(el);
      if (!tok.selfClosing && !VOID.has(tok.name)) stack.push(el);
      continue;
    }
    if (tok.kind === "end") {
      for (let i = stack.length - 1; i > 0; i--) {
        if (stack[i].name === tok.name) {
          stack.length = i;
          break;
        }
      }
    }
  }
  return root.children;
}
function isEmbedDiv(attrs) {
  if (!attrs || typeof attrs !== "object") return false;
  if (Object.prototype.hasOwnProperty.call(attrs, "data-youtube-video")) return true;
  const dataType = String(attrs["data-type"] || "").toLowerCase();
  return EMBED_DATA_TYPES.has(dataType);
}
function pushSafe(out, node) {
  if (node == null) return;
  if (Array.isArray(node)) {
    for (const n of node) pushSafe(out, n);
    return;
  }
  out.push(node);
}
function toSafeList(nodes) {
  const out = [];
  if (!Array.isArray(nodes)) return out;
  for (const n of nodes) pushSafe(out, toSafeNode(n));
  return out;
}
function toSafeNode(n) {
  if (!n || typeof n !== "object") return null;
  if (n.type === "text") {
    const v = decodeHtmlEntities(n.value);
    return v === "" ? null : { t: "text", v };
  }
  const name = n.name;
  if (DROP.has(name) || name === "div" && isEmbedDiv(n.attrs)) return null;
  const kids = toSafeList(n.children);
  if (name === "a") {
    const href = typeof n.attrs?.href === "string" ? n.attrs.href.trim() : "";
    if (/^https?:\/\//i.test(href)) return { t: "a", href, c: kids };
    return kids;
  }
  if (KEEP.has(name)) {
    if (name === "br" || name === "hr") return { t: name };
    return { t: name, c: kids };
  }
  return kids;
}
function htmlToSafeTree(html) {
  if (html == null) return [];
  const s = String(html);
  if (s === "") return [];
  return toSafeList(buildRaw(tokenize(s)));
}
function collectTreeText(tree) {
  if (tree == null) return "";
  if (Array.isArray(tree)) return tree.map(collectTreeText).join("");
  if (typeof tree !== "object") return "";
  if (tree.t === "text") return typeof tree.v === "string" ? tree.v : "";
  if (Array.isArray(tree.c)) return collectTreeText(tree.c);
  return "";
}
function treeHasText(tree) {
  return collectTreeText(tree).replace(/\s+/g, "").length > 0;
}

// dev/ui/src/components/PostDetailView.jsx
function backToPosts() {
  pushState({ view: "posts", entityId: null });
}
var REACTION_ICONS = {
  heartCount: "\u2764\uFE0F",
  likeCount: "\u{1F44D}",
  laughCount: "\u{1F602}",
  cryCount: "\u{1F622}",
  dislikeCount: "\u{1F44E}",
  collectedCount: "\u{1F4DA}",
  commentCount: "\u{1F4AC}"
};
function postMemberId(m) {
  if (m?.mediaId != null && m.mediaId !== "") return String(m.mediaId);
  if (m?.imageId != null && m.imageId !== "") return String(m.imageId);
  return "";
}
function postMediaToTile(m) {
  const inputs = Array.isArray(m.inputs) ? m.inputs : [];
  const kinds = [];
  const seen = /* @__PURE__ */ new Set();
  for (const inp of inputs) {
    if (!inp?.kind || seen.has(inp.kind)) continue;
    seen.add(inp.kind);
    kinds.push(inp.kind);
  }
  const id = postMemberId(m);
  const marks = memberReactionFields(m);
  return {
    id,
    type: m.type,
    hasInputs: inputs.length > 0,
    inputKinds: kinds,
    tags: marks.tags,
    reactions: marks.reactions,
    media: [{
      mediaId: id,
      type: m.type,
      thumbnailPath: m.thumbnailPath,
      tags: m.tags || [],
      duration: m.duration
    }]
  };
}
function PostDetailView({ postId, params }) {
  useMagicEscape();
  const modelTree = useScopeChipTree(params && params.models);
  const [copied, setCopied] = d(null);
  const quietAppliedRef = A(null);
  const ownRev = useOwnModelsRevision();
  const ownKnown = useOwnModelsKnown();
  const indexEpoch = useIndexEpoch();
  const cacheKey = detailCacheKey({ view: "posts", id: postId, params }) + `:own${ownRev}:ix${indexEpoch}`;
  const held = useHeldDetail(cacheKey, () => loadContainerDetail("posts", postId, params));
  const data = held.displayed;
  const onRoute = held.shownKey === cacheKey && data?.index?.id != null && String(data.index.id) === String(postId);
  const detailTree = T(
    () => data?.index?.detail ? htmlToSafeTree(data.index.detail) : null,
    [data?.index?.detail]
  );
  const origin = data?.index?.origin || null;
  y(() => {
    if (!onRoute || !origin) return void 0;
    prefetchOriginNeighbours({ view: "posts", routeParams: params, origin });
    return void 0;
  }, [onRoute, origin, params]);
  y(() => {
    if (!onRoute || !origin || !postId) return;
    const nextParams = { ...params || {} };
    let changed = false;
    if (origin.omitFrom && nextParams.from) {
      delete nextParams.from;
      changed = true;
    }
    const slotPatch = quietSlotPatch({ urlSlot: nextParams.slot, origin });
    if (slotPatch) {
      if (slotPatch.slot) nextParams.slot = slotPatch.slot;
      else delete nextParams.slot;
      changed = true;
    }
    if (!changed) return;
    const quietKey = `${postId}|${JSON.stringify(nextParams)}`;
    if (quietAppliedRef.current === quietKey) return;
    quietAppliedRef.current = quietKey;
    replaceState({
      view: "posts",
      entityId: postId,
      params: nextParams
    });
  }, [onRoute, origin, postId, params]);
  async function doCopy(text, label) {
    await copyToClipboard(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 1500);
  }
  useDocumentTitle(
    data?.index ? {
      place: "post",
      title: data.index.title,
      status: data.index.status,
      date: formatDate(data.index.status === "draft" ? data.index.createdAt : data.index.publishedAt)
    } : { place: "post" }
  );
  const scrollKey = data?.index?.id || postId;
  if (!data && !held.failed) {
    return /* @__PURE__ */ u(DetailPage, { flow: true, scrollKey, sidebar: /* @__PURE__ */ u(k, {}) });
  }
  if (!data || !data.index) {
    return /* @__PURE__ */ u(DetailPage, { flow: true, scrollKey, sidebar: /* @__PURE__ */ u(k, {}), children: /* @__PURE__ */ u("div", { class: "empty-state", children: [
      /* @__PURE__ */ u("h1", { children: "Post not found" }),
      /* @__PURE__ */ u("p", { children: "This post may not have been downloaded yet." }),
      /* @__PURE__ */ u("button", { class: "meta-action", onClick: backToPosts, children: "Back to Posts" })
    ] }) });
  }
  const post = data.index;
  const raw = data.raw;
  const rawImages = raw?.images || [];
  const stats = post.stats || {};
  const reactions = Object.entries(REACTION_ICONS).filter(([key]) => stats[key] > 0).map(([key, icon]) => ({ key, icon, count: stats[key] }));
  const isDraft = post.status === "draft";
  const dateStr = isDraft ? post.createdAt : post.publishedAt;
  const shownMedia = (Array.isArray(post.media) ? post.media : []).filter((m) => m && m.inWalk !== false);
  const shownFiles = shownMedia.filter((m) => m.thumbnailPath);
  const resourceRows = unionContainerResources(shownMedia);
  const modelHrefs = resourceRows.map((row) => row.href).filter(Boolean);
  const soleModelHref = modelHrefs.length === 1 ? modelHrefs[0] : "";
  const originScope = params && params.from || origin && origin.scope || null;
  const originKind = originMembershipKind(originScope);
  const workflowLines = unionContainerWorkflows(shownMedia).map((id) => workflowSidebarLine(id, originScope, { posts: [post] })).filter(Boolean);
  const fileCopy = mediaFileCopy({
    count: shownFiles.length,
    types: shownFiles.map((m) => m.type)
  });
  return /* @__PURE__ */ u(
    DetailPage,
    {
      flow: true,
      scrollKey,
      chrome: /* @__PURE__ */ u(OriginSiblingNav, { origin, routeParams: params }),
      sidebar: /* @__PURE__ */ u(k, { children: [
        /* @__PURE__ */ u(
          EntityHeader,
          {
            title: post.title,
            label: "Post",
            date: dateStr,
            href: containerUnfilteredHref("posts", postId, params),
            filters: containerFilterChips("posts", postId, params, { modelTree, ownKnown })
          }
        ),
        post.model3d ? /* @__PURE__ */ u(PublishedAs3d, { model3d: post.model3d }) : null,
        reactions.length > 0 && /* @__PURE__ */ u("ul", { class: "post-detail-reactions", children: reactions.map((r) => /* @__PURE__ */ u("li", { class: "post-reaction-chip", children: [
          r.icon,
          " ",
          r.count
        ] }, r.key)) }),
        resourceRows.length > 0 && /* @__PURE__ */ u(
          ModelMembership,
          {
            rows: resourceRows,
            soleHref: soleModelHref,
            sectionClass: originKind === "model" ? "meta-section meta-section-origin" : "meta-section"
          }
        ),
        workflowLines.length > 0 ? /* @__PURE__ */ u(WorkflowSection, { lines: workflowLines }) : null,
        post.tags.length > 0 && /* @__PURE__ */ u("div", { class: "meta-section", children: [
          /* @__PURE__ */ u("h2", { class: "meta-label", children: "Post Tags" }),
          /* @__PURE__ */ u("ul", { class: "meta-tags", children: post.tags.map((tag) => /* @__PURE__ */ u("li", { class: "meta-tag", children: tag.name }, tag.id || tag.name)) })
        ] }),
        /* @__PURE__ */ u("div", { class: "meta-section", children: [
          /* @__PURE__ */ u("h2", { class: "meta-label", children: "Files" }),
          /* @__PURE__ */ u("div", { class: "meta-actions", children: [
            fileCopy ? shownFiles.length === 1 ? /* @__PURE__ */ u(
              OpenFolderButton,
              {
                path: shownFiles[0].thumbnailPath,
                class: "meta-action",
                label: fileCopy.label,
                title: fileCopy.title
              }
            ) : /* @__PURE__ */ u(
              "button",
              {
                type: "button",
                class: "meta-action",
                title: fileCopy.title,
                onClick: () => openFiles(shownFiles.map((m) => m.thumbnailPath)),
                children: fileCopy.label
              }
            ) : null,
            /* @__PURE__ */ u(
              OpenJsonButton,
              {
                kind: "post",
                id: post.id,
                class: "meta-action",
                title: "Open Post folder, with data file selected"
              }
            )
          ] })
        ] }),
        post.url ? /* @__PURE__ */ u("div", { class: "meta-section", children: /* @__PURE__ */ u("div", { class: "meta-actions", children: /* @__PURE__ */ u("span", { class: "meta-link-row", children: [
          /* @__PURE__ */ u(
            "a",
            {
              class: "meta-action",
              href: post.url,
              target: "_blank",
              rel: "noopener noreferrer",
              title: "Open this post on Civitai",
              children: "\u{1F517} On Civitai"
            }
          ),
          postAccessChips(post.availability).map((chip) => /* @__PURE__ */ u("span", { class: "param-chip", children: chip }, chip))
        ] }) }) }) : null
      ] }),
      children: [
        /* @__PURE__ */ u("div", { class: "post-detail-media-grid", children: shownMedia.map((m) => {
          const rawImg = rawImages.find((img) => img.id === m.imageId) || null;
          const meta = m.meta || rawImg?.meta || null;
          const href = memberMediaHref(postMemberId(m), params, {
            slot: m.slot,
            originView: "posts",
            granularity: "post",
            slotInUrl: m.slotInUrl
          });
          return /* @__PURE__ */ u("div", { class: "post-media-card", children: [
            /* @__PURE__ */ u("div", { class: "post-media-card-visual", children: /* @__PURE__ */ u(
              MemoMediaTile,
              {
                item: postMediaToTile(m),
                href,
                onActivate: (e) => openPreservingOriginBag(e, href)
              }
            ) }),
            /* @__PURE__ */ u(
              MediaCardMeta,
              {
                media: m,
                rawImage: rawImg,
                meta,
                doCopy,
                copied
              }
            )
          ] }, m.imageId);
        }) }),
        treeHasText(detailTree) && /* @__PURE__ */ u("div", { class: "post-detail-description", children: /* @__PURE__ */ u(SafeRichText, { tree: detailTree }) })
      ]
    }
  );
}
function MediaCardMeta({ media, rawImage, meta, doCopy, copied }) {
  const dims = media.width > 0 && media.height > 0 ? `${media.width}\xD7${media.height}` : null;
  const level = browsingLevelOf(rawImage);
  const showRatingChip = level != null && level > 1;
  const prompt = meta?.prompt || "";
  if (!prompt && !dims && !showRatingChip) return null;
  return /* @__PURE__ */ u("div", { class: "post-media-card-meta", children: [
    dims && /* @__PURE__ */ u("div", { class: "post-media-dims", children: dims }),
    prompt && /* @__PURE__ */ u("div", { class: "post-media-prompt", children: [
      /* @__PURE__ */ u("p", { class: "post-media-prompt-text", children: prompt }),
      /* @__PURE__ */ u("div", { class: "meta-actions", children: /* @__PURE__ */ u(
        "button",
        {
          class: `meta-action compact${copied === `prompt-${media.imageId}` ? " copied" : ""}`,
          onClick: () => doCopy(prompt, `prompt-${media.imageId}`),
          children: copied === `prompt-${media.imageId}` ? "Copied" : "Copy prompt"
        }
      ) })
    ] }),
    showRatingChip && /* @__PURE__ */ u("span", { class: "param-chip post-media-rating", children: browsingLevelLabel(level) })
  ] });
}
export {
  PostDetailView
};
