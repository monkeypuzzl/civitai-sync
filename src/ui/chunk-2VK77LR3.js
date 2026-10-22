import {
  ReactionIndicators
} from "./chunk-TO3P2SCC.js";
import {
  MediaThumb
} from "./chunk-UFLKPWQW.js";
import {
  TimeText
} from "./chunk-OJSJHKVX.js";
import {
  L,
  _,
  documentLead,
  formatDate,
  highlightTerms,
  isAudioCover,
  k,
  l,
  reactionMarks,
  u,
  x
} from "./chunk-OGIWOTNU.js";

// dev/ui/src/components/HighlightText.jsx
function HighlightText({ text, search }) {
  if (!search || !text) return text || null;
  const parts = highlightTerms(text, search);
  if (parts.length <= 1) return text;
  const terms = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return parts.map(
    (part, i) => terms.includes(part.toLowerCase()) ? /* @__PURE__ */ u("mark", { class: "search-highlight", children: part }, i) : part
  );
}

// node_modules/preact/compat/dist/compat.module.js
function g2(n, t) {
  for (var e in t) n[e] = t[e];
  return n;
}
function E(n, t) {
  for (var e in n) if ("__source" !== e && !(e in t)) return true;
  for (var r in t) if ("__source" !== r && n[r] !== t[r]) return true;
  return false;
}
function N(n, t) {
  this.props = n, this.context = t;
}
function M(n, e) {
  function r(n2) {
    var t = this.props.ref, r2 = t == n2.ref;
    return !r2 && t && (t.call ? t(null) : t.current = null), e ? !e(this.props, n2) || !r2 : E(this.props, n2);
  }
  function u2(e2) {
    return this.shouldComponentUpdate = r, _(n, e2);
  }
  return u2.displayName = "Memo(" + (n.displayName || n.name) + ")", u2.prototype.isReactComponent = true, u2.__f = true, u2.type = n, u2;
}
(N.prototype = new x()).isPureReactComponent = true, N.prototype.shouldComponentUpdate = function(n, t) {
  return E(this.props, n) || E(this.state, t);
};
var T2 = l.__b;
l.__b = function(n) {
  n.type && n.type.__f && n.ref && (n.props.ref = n.ref, n.ref = null), T2 && T2(n);
};
var A2 = "undefined" != typeof Symbol && Symbol.for && /* @__PURE__ */ Symbol.for("react.forward_ref") || 3911;
var U = l.__e;
l.__e = function(n, t, e, r) {
  if (n.then) {
    for (var u2, o = t; o = o.__; ) if ((u2 = o.__c) && u2.__c) return null == t.__e && (t.__e = e.__e, t.__k = e.__k), u2.__c(n, t);
  }
  U(n, t, e, r);
};
var F2 = l.unmount;
function V(n, t, e) {
  return n && (n.__c && n.__c.__H && (n.__c.__H.__.forEach(function(n2) {
    "function" == typeof n2.__c && n2.__c();
  }), n.__c.__H = null), null != (n = g2({}, n)).__c && (n.__c.__P === e && (n.__c.__P = t), n.__c.__e = true, n.__c = null), n.__k = n.__k && n.__k.map(function(n2) {
    return V(n2, t, e);
  })), n;
}
function W(n, t, e) {
  return n && e && (n.__v = null, n.__k = n.__k && n.__k.map(function(n2) {
    return W(n2, t, e);
  }), n.__c && n.__c.__P === t && (n.__e && e.appendChild(n.__e), n.__c.__e = true, n.__c.__P = e)), n;
}
function P2() {
  this.__u = 0, this.o = null, this.__b = null;
}
function j(n) {
  if (!n.__) return null;
  var t = n.__.__c;
  return t && t.__a && t.__a(n);
}
function B() {
  this.i = null, this.l = null;
}
l.unmount = function(n) {
  var t = n.__c;
  t && (t.__z = true), t && t.__R && t.__R(), t && 32 & n.__u && (n.type = null), F2 && F2(n);
}, (P2.prototype = new x()).__c = function(n, t) {
  var e = t.__c, r = this;
  null == r.o && (r.o = []), r.o.push(e);
  var u2 = j(r.__v), o = false, i = function() {
    o || r.__z || (o = true, e.__R = null, u2 ? u2(c) : c());
  };
  e.__R = i;
  var l2 = e.__P;
  e.__P = null;
  var c = function() {
    if (!--r.__u) {
      if (r.state.__a) {
        var n2 = r.state.__a;
        r.__v.__k[0] = W(n2, n2.__c.__P, n2.__c.__O);
      }
      var t2;
      for (r.setState({ __a: r.__b = null }); t2 = r.o.pop(); ) t2.__P = l2, t2.forceUpdate();
    }
  };
  r.__u++ || 32 & t.__u || r.setState({ __a: r.__b = r.__v.__k[0] }), n.then(i, i);
}, P2.prototype.componentWillUnmount = function() {
  this.o = [];
}, P2.prototype.render = function(n, e) {
  if (this.__b) {
    if (this.__v.__k) {
      var r = document.createElement("div"), o = this.__v.__k[0].__c;
      this.__v.__k[0] = V(this.__b, r, o.__O = o.__P);
    }
    this.__b = null;
  }
  var i = e.__a && _(k, null, n.fallback);
  return i && (i.__u &= -33), [_(k, null, e.__a ? null : n.children), i];
};
var H = function(n, t, e) {
  if (++e[1] === e[0] && n.l.delete(t), n.props.revealOrder && ("t" !== n.props.revealOrder[0] || !n.l.size)) for (e = n.i; e; ) {
    for (; e.length > 3; ) e.pop()();
    if (e[1] < e[0]) break;
    n.i = e = e[2];
  }
};
(B.prototype = new x()).__a = function(n) {
  var t = this, e = j(t.__v), r = t.l.get(n);
  return r[0]++, function(u2) {
    var o = function() {
      t.props.revealOrder ? (r.push(u2), H(t, n, r)) : u2();
    };
    e ? e(o) : o();
  };
}, B.prototype.render = function(n) {
  this.i = null, this.l = /* @__PURE__ */ new Map();
  var t = L(n.children);
  n.revealOrder && "b" === n.revealOrder[0] && t.reverse();
  for (var e = t.length; e--; ) this.l.set(t[e], this.i = [1, 0, this.i]);
  return n.children;
}, B.prototype.componentDidUpdate = B.prototype.componentDidMount = function() {
  var n = this;
  this.l.forEach(function(t, e) {
    H(n, e, t);
  });
};
var q2 = "undefined" != typeof Symbol && Symbol.for && /* @__PURE__ */ Symbol.for("react.element") || 60103;
var G = /^(?:accent|alignment|arabic|baseline|cap|clip(?!PathU)|color|dominant|fill|flood|font|glyph(?!R)|horiz|image(!S)|letter|lighting|marker(?!H|W|U)|overline|paint|pointer|shape|stop|strikethrough|stroke|text(?!L)|transform|underline|unicode|units|v|vector|vert|word|writing|x(?!C))[A-Z]/;
var J2 = /^on(Ani|Tra|Tou|BeforeInp|Compo)/;
var K2 = /[A-Z0-9]/g;
var Q2 = "undefined" != typeof document;
var X = function(n) {
  return ("undefined" != typeof Symbol && "symbol" == typeof /* @__PURE__ */ Symbol() ? /fil|che|rad/ : /fil|che|ra/).test(n);
};
x.prototype.isReactComponent = {}, ["componentWillMount", "componentWillReceiveProps", "componentWillUpdate"].forEach(function(t) {
  Object.defineProperty(x.prototype, t, { configurable: true, get: function() {
    return this["UNSAFE_" + t];
  }, set: function(n) {
    Object.defineProperty(this, t, { configurable: true, writable: true, value: n });
  } });
});
var en = l.event;
function rn() {
}
function un() {
  return this.cancelBubble;
}
function on() {
  return this.defaultPrevented;
}
l.event = function(n) {
  return en && (n = en(n)), n.persist = rn, n.isPropagationStopped = un, n.isDefaultPrevented = on, n.nativeEvent = n;
};
var ln;
var cn = { enumerable: false, configurable: true, get: function() {
  return this.class;
} };
var fn = l.vnode;
l.vnode = function(n) {
  "string" == typeof n.type && (function(n2) {
    var t = n2.props, e = n2.type, u2 = {}, o = -1 === e.indexOf("-");
    for (var i in t) {
      var l2 = t[i];
      if (!("value" === i && "defaultValue" in t && null == l2 || Q2 && "children" === i && "noscript" === e || "class" === i || "className" === i)) {
        var c = i.toLowerCase();
        "defaultValue" === i && "value" in t && null == t.value ? i = "value" : "download" === i && true === l2 ? l2 = "" : "translate" === c && "no" === l2 ? l2 = false : "o" === c[0] && "n" === c[1] ? "ondoubleclick" === c ? i = "ondblclick" : "onchange" !== c || "input" !== e && "textarea" !== e || X(t.type) ? "onfocus" === c ? i = "onfocusin" : "onblur" === c ? i = "onfocusout" : J2.test(i) && (i = c) : c = i = "oninput" : o && G.test(i) ? i = i.replace(K2, "-$&").toLowerCase() : null === l2 && (l2 = void 0), "oninput" === c && u2[i = c] && (i = "oninputCapture"), u2[i] = l2;
      }
    }
    "select" == e && u2.multiple && Array.isArray(u2.value) && (u2.value = L(t.children).forEach(function(n3) {
      n3.props.selected = -1 != u2.value.indexOf(n3.props.value);
    })), "select" == e && null != u2.defaultValue && (u2.value = L(t.children).forEach(function(n3) {
      n3.props.selected = u2.multiple ? -1 != u2.defaultValue.indexOf(n3.props.value) : u2.defaultValue == n3.props.value;
    })), t.class && !t.className ? (u2.class = t.class, Object.defineProperty(u2, "className", cn)) : t.className && (u2.class = u2.className = t.className), n2.props = u2;
  })(n), n.$$typeof = q2, fn && fn(n);
};
var an = l.__r;
l.__r = function(n) {
  an && an(n), ln = n.__c;
};
var sn = l.diffed;
l.diffed = function(n) {
  sn && sn(n);
  var t = n.props, e = n.__e;
  null != e && "textarea" === n.type && "value" in t && t.value !== e.value && (e.value = null == t.value ? "" : t.value), ln = null;
};

// dev/ui/src/lib/tile-title.js
var MEDIA_TYPES = /* @__PURE__ */ new Set(["image", "video", "audio"]);
function tileSlotIso(item, grain) {
  if (!item) return "";
  if (grain === "post") {
    return item.status === "draft" ? item.createdAt || "" : item.publishedAt || "";
  }
  if (grain === "comic") {
    if (item.date) return item.date;
    return item.status === "draft" ? item.createdAt || "" : item.publishedAt || "";
  }
  return item.createdAt || "";
}
function tileLead(item, grain, dateLabel) {
  const date = dateLabel || "";
  if (grain === "post") {
    return documentLead({
      place: "post",
      status: item && item.status,
      title: item && item.title,
      date
    });
  }
  if (grain === "comic") {
    return documentLead({
      place: "comic",
      status: item && item.status,
      name: item && item.name,
      date
    });
  }
  const media = item && Array.isArray(item.media) ? item.media : [];
  if (grain === "batch" && media.length > 1) {
    return documentLead({
      place: "generation",
      date,
      members: media.map((m) => ({ type: m && m.type }))
    });
  }
  const only = media[0] || {};
  const ownType = item && MEDIA_TYPES.has(item.type) ? item.type : "";
  return documentLead({
    place: "media",
    type: only.type || ownType,
    title: item && item.audioTitle || "",
    date
  });
}

// dev/ui/src/lib/tile-media.js
function tileLeadMedia(item) {
  if (!item) return null;
  if (item.preview) return item.preview;
  const media = item.media;
  return Array.isArray(media) && media[0] || null;
}

// dev/ui/src/components/MediaTile.jsx
function HasInputsMark({ inputKinds }) {
  const kinds = Array.isArray(inputKinds) ? inputKinds : [];
  const only = kinds.length === 1 ? kinds[0] : null;
  const title = only === "image" ? "Has input image" : only === "video" ? "Has input video" : "Has input media";
  return /* @__PURE__ */ u("span", { class: "has-inputs-mark", title, "aria-label": title });
}
function MediaTile({ item, onActivate, selected, search, compact, href, grain }) {
  const first = tileLeadMedia(item);
  if (!first) return null;
  const isVideo = first.type === "video";
  const isAudio = first.type === "audio";
  const audioCover = isAudio && (first.coverPath || isAudioCover(first));
  const model3dStill = first.type === "model3d" && first.thumbnailPath;
  const slotIso = grain ? tileSlotIso(item, grain) : item.createdAt;
  const dateStr = formatDate(slotIso);
  const titleStr = grain ? tileLead(item, grain, dateStr) : dateStr;
  const snippetText = search ? item.promptSnippet || (item.prompt ? item.prompt.slice(0, 160) : null) : null;
  const contentTags = Array.isArray(item.contentTags) ? item.contentTags : [];
  const Tag = href ? "a" : "div";
  return /* @__PURE__ */ u(
    Tag,
    {
      class: `gallery-item${selected ? " selected" : ""}${compact ? " compact" : ""}`,
      href: href || void 0,
      onClick: onActivate ? (e) => onActivate(e, item) : void 0,
      onMouseDown: onActivate ? (e) => {
        if (e.button === 1) onActivate(e, item);
      } : void 0,
      title: titleStr,
      children: [
        /* @__PURE__ */ u(
          MediaThumb,
          {
            type: first.type,
            thumbnailPath: first.thumbnailPath,
            coverPath: first.coverPath
          }
        ),
        item.hasInputs && /* @__PURE__ */ u(HasInputsMark, { inputKinds: item.inputKinds }),
        isVideo && /* @__PURE__ */ u("div", { class: "video-badge" }),
        audioCover && /* @__PURE__ */ u("div", { class: "audio-badge", children: "\u266B" }),
        model3dStill && /* @__PURE__ */ u("div", { class: "model3d-badge", children: "3D" }),
        !compact && item.mediaCount > 1 && /* @__PURE__ */ u("span", { class: "media-badge", children: item.mediaCount }),
        !compact && contentTags.length > 0 && /* @__PURE__ */ u("ul", { class: "content-tags", children: contentTags.slice(0, 6).map((t) => /* @__PURE__ */ u("li", { class: "content-tag-chip", children: t }, t)) }),
        !compact && snippetText && /* @__PURE__ */ u("div", { class: "hover-info search-snippet", children: /* @__PURE__ */ u(HighlightText, { text: snippetText, search }) }),
        !compact && !snippetText && dateStr && /* @__PURE__ */ u("div", { class: "hover-info tile-date", children: /* @__PURE__ */ u(TimeText, { at: slotIso, children: dateStr }) }),
        /* @__PURE__ */ u(ReactionIndicators, { item })
      ]
    }
  );
}
function sameTile(prev, next) {
  const a = prev.item;
  const b2 = next.item;
  const la = tileLeadMedia(a) || {};
  const lb = tileLeadMedia(b2) || {};
  return a.id === b2.id && prev.selected === next.selected && prev.compact === next.compact && la.type === lb.type && la.thumbnailPath === lb.thumbnailPath && la.coverPath === lb.coverPath && reactionMarks(a).join(",") === reactionMarks(b2).join(",") && prev.search === next.search && prev.grain === next.grain && a.createdAt === b2.createdAt && a.publishedAt === b2.publishedAt && a.date === b2.date && a.status === b2.status && a.title === b2.title && a.name === b2.name && a.audioTitle === b2.audioTitle && !!a.hasInputs === !!b2.hasInputs && (a.inputKinds || []).join(",") === (b2.inputKinds || []).join(",") && prev.href === next.href;
}
var MemoMediaTile = M(MediaTile, sameTile);

export {
  HighlightText,
  M,
  tileSlotIso,
  tileLead,
  tileLeadMedia,
  MemoMediaTile
};
