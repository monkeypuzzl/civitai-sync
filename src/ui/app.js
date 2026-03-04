// node_modules/preact/dist/preact.module.js
var n;
var l;
var u;
var t;
var i;
var r;
var o;
var e;
var f;
var c;
var s;
var a;
var h;
var p = {};
var v = [];
var y = /acit|ex(?:s|g|n|p|$)|rph|grid|ows|mnc|ntw|ine[ch]|zoo|^ord|itera/i;
var d = Array.isArray;
function w(n2, l3) {
  for (var u4 in l3) n2[u4] = l3[u4];
  return n2;
}
function g(n2) {
  n2 && n2.parentNode && n2.parentNode.removeChild(n2);
}
function _(l3, u4, t3) {
  var i3, r3, o3, e3 = {};
  for (o3 in u4) "key" == o3 ? i3 = u4[o3] : "ref" == o3 ? r3 = u4[o3] : e3[o3] = u4[o3];
  if (arguments.length > 2 && (e3.children = arguments.length > 3 ? n.call(arguments, 2) : t3), "function" == typeof l3 && null != l3.defaultProps) for (o3 in l3.defaultProps) void 0 === e3[o3] && (e3[o3] = l3.defaultProps[o3]);
  return m(l3, e3, i3, r3, null);
}
function m(n2, t3, i3, r3, o3) {
  var e3 = { type: n2, props: t3, key: i3, ref: r3, __k: null, __: null, __b: 0, __e: null, __c: null, constructor: void 0, __v: null == o3 ? ++u : o3, __i: -1, __u: 0 };
  return null == o3 && null != l.vnode && l.vnode(e3), e3;
}
function k(n2) {
  return n2.children;
}
function x(n2, l3) {
  this.props = n2, this.context = l3;
}
function S(n2, l3) {
  if (null == l3) return n2.__ ? S(n2.__, n2.__i + 1) : null;
  for (var u4; l3 < n2.__k.length; l3++) if (null != (u4 = n2.__k[l3]) && null != u4.__e) return u4.__e;
  return "function" == typeof n2.type ? S(n2) : null;
}
function C(n2) {
  if (n2.__P && n2.__d) {
    var u4 = n2.__v, t3 = u4.__e, i3 = [], r3 = [], o3 = w({}, u4);
    o3.__v = u4.__v + 1, l.vnode && l.vnode(o3), z(n2.__P, o3, u4, n2.__n, n2.__P.namespaceURI, 32 & u4.__u ? [t3] : null, i3, null == t3 ? S(u4) : t3, !!(32 & u4.__u), r3), o3.__v = u4.__v, o3.__.__k[o3.__i] = o3, V(i3, o3, r3), u4.__e = u4.__ = null, o3.__e != t3 && M(o3);
  }
}
function M(n2) {
  if (null != (n2 = n2.__) && null != n2.__c) return n2.__e = n2.__c.base = null, n2.__k.some(function(l3) {
    if (null != l3 && null != l3.__e) return n2.__e = n2.__c.base = l3.__e;
  }), M(n2);
}
function $(n2) {
  (!n2.__d && (n2.__d = true) && i.push(n2) && !I.__r++ || r != l.debounceRendering) && ((r = l.debounceRendering) || o)(I);
}
function I() {
  for (var n2, l3 = 1; i.length; ) i.length > l3 && i.sort(e), n2 = i.shift(), l3 = i.length, C(n2);
  I.__r = 0;
}
function P(n2, l3, u4, t3, i3, r3, o3, e3, f4, c3, s3) {
  var a3, h3, y3, d3, w3, g2, _2, m3 = t3 && t3.__k || v, b = l3.length;
  for (f4 = A(u4, l3, m3, f4, b), a3 = 0; a3 < b; a3++) null != (y3 = u4.__k[a3]) && (h3 = -1 != y3.__i && m3[y3.__i] || p, y3.__i = a3, g2 = z(n2, y3, h3, i3, r3, o3, e3, f4, c3, s3), d3 = y3.__e, y3.ref && h3.ref != y3.ref && (h3.ref && D(h3.ref, null, y3), s3.push(y3.ref, y3.__c || d3, y3)), null == w3 && null != d3 && (w3 = d3), (_2 = !!(4 & y3.__u)) || h3.__k === y3.__k ? f4 = H(y3, f4, n2, _2) : "function" == typeof y3.type && void 0 !== g2 ? f4 = g2 : d3 && (f4 = d3.nextSibling), y3.__u &= -7);
  return u4.__e = w3, f4;
}
function A(n2, l3, u4, t3, i3) {
  var r3, o3, e3, f4, c3, s3 = u4.length, a3 = s3, h3 = 0;
  for (n2.__k = new Array(i3), r3 = 0; r3 < i3; r3++) null != (o3 = l3[r3]) && "boolean" != typeof o3 && "function" != typeof o3 ? ("string" == typeof o3 || "number" == typeof o3 || "bigint" == typeof o3 || o3.constructor == String ? o3 = n2.__k[r3] = m(null, o3, null, null, null) : d(o3) ? o3 = n2.__k[r3] = m(k, { children: o3 }, null, null, null) : void 0 === o3.constructor && o3.__b > 0 ? o3 = n2.__k[r3] = m(o3.type, o3.props, o3.key, o3.ref ? o3.ref : null, o3.__v) : n2.__k[r3] = o3, f4 = r3 + h3, o3.__ = n2, o3.__b = n2.__b + 1, e3 = null, -1 != (c3 = o3.__i = T(o3, u4, f4, a3)) && (a3--, (e3 = u4[c3]) && (e3.__u |= 2)), null == e3 || null == e3.__v ? (-1 == c3 && (i3 > s3 ? h3-- : i3 < s3 && h3++), "function" != typeof o3.type && (o3.__u |= 4)) : c3 != f4 && (c3 == f4 - 1 ? h3-- : c3 == f4 + 1 ? h3++ : (c3 > f4 ? h3-- : h3++, o3.__u |= 4))) : n2.__k[r3] = null;
  if (a3) for (r3 = 0; r3 < s3; r3++) null != (e3 = u4[r3]) && 0 == (2 & e3.__u) && (e3.__e == t3 && (t3 = S(e3)), E(e3, e3));
  return t3;
}
function H(n2, l3, u4, t3) {
  var i3, r3;
  if ("function" == typeof n2.type) {
    for (i3 = n2.__k, r3 = 0; i3 && r3 < i3.length; r3++) i3[r3] && (i3[r3].__ = n2, l3 = H(i3[r3], l3, u4, t3));
    return l3;
  }
  n2.__e != l3 && (t3 && (l3 && n2.type && !l3.parentNode && (l3 = S(n2)), u4.insertBefore(n2.__e, l3 || null)), l3 = n2.__e);
  do {
    l3 = l3 && l3.nextSibling;
  } while (null != l3 && 8 == l3.nodeType);
  return l3;
}
function T(n2, l3, u4, t3) {
  var i3, r3, o3, e3 = n2.key, f4 = n2.type, c3 = l3[u4], s3 = null != c3 && 0 == (2 & c3.__u);
  if (null === c3 && null == e3 || s3 && e3 == c3.key && f4 == c3.type) return u4;
  if (t3 > (s3 ? 1 : 0)) {
    for (i3 = u4 - 1, r3 = u4 + 1; i3 >= 0 || r3 < l3.length; ) if (null != (c3 = l3[o3 = i3 >= 0 ? i3-- : r3++]) && 0 == (2 & c3.__u) && e3 == c3.key && f4 == c3.type) return o3;
  }
  return -1;
}
function j(n2, l3, u4) {
  "-" == l3[0] ? n2.setProperty(l3, null == u4 ? "" : u4) : n2[l3] = null == u4 ? "" : "number" != typeof u4 || y.test(l3) ? u4 : u4 + "px";
}
function F(n2, l3, u4, t3, i3) {
  var r3, o3;
  n: if ("style" == l3) if ("string" == typeof u4) n2.style.cssText = u4;
  else {
    if ("string" == typeof t3 && (n2.style.cssText = t3 = ""), t3) for (l3 in t3) u4 && l3 in u4 || j(n2.style, l3, "");
    if (u4) for (l3 in u4) t3 && u4[l3] == t3[l3] || j(n2.style, l3, u4[l3]);
  }
  else if ("o" == l3[0] && "n" == l3[1]) r3 = l3 != (l3 = l3.replace(f, "$1")), o3 = l3.toLowerCase(), l3 = o3 in n2 || "onFocusOut" == l3 || "onFocusIn" == l3 ? o3.slice(2) : l3.slice(2), n2.l || (n2.l = {}), n2.l[l3 + r3] = u4, u4 ? t3 ? u4.u = t3.u : (u4.u = c, n2.addEventListener(l3, r3 ? a : s, r3)) : n2.removeEventListener(l3, r3 ? a : s, r3);
  else {
    if ("http://www.w3.org/2000/svg" == i3) l3 = l3.replace(/xlink(H|:h)/, "h").replace(/sName$/, "s");
    else if ("width" != l3 && "height" != l3 && "href" != l3 && "list" != l3 && "form" != l3 && "tabIndex" != l3 && "download" != l3 && "rowSpan" != l3 && "colSpan" != l3 && "role" != l3 && "popover" != l3 && l3 in n2) try {
      n2[l3] = null == u4 ? "" : u4;
      break n;
    } catch (n3) {
    }
    "function" == typeof u4 || (null == u4 || false === u4 && "-" != l3[4] ? n2.removeAttribute(l3) : n2.setAttribute(l3, "popover" == l3 && 1 == u4 ? "" : u4));
  }
}
function O(n2) {
  return function(u4) {
    if (this.l) {
      var t3 = this.l[u4.type + n2];
      if (null == u4.t) u4.t = c++;
      else if (u4.t < t3.u) return;
      return t3(l.event ? l.event(u4) : u4);
    }
  };
}
function z(n2, u4, t3, i3, r3, o3, e3, f4, c3, s3) {
  var a3, h3, p3, y3, _2, m3, b, S2, C3, M2, $2, I2, A3, H2, L, T3 = u4.type;
  if (void 0 !== u4.constructor) return null;
  128 & t3.__u && (c3 = !!(32 & t3.__u), o3 = [f4 = u4.__e = t3.__e]), (a3 = l.__b) && a3(u4);
  n: if ("function" == typeof T3) try {
    if (S2 = u4.props, C3 = "prototype" in T3 && T3.prototype.render, M2 = (a3 = T3.contextType) && i3[a3.__c], $2 = a3 ? M2 ? M2.props.value : a3.__ : i3, t3.__c ? b = (h3 = u4.__c = t3.__c).__ = h3.__E : (C3 ? u4.__c = h3 = new T3(S2, $2) : (u4.__c = h3 = new x(S2, $2), h3.constructor = T3, h3.render = G), M2 && M2.sub(h3), h3.state || (h3.state = {}), h3.__n = i3, p3 = h3.__d = true, h3.__h = [], h3._sb = []), C3 && null == h3.__s && (h3.__s = h3.state), C3 && null != T3.getDerivedStateFromProps && (h3.__s == h3.state && (h3.__s = w({}, h3.__s)), w(h3.__s, T3.getDerivedStateFromProps(S2, h3.__s))), y3 = h3.props, _2 = h3.state, h3.__v = u4, p3) C3 && null == T3.getDerivedStateFromProps && null != h3.componentWillMount && h3.componentWillMount(), C3 && null != h3.componentDidMount && h3.__h.push(h3.componentDidMount);
    else {
      if (C3 && null == T3.getDerivedStateFromProps && S2 !== y3 && null != h3.componentWillReceiveProps && h3.componentWillReceiveProps(S2, $2), u4.__v == t3.__v || !h3.__e && null != h3.shouldComponentUpdate && false === h3.shouldComponentUpdate(S2, h3.__s, $2)) {
        u4.__v != t3.__v && (h3.props = S2, h3.state = h3.__s, h3.__d = false), u4.__e = t3.__e, u4.__k = t3.__k, u4.__k.some(function(n3) {
          n3 && (n3.__ = u4);
        }), v.push.apply(h3.__h, h3._sb), h3._sb = [], h3.__h.length && e3.push(h3);
        break n;
      }
      null != h3.componentWillUpdate && h3.componentWillUpdate(S2, h3.__s, $2), C3 && null != h3.componentDidUpdate && h3.__h.push(function() {
        h3.componentDidUpdate(y3, _2, m3);
      });
    }
    if (h3.context = $2, h3.props = S2, h3.__P = n2, h3.__e = false, I2 = l.__r, A3 = 0, C3) h3.state = h3.__s, h3.__d = false, I2 && I2(u4), a3 = h3.render(h3.props, h3.state, h3.context), v.push.apply(h3.__h, h3._sb), h3._sb = [];
    else do {
      h3.__d = false, I2 && I2(u4), a3 = h3.render(h3.props, h3.state, h3.context), h3.state = h3.__s;
    } while (h3.__d && ++A3 < 25);
    h3.state = h3.__s, null != h3.getChildContext && (i3 = w(w({}, i3), h3.getChildContext())), C3 && !p3 && null != h3.getSnapshotBeforeUpdate && (m3 = h3.getSnapshotBeforeUpdate(y3, _2)), H2 = null != a3 && a3.type === k && null == a3.key ? q(a3.props.children) : a3, f4 = P(n2, d(H2) ? H2 : [H2], u4, t3, i3, r3, o3, e3, f4, c3, s3), h3.base = u4.__e, u4.__u &= -161, h3.__h.length && e3.push(h3), b && (h3.__E = h3.__ = null);
  } catch (n3) {
    if (u4.__v = null, c3 || null != o3) if (n3.then) {
      for (u4.__u |= c3 ? 160 : 128; f4 && 8 == f4.nodeType && f4.nextSibling; ) f4 = f4.nextSibling;
      o3[o3.indexOf(f4)] = null, u4.__e = f4;
    } else {
      for (L = o3.length; L--; ) g(o3[L]);
      N(u4);
    }
    else u4.__e = t3.__e, u4.__k = t3.__k, n3.then || N(u4);
    l.__e(n3, u4, t3);
  }
  else null == o3 && u4.__v == t3.__v ? (u4.__k = t3.__k, u4.__e = t3.__e) : f4 = u4.__e = B(t3.__e, u4, t3, i3, r3, o3, e3, c3, s3);
  return (a3 = l.diffed) && a3(u4), 128 & u4.__u ? void 0 : f4;
}
function N(n2) {
  n2 && (n2.__c && (n2.__c.__e = true), n2.__k && n2.__k.some(N));
}
function V(n2, u4, t3) {
  for (var i3 = 0; i3 < t3.length; i3++) D(t3[i3], t3[++i3], t3[++i3]);
  l.__c && l.__c(u4, n2), n2.some(function(u5) {
    try {
      n2 = u5.__h, u5.__h = [], n2.some(function(n3) {
        n3.call(u5);
      });
    } catch (n3) {
      l.__e(n3, u5.__v);
    }
  });
}
function q(n2) {
  return "object" != typeof n2 || null == n2 || n2.__b > 0 ? n2 : d(n2) ? n2.map(q) : w({}, n2);
}
function B(u4, t3, i3, r3, o3, e3, f4, c3, s3) {
  var a3, h3, v3, y3, w3, _2, m3, b = i3.props || p, k3 = t3.props, x2 = t3.type;
  if ("svg" == x2 ? o3 = "http://www.w3.org/2000/svg" : "math" == x2 ? o3 = "http://www.w3.org/1998/Math/MathML" : o3 || (o3 = "http://www.w3.org/1999/xhtml"), null != e3) {
    for (a3 = 0; a3 < e3.length; a3++) if ((w3 = e3[a3]) && "setAttribute" in w3 == !!x2 && (x2 ? w3.localName == x2 : 3 == w3.nodeType)) {
      u4 = w3, e3[a3] = null;
      break;
    }
  }
  if (null == u4) {
    if (null == x2) return document.createTextNode(k3);
    u4 = document.createElementNS(o3, x2, k3.is && k3), c3 && (l.__m && l.__m(t3, e3), c3 = false), e3 = null;
  }
  if (null == x2) b === k3 || c3 && u4.data == k3 || (u4.data = k3);
  else {
    if (e3 = e3 && n.call(u4.childNodes), !c3 && null != e3) for (b = {}, a3 = 0; a3 < u4.attributes.length; a3++) b[(w3 = u4.attributes[a3]).name] = w3.value;
    for (a3 in b) w3 = b[a3], "dangerouslySetInnerHTML" == a3 ? v3 = w3 : "children" == a3 || a3 in k3 || "value" == a3 && "defaultValue" in k3 || "checked" == a3 && "defaultChecked" in k3 || F(u4, a3, null, w3, o3);
    for (a3 in k3) w3 = k3[a3], "children" == a3 ? y3 = w3 : "dangerouslySetInnerHTML" == a3 ? h3 = w3 : "value" == a3 ? _2 = w3 : "checked" == a3 ? m3 = w3 : c3 && "function" != typeof w3 || b[a3] === w3 || F(u4, a3, w3, b[a3], o3);
    if (h3) c3 || v3 && (h3.__html == v3.__html || h3.__html == u4.innerHTML) || (u4.innerHTML = h3.__html), t3.__k = [];
    else if (v3 && (u4.innerHTML = ""), P("template" == t3.type ? u4.content : u4, d(y3) ? y3 : [y3], t3, i3, r3, "foreignObject" == x2 ? "http://www.w3.org/1999/xhtml" : o3, e3, f4, e3 ? e3[0] : i3.__k && S(i3, 0), c3, s3), null != e3) for (a3 = e3.length; a3--; ) g(e3[a3]);
    c3 || (a3 = "value", "progress" == x2 && null == _2 ? u4.removeAttribute("value") : null != _2 && (_2 !== u4[a3] || "progress" == x2 && !_2 || "option" == x2 && _2 != b[a3]) && F(u4, a3, _2, b[a3], o3), a3 = "checked", null != m3 && m3 != u4[a3] && F(u4, a3, m3, b[a3], o3));
  }
  return u4;
}
function D(n2, u4, t3) {
  try {
    if ("function" == typeof n2) {
      var i3 = "function" == typeof n2.__u;
      i3 && n2.__u(), i3 && null == u4 || (n2.__u = n2(u4));
    } else n2.current = u4;
  } catch (n3) {
    l.__e(n3, t3);
  }
}
function E(n2, u4, t3) {
  var i3, r3;
  if (l.unmount && l.unmount(n2), (i3 = n2.ref) && (i3.current && i3.current != n2.__e || D(i3, null, u4)), null != (i3 = n2.__c)) {
    if (i3.componentWillUnmount) try {
      i3.componentWillUnmount();
    } catch (n3) {
      l.__e(n3, u4);
    }
    i3.base = i3.__P = null;
  }
  if (i3 = n2.__k) for (r3 = 0; r3 < i3.length; r3++) i3[r3] && E(i3[r3], u4, t3 || "function" != typeof n2.type);
  t3 || g(n2.__e), n2.__c = n2.__ = n2.__e = void 0;
}
function G(n2, l3, u4) {
  return this.constructor(n2, u4);
}
function J(u4, t3, i3) {
  var r3, o3, e3, f4;
  t3 == document && (t3 = document.documentElement), l.__ && l.__(u4, t3), o3 = (r3 = "function" == typeof i3) ? null : i3 && i3.__k || t3.__k, e3 = [], f4 = [], z(t3, u4 = (!r3 && i3 || t3).__k = _(k, null, [u4]), o3 || p, p, t3.namespaceURI, !r3 && i3 ? [i3] : o3 ? null : t3.firstChild ? n.call(t3.childNodes) : null, e3, !r3 && i3 ? i3 : o3 ? o3.__e : t3.firstChild, r3, f4), V(e3, u4, f4);
}
n = v.slice, l = { __e: function(n2, l3, u4, t3) {
  for (var i3, r3, o3; l3 = l3.__; ) if ((i3 = l3.__c) && !i3.__) try {
    if ((r3 = i3.constructor) && null != r3.getDerivedStateFromError && (i3.setState(r3.getDerivedStateFromError(n2)), o3 = i3.__d), null != i3.componentDidCatch && (i3.componentDidCatch(n2, t3 || {}), o3 = i3.__d), o3) return i3.__E = i3;
  } catch (l4) {
    n2 = l4;
  }
  throw n2;
} }, u = 0, t = function(n2) {
  return null != n2 && void 0 === n2.constructor;
}, x.prototype.setState = function(n2, l3) {
  var u4;
  u4 = null != this.__s && this.__s != this.state ? this.__s : this.__s = w({}, this.state), "function" == typeof n2 && (n2 = n2(w({}, u4), this.props)), n2 && w(u4, n2), null != n2 && this.__v && (l3 && this._sb.push(l3), $(this));
}, x.prototype.forceUpdate = function(n2) {
  this.__v && (this.__e = true, n2 && this.__h.push(n2), $(this));
}, x.prototype.render = k, i = [], o = "function" == typeof Promise ? Promise.prototype.then.bind(Promise.resolve()) : setTimeout, e = function(n2, l3) {
  return n2.__v.__b - l3.__v.__b;
}, I.__r = 0, f = /(PointerCapture)$|Capture$/i, c = 0, s = O(false), a = O(true), h = 0;

// node_modules/preact/hooks/dist/hooks.module.js
var t2;
var r2;
var u2;
var i2;
var o2 = 0;
var f2 = [];
var c2 = l;
var e2 = c2.__b;
var a2 = c2.__r;
var v2 = c2.diffed;
var l2 = c2.__c;
var m2 = c2.unmount;
var s2 = c2.__;
function p2(n2, t3) {
  c2.__h && c2.__h(r2, n2, o2 || t3), o2 = 0;
  var u4 = r2.__H || (r2.__H = { __: [], __h: [] });
  return n2 >= u4.__.length && u4.__.push({}), u4.__[n2];
}
function d2(n2) {
  return o2 = 1, h2(D2, n2);
}
function h2(n2, u4, i3) {
  var o3 = p2(t2++, 2);
  if (o3.t = n2, !o3.__c && (o3.__ = [i3 ? i3(u4) : D2(void 0, u4), function(n3) {
    var t3 = o3.__N ? o3.__N[0] : o3.__[0], r3 = o3.t(t3, n3);
    t3 !== r3 && (o3.__N = [r3, o3.__[1]], o3.__c.setState({}));
  }], o3.__c = r2, !r2.__f)) {
    var f4 = function(n3, t3, r3) {
      if (!o3.__c.__H) return true;
      var u5 = o3.__c.__H.__.filter(function(n4) {
        return n4.__c;
      });
      if (u5.every(function(n4) {
        return !n4.__N;
      })) return !c3 || c3.call(this, n3, t3, r3);
      var i4 = o3.__c.props !== n3;
      return u5.some(function(n4) {
        if (n4.__N) {
          var t4 = n4.__[0];
          n4.__ = n4.__N, n4.__N = void 0, t4 !== n4.__[0] && (i4 = true);
        }
      }), c3 && c3.call(this, n3, t3, r3) || i4;
    };
    r2.__f = true;
    var c3 = r2.shouldComponentUpdate, e3 = r2.componentWillUpdate;
    r2.componentWillUpdate = function(n3, t3, r3) {
      if (this.__e) {
        var u5 = c3;
        c3 = void 0, f4(n3, t3, r3), c3 = u5;
      }
      e3 && e3.call(this, n3, t3, r3);
    }, r2.shouldComponentUpdate = f4;
  }
  return o3.__N || o3.__;
}
function y2(n2, u4) {
  var i3 = p2(t2++, 3);
  !c2.__s && C2(i3.__H, u4) && (i3.__ = n2, i3.u = u4, r2.__H.__h.push(i3));
}
function A2(n2) {
  return o2 = 5, T2(function() {
    return { current: n2 };
  }, []);
}
function T2(n2, r3) {
  var u4 = p2(t2++, 7);
  return C2(u4.__H, r3) && (u4.__ = n2(), u4.__H = r3, u4.__h = n2), u4.__;
}
function q2(n2, t3) {
  return o2 = 8, T2(function() {
    return n2;
  }, t3);
}
function j2() {
  for (var n2; n2 = f2.shift(); ) {
    var t3 = n2.__H;
    if (n2.__P && t3) try {
      t3.__h.some(z2), t3.__h.some(B2), t3.__h = [];
    } catch (r3) {
      t3.__h = [], c2.__e(r3, n2.__v);
    }
  }
}
c2.__b = function(n2) {
  r2 = null, e2 && e2(n2);
}, c2.__ = function(n2, t3) {
  n2 && t3.__k && t3.__k.__m && (n2.__m = t3.__k.__m), s2 && s2(n2, t3);
}, c2.__r = function(n2) {
  a2 && a2(n2), t2 = 0;
  var i3 = (r2 = n2.__c).__H;
  i3 && (u2 === r2 ? (i3.__h = [], r2.__h = [], i3.__.some(function(n3) {
    n3.__N && (n3.__ = n3.__N), n3.u = n3.__N = void 0;
  })) : (i3.__h.some(z2), i3.__h.some(B2), i3.__h = [], t2 = 0)), u2 = r2;
}, c2.diffed = function(n2) {
  v2 && v2(n2);
  var t3 = n2.__c;
  t3 && t3.__H && (t3.__H.__h.length && (1 !== f2.push(t3) && i2 === c2.requestAnimationFrame || ((i2 = c2.requestAnimationFrame) || w2)(j2)), t3.__H.__.some(function(n3) {
    n3.u && (n3.__H = n3.u), n3.u = void 0;
  })), u2 = r2 = null;
}, c2.__c = function(n2, t3) {
  t3.some(function(n3) {
    try {
      n3.__h.some(z2), n3.__h = n3.__h.filter(function(n4) {
        return !n4.__ || B2(n4);
      });
    } catch (r3) {
      t3.some(function(n4) {
        n4.__h && (n4.__h = []);
      }), t3 = [], c2.__e(r3, n3.__v);
    }
  }), l2 && l2(n2, t3);
}, c2.unmount = function(n2) {
  m2 && m2(n2);
  var t3, r3 = n2.__c;
  r3 && r3.__H && (r3.__H.__.some(function(n3) {
    try {
      z2(n3);
    } catch (n4) {
      t3 = n4;
    }
  }), r3.__H = void 0, t3 && c2.__e(t3, r3.__v));
};
var k2 = "function" == typeof requestAnimationFrame;
function w2(n2) {
  var t3, r3 = function() {
    clearTimeout(u4), k2 && cancelAnimationFrame(t3), setTimeout(n2);
  }, u4 = setTimeout(r3, 35);
  k2 && (t3 = requestAnimationFrame(r3));
}
function z2(n2) {
  var t3 = r2, u4 = n2.__c;
  "function" == typeof u4 && (n2.__c = void 0, u4()), r2 = t3;
}
function B2(n2) {
  var t3 = r2;
  n2.__c = n2.__(), r2 = t3;
}
function C2(n2, t3) {
  return !n2 || n2.length !== t3.length || t3.some(function(t4, r3) {
    return t4 !== n2[r3];
  });
}
function D2(n2, t3) {
  return "function" == typeof t3 ? t3(n2) : t3;
}

// dev/ui/src/lib/router.js
var TOP_ROUTES = ["generations", "posts", "timeline", "settings"];
function getRoute() {
  const segments = location.pathname.replace(/^\/+/, "").split("/").filter(Boolean);
  const top = TOP_ROUTES.includes(segments[0]) ? segments[0] : "generations";
  const sub = segments[1] || null;
  return { top, sub };
}
function navigate(route) {
  history.pushState(null, "", `/${route}`);
  window.dispatchEvent(new Event("popstate"));
}

// node_modules/preact/jsx-runtime/dist/jsxRuntime.module.js
var f3 = 0;
function u3(e3, t3, n2, o3, i3, u4) {
  t3 || (t3 = {});
  var a3, c3, p3 = t3;
  if ("ref" in p3) for (c3 in p3 = {}, t3) "ref" == c3 ? a3 = t3[c3] : p3[c3] = t3[c3];
  var l3 = { type: e3, props: p3, key: n2, ref: a3, __k: null, __: null, __b: 0, __e: null, __c: null, constructor: void 0, __v: --f3, __i: -1, __u: 0, __source: i3, __self: u4 };
  if ("function" == typeof e3 && (a3 = e3.defaultProps)) for (c3 in a3) void 0 === p3[c3] && (p3[c3] = a3[c3]);
  return l.vnode && l.vnode(l3), l3;
}

// dev/ui/src/components/Nav.jsx
var TABS = [
  { id: "generations", label: "Generations" },
  { id: "posts", label: "Posts" },
  { id: "timeline", label: "Timeline" },
  { id: "settings", label: "Settings" }
];
function Nav({ route, username }) {
  function go(e3, id) {
    e3.preventDefault();
    navigate(id);
  }
  return /* @__PURE__ */ u3("nav", { class: "nav", children: [
    /* @__PURE__ */ u3("div", { class: "nav-logo", children: [
      /* @__PURE__ */ u3("span", { class: "civit", children: "civit" }),
      /* @__PURE__ */ u3("span", { class: "ai", children: "ai" }),
      /* @__PURE__ */ u3("span", { class: "sync", children: "-sync" })
    ] }),
    /* @__PURE__ */ u3("div", { class: "nav-tabs", children: TABS.map((tab) => /* @__PURE__ */ u3(
      "a",
      {
        class: `nav-tab${route === tab.id ? " active" : ""}`,
        href: `/${tab.id}`,
        onClick: (e3) => go(e3, tab.id),
        children: tab.label
      },
      tab.id
    )) }),
    username && /* @__PURE__ */ u3("div", { class: "nav-username", children: username })
  ] });
}

// dev/ui/src/api.js
async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}
async function postJson(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  return res.json();
}
async function putJson(url, body) {
  const res = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  return res.json();
}
function getStats() {
  return fetchJson("/api/stats");
}
function getGenerations({ page = 1, limit = 50, sort = "newest", tags = "", search = "" } = {}) {
  const params = new URLSearchParams({ page, limit, sort });
  if (tags) params.set("tags", tags);
  if (search) params.set("search", search);
  return fetchJson(`/api/generations?${params}`);
}
function getGeneration(id) {
  return fetchJson(`/api/generations/${encodeURIComponent(id)}`);
}
function getPosts({ page = 1, limit = 50, sort = "newest", tags = "", search = "" } = {}) {
  const params = new URLSearchParams({ page, limit, sort });
  if (tags) params.set("tags", tags);
  if (search) params.set("search", search);
  return fetchJson(`/api/posts?${params}`);
}
function getPost(id) {
  return fetchJson(`/api/posts/${id}`);
}
function getConfig() {
  return fetchJson("/api/config");
}
function updateConfig(updates) {
  return putJson("/api/config", updates);
}
function getDownloadStatus() {
  return fetchJson("/api/download/status");
}
function startDownload(type, mode) {
  return postJson(`/api/download/${type}`, { mode });
}
function abortDownload() {
  return postJson("/api/download/abort", {});
}
function rebuildIndex() {
  return postJson("/api/index/rebuild", {});
}
function getTimelineMonths() {
  return fetchJson("/api/timeline/months");
}
function getTimelineMonth(monthKey) {
  return fetchJson(`/api/timeline/${monthKey}`);
}
function unlockKey(password) {
  return postJson("/api/unlock", { password });
}
function openFolder(mediaPath) {
  return postJson("/api/open-folder", { path: mediaPath });
}
function connectProgress(onEvent) {
  let es = null;
  let timer = null;
  let closed = false;
  let retries = 0;
  function connect() {
    if (closed) return;
    es = new EventSource("/api/download/progress");
    es.onmessage = (e3) => {
      retries = 0;
      try {
        onEvent(JSON.parse(e3.data));
      } catch {
      }
    };
    es.onerror = () => {
      es.close();
      es = null;
      if (closed) return;
      retries++;
      const delay = Math.min(3e4, 3e3 * Math.pow(2, retries - 1));
      timer = setTimeout(connect, delay);
    };
  }
  connect();
  return () => {
    closed = true;
    if (timer) clearTimeout(timer);
    if (es) es.close();
  };
}

// dev/ui/src/components/StatsBar.jsx
function StatsBar({ stats }) {
  if (!stats) return null;
  const imgCount = stats.genImages ?? stats.totalImages;
  const vidCount = stats.genVideos ?? stats.totalVideos;
  const items = [
    stats.totalGenerations != null && { label: "generations", value: stats.totalGenerations },
    imgCount != null && { label: "images", value: imgCount },
    vidCount > 0 && { label: "videos", value: vidCount },
    stats.totalFavorites > 0 && { label: "favorites", value: stats.totalFavorites },
    stats.totalLiked > 0 && { label: "liked", value: stats.totalLiked },
    stats.generationDateRange?.from && {
      label: "",
      value: `${stats.generationDateRange.from} \u2014 ${stats.generationDateRange.to}`
    }
  ].filter(Boolean);
  return /* @__PURE__ */ u3("div", { class: "stats-bar", children: items.map((item, i3) => /* @__PURE__ */ u3(k, { children: [
    i3 > 0 && /* @__PURE__ */ u3("span", { class: "stat-separator", children: "\xB7" }),
    /* @__PURE__ */ u3("span", { class: "stat-item", children: item.label ? /* @__PURE__ */ u3(k, { children: [
      /* @__PURE__ */ u3("strong", { children: item.value.toLocaleString() }),
      " ",
      item.label
    ] }) : item.value })
  ] })) });
}

// dev/ui/src/lib/format.js
var TAG_LABELS = {
  "favorite": "\u2764\uFE0F Favorite",
  "feedback:liked": "\u{1F44D} Liked",
  "feedback:disliked": "\u{1F44E} Disliked"
};
function tagLabel(tag) {
  if (typeof tag === "object") return tag.name;
  return TAG_LABELS[tag] || tag;
}
function tagCssClass(tag) {
  const name = typeof tag === "string" ? tag : tag.name || "";
  return name.replace(/:/g, "-").replace(/\s+/g, "-").toLowerCase();
}
function formatDate(isoString) {
  if (!isoString) return "";
  const date = new Date(isoString);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function relativeTime(isoString) {
  if (!isoString) return "";
  const diff = Date.now() - new Date(isoString).getTime();
  const days = Math.floor(diff / 864e5);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return months === 1 ? "1 month ago" : `${months} months ago`;
  const years = Math.floor(days / 365);
  return years === 1 ? "1 year ago" : `${years} years ago`;
}
function highlightTerms(text, search) {
  if (!search || !text) return [text];
  const terms = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return [text];
  const pattern = terms.map((t3) => t3.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const re = new RegExp(`(${pattern})`, "gi");
  return text.split(re);
}
async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
    return true;
  }
}

// dev/ui/src/components/FilterBar.jsx
var GEN_TAGS = ["favorite", "feedback:liked", "feedback:disliked"];
function FilterBar({ activeTags, onTagToggle, sort, onSortToggle, search, onSearchInput, searchRef }) {
  return /* @__PURE__ */ u3("div", { class: "filter-bar", children: [
    /* @__PURE__ */ u3("div", { class: "filter-tags", children: GEN_TAGS.map((tag) => {
      const cls = tag === "favorite" ? "favorite" : tag === "feedback:liked" ? "liked" : "";
      return /* @__PURE__ */ u3(
        "button",
        {
          class: `tag-chip ${cls}${activeTags.includes(tag) ? " active" : ""}`,
          onClick: () => onTagToggle(tag),
          children: tagLabel(tag)
        },
        tag
      );
    }) }),
    /* @__PURE__ */ u3("div", { class: "filter-controls", children: [
      /* @__PURE__ */ u3("button", { class: "sort-toggle", onClick: onSortToggle, children: sort === "newest" ? "\u2193 Newest" : "\u2191 Oldest" }),
      /* @__PURE__ */ u3(
        "input",
        {
          ref: searchRef,
          type: "search",
          class: "search-input",
          placeholder: "Search prompts\u2026",
          value: search,
          onInput: (e3) => onSearchInput(e3.target.value)
        }
      )
    ] })
  ] });
}

// dev/ui/src/components/HighlightText.jsx
function HighlightText({ text, search }) {
  if (!search || !text) return text || null;
  const parts = highlightTerms(text, search);
  if (parts.length <= 1) return text;
  const terms = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return parts.map(
    (part, i3) => terms.includes(part.toLowerCase()) ? /* @__PURE__ */ u3("mark", { class: "search-highlight", children: part }, i3) : part
  );
}

// dev/ui/src/components/GalleryItem.jsx
function GalleryItem({ item, onClick, search }) {
  const first = item.media[0];
  if (!first) return null;
  const hasFav = item.tags.includes("favorite");
  const hasLiked = item.tags.includes("feedback:liked");
  const hasDisliked = item.tags.includes("feedback:disliked");
  const isVideo = first.type === "video";
  const dateStr = formatDate(item.createdAt);
  const snippet = search && item.prompt ? item.prompt.slice(0, 120) : null;
  return /* @__PURE__ */ u3("div", { class: "gallery-item", onClick, title: dateStr, children: [
    isVideo ? /* @__PURE__ */ u3("video", { src: first.thumbnailPath, preload: "metadata", muted: true, playsInline: true }) : /* @__PURE__ */ u3("img", { src: first.thumbnailPath, loading: "lazy", alt: "" }),
    isVideo && /* @__PURE__ */ u3("div", { class: "video-badge" }),
    item.mediaCount > 1 && /* @__PURE__ */ u3("span", { class: "media-badge", children: item.mediaCount }),
    snippet ? /* @__PURE__ */ u3("div", { class: "hover-info search-snippet", children: /* @__PURE__ */ u3(HighlightText, { text: snippet, search }) }) : /* @__PURE__ */ u3("div", { class: "hover-info", children: dateStr }),
    (hasFav || hasLiked || hasDisliked) && /* @__PURE__ */ u3("div", { class: "tag-indicators", children: [
      hasFav && /* @__PURE__ */ u3("span", { class: "tag-indicator favorite", children: "\u2764\uFE0F" }),
      hasLiked && /* @__PURE__ */ u3("span", { class: "tag-indicator liked", children: "\u{1F44D}" }),
      hasDisliked && /* @__PURE__ */ u3("span", { class: "tag-indicator disliked", children: "\u{1F44E}" })
    ] })
  ] });
}

// dev/ui/src/components/Gallery.jsx
function Gallery({ items, onItemClick, sentinelRef, loading, hasMore, search }) {
  if (!items.length && !loading) {
    return /* @__PURE__ */ u3("div", { class: "empty-state", children: [
      /* @__PURE__ */ u3("h2", { children: "No results" }),
      /* @__PURE__ */ u3("p", { children: "Try adjusting your filters or search query." })
    ] });
  }
  return /* @__PURE__ */ u3(k, { children: [
    /* @__PURE__ */ u3("div", { class: "gallery-grid", children: items.map((item, i3) => /* @__PURE__ */ u3(GalleryItem, { item, onClick: () => onItemClick(i3), search }, item.id)) }),
    /* @__PURE__ */ u3("div", { ref: sentinelRef, class: "gallery-sentinel" }),
    loading && /* @__PURE__ */ u3("div", { class: "loading-bar", children: /* @__PURE__ */ u3("div", { class: "spinner" }) })
  ] });
}

// dev/ui/src/components/Lightbox.jsx
function Lightbox({ item, onClose, onPrev, onNext, search }) {
  const [mediaIdx, setMediaIdx] = d2(0);
  const [copied, setCopied] = d2(null);
  const [detail, setDetail] = d2(null);
  y2(() => {
    setMediaIdx(0);
    setDetail(null);
  }, [item.id]);
  y2(() => {
    let cancelled = false;
    getGeneration(item.id).then((d3) => {
      if (!cancelled) setDetail(d3.raw);
    }).catch(() => {
    });
    return () => {
      cancelled = true;
    };
  }, [item.id]);
  const handleKey = q2((e3) => {
    if (e3.key === "Escape") return onClose();
    if (item.media.length > 1) {
      if (e3.key === "ArrowLeft") setMediaIdx((i3) => Math.max(0, i3 - 1));
      if (e3.key === "ArrowRight") setMediaIdx((i3) => Math.min(item.media.length - 1, i3 + 1));
    } else {
      if (e3.key === "ArrowLeft" && onPrev) onPrev();
      if (e3.key === "ArrowRight" && onNext) onNext();
    }
  }, [item, onClose, onPrev, onNext]);
  y2(() => {
    document.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [handleKey]);
  const cur = item.media[mediaIdx];
  const isVideo = cur?.type === "video";
  const dateStr = item.createdAt || item.publishedAt;
  const resources = (detail?.steps?.[0]?.resources || []).map((r3) => ({
    name: r3.model?.name || r3.name || "Unknown",
    type: r3.modelType || r3.model?.type || "",
    strength: r3.strength
  }));
  async function doCopy(text, label) {
    await copyToClipboard(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 1500);
  }
  return /* @__PURE__ */ u3("div", { class: "lightbox-overlay", onClick: (e3) => {
    if (e3.target === e3.currentTarget) onClose();
  }, children: [
    /* @__PURE__ */ u3("button", { class: "lightbox-close", onClick: onClose, "aria-label": "Close", children: "\u2715" }),
    /* @__PURE__ */ u3("div", { class: "lightbox-container", children: [
      /* @__PURE__ */ u3("div", { class: "lightbox-image-area", children: [
        onPrev && item.media.length <= 1 && /* @__PURE__ */ u3("button", { class: "lightbox-nav-arrow prev", onClick: onPrev, children: "\u2039" }),
        isVideo ? /* @__PURE__ */ u3("video", { src: cur.thumbnailPath, controls: true, autoPlay: true, loop: true }) : /* @__PURE__ */ u3("img", { src: cur.thumbnailPath, alt: "" }),
        onNext && item.media.length <= 1 && /* @__PURE__ */ u3("button", { class: "lightbox-nav-arrow next", onClick: onNext, children: "\u203A" }),
        item.media.length > 1 && /* @__PURE__ */ u3("div", { class: "lightbox-image-nav", children: [
          /* @__PURE__ */ u3("button", { disabled: mediaIdx === 0, onClick: () => setMediaIdx((i3) => i3 - 1), children: "\u2039" }),
          /* @__PURE__ */ u3("span", { children: [
            mediaIdx + 1,
            " / ",
            item.media.length
          ] }),
          /* @__PURE__ */ u3("button", { disabled: mediaIdx === item.media.length - 1, onClick: () => setMediaIdx((i3) => i3 + 1), children: "\u203A" })
        ] })
      ] }),
      /* @__PURE__ */ u3("div", { class: "lightbox-meta", children: [
        /* @__PURE__ */ u3("div", { class: "meta-section", children: [
          /* @__PURE__ */ u3("div", { class: "meta-date", children: formatDate(dateStr) }),
          /* @__PURE__ */ u3("div", { class: "meta-relative", children: relativeTime(dateStr) }),
          /* @__PURE__ */ u3("div", { class: "meta-id", children: item.id })
        ] }),
        item.prompt && /* @__PURE__ */ u3("div", { class: "meta-section", children: [
          /* @__PURE__ */ u3("div", { class: "meta-label", children: "Prompt" }),
          /* @__PURE__ */ u3("div", { class: "meta-prompt", children: /* @__PURE__ */ u3(HighlightText, { text: item.prompt, search }) }),
          /* @__PURE__ */ u3("div", { class: "meta-actions", children: /* @__PURE__ */ u3(
            "button",
            {
              class: `meta-action${copied === "prompt" ? " copied" : ""}`,
              onClick: () => doCopy(item.prompt, "prompt"),
              children: copied === "prompt" ? "Copied" : "Copy prompt"
            }
          ) })
        ] }),
        item.negativePrompt && /* @__PURE__ */ u3("div", { class: "meta-section", children: [
          /* @__PURE__ */ u3("div", { class: "meta-label", children: "Negative Prompt" }),
          /* @__PURE__ */ u3("div", { class: "meta-prompt meta-neg-prompt", children: item.negativePrompt })
        ] }),
        item.model && /* @__PURE__ */ u3("div", { class: "meta-section", children: [
          /* @__PURE__ */ u3("div", { class: "meta-label", children: "Model" }),
          /* @__PURE__ */ u3("div", { class: "meta-value", children: item.model })
        ] }),
        item.params && /* @__PURE__ */ u3("div", { class: "meta-section", children: [
          /* @__PURE__ */ u3("div", { class: "meta-label", children: "Parameters" }),
          /* @__PURE__ */ u3("div", { class: "meta-params", children: [
            cur?.seed && /* @__PURE__ */ u3("span", { class: "param-chip", children: [
              "Seed ",
              cur.seed
            ] }),
            item.params.steps > 0 && /* @__PURE__ */ u3("span", { class: "param-chip", children: [
              item.params.steps,
              " steps"
            ] }),
            item.params.sampler && /* @__PURE__ */ u3("span", { class: "param-chip", children: item.params.sampler }),
            item.params.cfgScale > 0 && /* @__PURE__ */ u3("span", { class: "param-chip", children: [
              "CFG ",
              item.params.cfgScale
            ] }),
            item.params.width > 0 && item.params.height > 0 && /* @__PURE__ */ u3("span", { class: "param-chip", children: [
              item.params.width,
              "\xD7",
              item.params.height
            ] })
          ] })
        ] }),
        resources.length > 0 && /* @__PURE__ */ u3("div", { class: "meta-section", children: [
          /* @__PURE__ */ u3("div", { class: "meta-label", children: "Resources" }),
          /* @__PURE__ */ u3("div", { class: "meta-resources", children: resources.map((r3, i3) => /* @__PURE__ */ u3("div", { class: "resource-item", children: [
            /* @__PURE__ */ u3("span", { class: "resource-name", children: r3.name }),
            r3.type && /* @__PURE__ */ u3("span", { class: "resource-type", children: r3.type }),
            r3.strength != null && r3.strength !== 1 && /* @__PURE__ */ u3("span", { class: "resource-strength", children: [
              "@ ",
              r3.strength
            ] })
          ] }, i3)) })
        ] }),
        item.tags.length > 0 && /* @__PURE__ */ u3("div", { class: "meta-section", children: [
          /* @__PURE__ */ u3("div", { class: "meta-label", children: "Tags" }),
          /* @__PURE__ */ u3("div", { class: "meta-tags", children: item.tags.map((tag) => /* @__PURE__ */ u3("span", { class: `meta-tag ${tagCssClass(tag)}`, children: tagLabel(tag) }, typeof tag === "string" ? tag : tag.id)) })
        ] }),
        /* @__PURE__ */ u3("div", { class: "meta-section", children: /* @__PURE__ */ u3("div", { class: "meta-actions", children: cur && /* @__PURE__ */ u3("button", { class: "meta-action", onClick: () => openFolder(cur.thumbnailPath), children: "Open folder" }) }) })
      ] })
    ] })
  ] });
}

// dev/ui/src/hooks/useInfiniteScroll.js
function useInfiniteScroll(callback) {
  const cbRef = A2(callback);
  cbRef.current = callback;
  const observerRef = A2(null);
  const sentinelRef = q2((el) => {
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) cbRef.current();
      },
      { rootMargin: "400px" }
    );
    observer.observe(el);
    observerRef.current = observer;
  }, []);
  return sentinelRef;
}

// dev/ui/src/components/GenerationsView.jsx
function GenerationsView() {
  const [items, setItems] = d2([]);
  const [stats, setStats] = d2(null);
  const [page, setPage] = d2(1);
  const [totalPages, setTotalPages] = d2(1);
  const [loading, setLoading] = d2(false);
  const [sort, setSort] = d2("newest");
  const [activeTags, setActiveTags] = d2([]);
  const [searchInput, setSearchInput] = d2("");
  const [search, setSearch] = d2("");
  const [selectedIdx, setSelectedIdx] = d2(null);
  const fetchId = A2(0);
  y2(() => {
    getStats().then(setStats).catch(() => {
    });
  }, []);
  y2(() => {
    const t3 = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(t3);
  }, [searchInput]);
  y2(() => {
    setItems([]);
    setPage(1);
    setTotalPages(1);
  }, [sort, activeTags, search]);
  y2(() => {
    const id = ++fetchId.current;
    setLoading(true);
    const tags = activeTags.join(",");
    getGenerations({ page, sort, tags, search }).then((data) => {
      if (id !== fetchId.current) return;
      setTotalPages(data.totalPages);
      setItems((prev) => page === 1 ? data.items : [...prev, ...data.items]);
    }).catch(() => {
    }).finally(() => {
      if (id === fetchId.current) setLoading(false);
    });
  }, [page, sort, activeTags, search]);
  const loadMore = q2(() => {
    if (!loading && page < totalPages) setPage((p3) => p3 + 1);
  }, [loading, page, totalPages]);
  const sentinelRef = useInfiniteScroll(loadMore);
  function toggleTag(tag) {
    setActiveTags(
      (prev) => prev.includes(tag) ? prev.filter((t3) => t3 !== tag) : [...prev, tag]
    );
  }
  function handleSortToggle() {
    setSort((s3) => s3 === "newest" ? "oldest" : "newest");
  }
  const selectedItem = selectedIdx != null ? items[selectedIdx] : null;
  const searchRef = A2(null);
  y2(() => {
    if (selectedItem) return;
    function onKey(e3) {
      const tag = e3.target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e3.key === "j") window.scrollBy({ top: 300, behavior: "smooth" });
      else if (e3.key === "k") window.scrollBy({ top: -300, behavior: "smooth" });
      else if (e3.key === "f") toggleTag("favorite");
      else if (e3.key === "/") {
        e3.preventDefault();
        searchRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [selectedItem, activeTags]);
  return /* @__PURE__ */ u3("div", { class: "main-content", children: [
    /* @__PURE__ */ u3(StatsBar, { stats }),
    /* @__PURE__ */ u3(
      FilterBar,
      {
        activeTags,
        onTagToggle: toggleTag,
        sort,
        onSortToggle: handleSortToggle,
        search: searchInput,
        onSearchInput: setSearchInput,
        searchRef
      }
    ),
    /* @__PURE__ */ u3(
      Gallery,
      {
        items,
        onItemClick: setSelectedIdx,
        sentinelRef,
        loading,
        hasMore: page < totalPages,
        search
      }
    ),
    selectedItem && /* @__PURE__ */ u3(
      Lightbox,
      {
        item: selectedItem,
        onClose: () => setSelectedIdx(null),
        onPrev: selectedIdx > 0 ? () => setSelectedIdx((i3) => i3 - 1) : null,
        onNext: selectedIdx < items.length - 1 ? () => setSelectedIdx((i3) => i3 + 1) : null,
        search
      }
    )
  ] });
}

// dev/ui/src/components/PostStatsBar.jsx
function PostStatsBar({ stats, postTotal }) {
  if (!stats) return null;
  const imgCount = stats.postImages ?? stats.totalImages;
  const vidCount = stats.postVideos ?? stats.totalVideos;
  const items = [
    postTotal != null && { label: "posts", value: postTotal },
    imgCount != null && { label: "images", value: imgCount },
    vidCount > 0 && { label: "videos", value: vidCount },
    stats.postDateRange?.from && {
      label: "",
      value: `${stats.postDateRange.from} \u2014 ${stats.postDateRange.to}`
    }
  ].filter(Boolean);
  return /* @__PURE__ */ u3("div", { class: "stats-bar", children: items.map((item, i3) => /* @__PURE__ */ u3(k, { children: [
    i3 > 0 && /* @__PURE__ */ u3("span", { class: "stat-separator", children: "\xB7" }),
    /* @__PURE__ */ u3("span", { class: "stat-item", children: item.label ? /* @__PURE__ */ u3(k, { children: [
      /* @__PURE__ */ u3("strong", { children: item.value.toLocaleString() }),
      " ",
      item.label
    ] }) : item.value })
  ] })) });
}

// dev/ui/src/components/PostFilterBar.jsx
function PostFilterBar({ availableTags, activeTags, onTagToggle, sort, onSortToggle, search, onSearchInput, searchRef }) {
  const [open, setOpen] = d2(false);
  const [tagSearch, setTagSearch] = d2("");
  const panelRef = A2(null);
  const tagBtnRef = A2(null);
  y2(() => {
    if (!open) return;
    function onDown(e3) {
      if (panelRef.current && !panelRef.current.contains(e3.target) && tagBtnRef.current && !tagBtnRef.current.contains(e3.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);
  const visibleTags = tagSearch ? availableTags.filter((t3) => t3.toLowerCase().includes(tagSearch.toLowerCase())) : availableTags;
  return /* @__PURE__ */ u3("div", { class: "filter-bar post-filter-bar", children: /* @__PURE__ */ u3("div", { class: "filter-controls", children: [
    /* @__PURE__ */ u3("button", { class: "sort-toggle", onClick: onSortToggle, children: sort === "newest" ? "\u2193 Newest" : "\u2191 Oldest" }),
    /* @__PURE__ */ u3("div", { class: "tag-picker-wrap", children: [
      /* @__PURE__ */ u3(
        "button",
        {
          ref: tagBtnRef,
          class: `sort-toggle tag-picker-btn${activeTags.length > 0 ? " has-active" : ""}${open ? " open" : ""}`,
          onClick: () => setOpen((o3) => !o3),
          children: [
            "Tags",
            activeTags.length > 0 ? ` (${activeTags.length})` : "",
            " ",
            open ? "\u25B4" : "\u25BE"
          ]
        }
      ),
      open && /* @__PURE__ */ u3("div", { ref: panelRef, class: "tag-picker-panel", children: [
        /* @__PURE__ */ u3(
          "input",
          {
            class: "tag-picker-search",
            type: "search",
            placeholder: "Filter tags\u2026",
            value: tagSearch,
            onInput: (e3) => setTagSearch(e3.target.value),
            autoFocus: true
          }
        ),
        /* @__PURE__ */ u3("div", { class: "tag-picker-list", children: [
          visibleTags.length === 0 && /* @__PURE__ */ u3("span", { class: "tag-picker-empty", children: "No matching tags" }),
          visibleTags.map((tag) => /* @__PURE__ */ u3(
            "button",
            {
              class: `tag-chip${activeTags.includes(tag) ? " active" : ""}`,
              onClick: () => onTagToggle(tag),
              children: tag
            },
            tag
          ))
        ] })
      ] })
    ] }),
    activeTags.map((tag) => /* @__PURE__ */ u3(
      "button",
      {
        class: "tag-chip active tag-chip-active-inline",
        onClick: () => onTagToggle(tag),
        title: `Remove: ${tag}`,
        children: [
          tag,
          " ",
          "\xD7"
        ]
      },
      tag
    )),
    /* @__PURE__ */ u3(
      "input",
      {
        ref: searchRef,
        type: "search",
        class: "search-input",
        placeholder: "Search titles & tags\u2026",
        value: search,
        onInput: (e3) => onSearchInput(e3.target.value)
      }
    )
  ] }) });
}

// dev/ui/src/components/PostCard.jsx
function PostCard({ item, onClick, search }) {
  const first = item.media[0];
  if (!first) return null;
  const isVideo = first.type === "video";
  const totalMedia = item.imageCount + item.videoCount;
  const stats = item.stats || {};
  const reactions = (stats.likeCount || 0) + (stats.heartCount || 0);
  const dateStr = formatDate(item.publishedAt);
  return /* @__PURE__ */ u3("div", { class: "gallery-item post-card", onClick, title: dateStr, children: [
    /* @__PURE__ */ u3("div", { class: "post-card-media", children: [
      isVideo ? /* @__PURE__ */ u3("video", { src: first.thumbnailPath, preload: "metadata", muted: true, playsInline: true }) : /* @__PURE__ */ u3("img", { src: first.thumbnailPath, loading: "lazy", alt: "" }),
      isVideo && /* @__PURE__ */ u3("div", { class: "video-badge" }),
      totalMedia > 1 && /* @__PURE__ */ u3("span", { class: "media-badge", children: totalMedia }),
      item.videoCount > 0 && totalMedia > 1 && /* @__PURE__ */ u3("span", { class: "media-badge video-count-badge", children: [
        item.videoCount,
        " vid"
      ] })
    ] }),
    /* @__PURE__ */ u3("div", { class: "post-card-info", children: [
      item.title && /* @__PURE__ */ u3("div", { class: "post-card-title", children: /* @__PURE__ */ u3(HighlightText, { text: item.title, search }) }),
      item.tags.length > 0 && /* @__PURE__ */ u3("div", { class: "post-card-tags", children: [
        item.tags.slice(0, 4).map((tag) => /* @__PURE__ */ u3("span", { class: "post-card-tag", children: tag.name }, tag.id || tag.name)),
        item.tags.length > 4 && /* @__PURE__ */ u3("span", { class: "post-card-tag post-card-tag-more", children: [
          "+",
          item.tags.length - 4
        ] })
      ] }),
      reactions > 0 && /* @__PURE__ */ u3("div", { class: "post-card-reactions", children: [
        stats.heartCount > 0 && /* @__PURE__ */ u3("span", { class: "reaction", children: [
          "\u2764\uFE0F",
          " ",
          stats.heartCount
        ] }),
        stats.likeCount > 0 && /* @__PURE__ */ u3("span", { class: "reaction", children: [
          "\u{1F44D}",
          " ",
          stats.likeCount
        ] })
      ] })
    ] })
  ] });
}

// dev/ui/src/components/PostGallery.jsx
function PostGallery({ items, onItemClick, sentinelRef, loading, search }) {
  if (!items.length && !loading) {
    return /* @__PURE__ */ u3("div", { class: "empty-state", children: [
      /* @__PURE__ */ u3("h2", { children: "No posts found" }),
      /* @__PURE__ */ u3("p", { children: "Try adjusting your filters or search query." })
    ] });
  }
  return /* @__PURE__ */ u3(k, { children: [
    /* @__PURE__ */ u3("div", { class: "gallery-grid", children: items.map((item, i3) => /* @__PURE__ */ u3(PostCard, { item, onClick: () => onItemClick(i3), search }, item.id)) }),
    /* @__PURE__ */ u3("div", { ref: sentinelRef, class: "gallery-sentinel" }),
    loading && /* @__PURE__ */ u3("div", { class: "loading-bar", children: /* @__PURE__ */ u3("div", { class: "spinner" }) })
  ] });
}

// dev/ui/src/components/PostsView.jsx
function PostsView() {
  const [items, setItems] = d2([]);
  const [stats, setStats] = d2(null);
  const [page, setPage] = d2(1);
  const [totalPages, setTotalPages] = d2(1);
  const [postTotal, setPostTotal] = d2(null);
  const [loading, setLoading] = d2(false);
  const [sort, setSort] = d2("newest");
  const [activeTags, setActiveTags] = d2([]);
  const [availableTags, setAvailableTags] = d2([]);
  const [searchInput, setSearchInput] = d2("");
  const [search, setSearch] = d2("");
  const fetchId = A2(0);
  const seenTags = A2(/* @__PURE__ */ new Map());
  y2(() => {
    getStats().then(setStats).catch(() => {
    });
  }, []);
  y2(() => {
    const t3 = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(t3);
  }, [searchInput]);
  y2(() => {
    setItems([]);
    setPage(1);
    setTotalPages(1);
  }, [sort, activeTags, search]);
  y2(() => {
    const id = ++fetchId.current;
    setLoading(true);
    const tags = activeTags.join(",");
    getPosts({ page, sort, tags, search }).then((data) => {
      if (id !== fetchId.current) return;
      setTotalPages(data.totalPages);
      setPostTotal(data.total);
      const newItems = page === 1 ? data.items : [...items, ...data.items];
      setItems(newItems);
      for (const post of data.items) {
        if (Array.isArray(post.tags)) {
          for (const tag of post.tags) {
            const name = tag.name || tag;
            if (!seenTags.current.has(name)) {
              seenTags.current.set(name, true);
            }
          }
        }
      }
      setAvailableTags([...seenTags.current.keys()].sort());
    }).catch(() => {
    }).finally(() => {
      if (id === fetchId.current) setLoading(false);
    });
  }, [page, sort, activeTags, search]);
  const loadMore = q2(() => {
    if (!loading && page < totalPages) setPage((p3) => p3 + 1);
  }, [loading, page, totalPages]);
  const sentinelRef = useInfiniteScroll(loadMore);
  function toggleTag(tag) {
    setActiveTags(
      (prev) => prev.includes(tag) ? prev.filter((t3) => t3 !== tag) : [...prev, tag]
    );
  }
  function handleSortToggle() {
    setSort((s3) => s3 === "newest" ? "oldest" : "newest");
  }
  const searchRef = A2(null);
  function openPost(idx) {
    const post = items[idx];
    if (post) navigate(`posts/${post.id}`);
  }
  y2(() => {
    function onKey(e3) {
      const tag = e3.target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e3.key === "j") window.scrollBy({ top: 300, behavior: "smooth" });
      else if (e3.key === "k") window.scrollBy({ top: -300, behavior: "smooth" });
      else if (e3.key === "/") {
        e3.preventDefault();
        searchRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
  return /* @__PURE__ */ u3("div", { class: "main-content", children: [
    /* @__PURE__ */ u3(PostStatsBar, { stats, postTotal }),
    /* @__PURE__ */ u3(
      PostFilterBar,
      {
        availableTags,
        activeTags,
        onTagToggle: toggleTag,
        sort,
        onSortToggle: handleSortToggle,
        search: searchInput,
        onSearchInput: setSearchInput,
        searchRef
      }
    ),
    /* @__PURE__ */ u3(
      PostGallery,
      {
        items,
        onItemClick: openPost,
        sentinelRef,
        loading,
        search
      }
    )
  ] });
}

// dev/ui/src/components/PostMediaLightbox.jsx
var META_PARAM_KEYS = [
  ["Model", "Model"],
  ["sampler", "Sampler"],
  ["steps", "Steps"],
  ["cfgScale", "CFG Scale"],
  ["seed", "Seed"],
  ["Size", "Size"],
  ["Clip skip", "Clip Skip"],
  ["Denoising strength", "Denoising"]
];
function PostMediaLightbox({ media, startIdx, onClose }) {
  const [idx, setIdx] = d2(startIdx);
  const [copied, setCopied] = d2(null);
  y2(() => {
    setIdx(startIdx);
  }, [startIdx]);
  const handleKey = q2((e3) => {
    if (e3.key === "Escape") return onClose();
    if (e3.key === "ArrowLeft") setIdx((i3) => Math.max(0, i3 - 1));
    if (e3.key === "ArrowRight") setIdx((i3) => Math.min(media.length - 1, i3 + 1));
  }, [media.length, onClose]);
  y2(() => {
    document.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [handleKey]);
  async function doCopy(text, label) {
    await copyToClipboard(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 1500);
  }
  const cur = media[idx];
  if (!cur) return null;
  const isVideo = cur.type === "video";
  const meta = cur.meta || null;
  const seed = meta?.seed != null ? String(meta.seed) : null;
  const params = meta ? META_PARAM_KEYS.filter(([key]) => meta[key] != null && meta[key] !== "").map(([key, label]) => ({ label, value: String(meta[key]) })) : [];
  return /* @__PURE__ */ u3("div", { class: "lightbox-overlay", onClick: (e3) => {
    if (e3.target === e3.currentTarget) onClose();
  }, children: [
    /* @__PURE__ */ u3("button", { class: "lightbox-close", onClick: onClose, "aria-label": "Close", children: "\u2715" }),
    /* @__PURE__ */ u3("div", { class: "lightbox-container", children: [
      /* @__PURE__ */ u3("div", { class: "lightbox-image-area", children: [
        media.length > 1 && idx > 0 && /* @__PURE__ */ u3("button", { class: "lightbox-nav-arrow prev", onClick: () => setIdx((i3) => i3 - 1), children: "\u2039" }),
        isVideo ? /* @__PURE__ */ u3("video", { src: cur.thumbnailPath, controls: true, autoPlay: true, loop: true }, cur.imageId) : /* @__PURE__ */ u3("img", { src: cur.thumbnailPath, alt: "" }, cur.imageId),
        media.length > 1 && idx < media.length - 1 && /* @__PURE__ */ u3("button", { class: "lightbox-nav-arrow next", onClick: () => setIdx((i3) => i3 + 1), children: "\u203A" }),
        media.length > 1 && /* @__PURE__ */ u3("div", { class: "lightbox-image-nav", children: /* @__PURE__ */ u3("span", { children: [
          idx + 1,
          " / ",
          media.length
        ] }) })
      ] }),
      /* @__PURE__ */ u3("div", { class: "lightbox-meta", children: [
        cur.width > 0 && cur.height > 0 && /* @__PURE__ */ u3("div", { class: "meta-section", children: /* @__PURE__ */ u3("div", { class: "meta-params", children: [
          /* @__PURE__ */ u3("span", { class: "param-chip", children: [
            cur.width,
            "\xD7",
            cur.height
          ] }),
          cur.duration > 0 && /* @__PURE__ */ u3("span", { class: "param-chip", children: [
            cur.duration.toFixed(1),
            "s"
          ] })
        ] }) }),
        meta?.prompt && /* @__PURE__ */ u3("div", { class: "meta-section", children: [
          /* @__PURE__ */ u3("div", { class: "meta-label", children: "Prompt" }),
          /* @__PURE__ */ u3("div", { class: "meta-prompt", children: meta.prompt }),
          /* @__PURE__ */ u3("div", { class: "meta-actions", children: /* @__PURE__ */ u3(
            "button",
            {
              class: `meta-action${copied === "prompt" ? " copied" : ""}`,
              onClick: () => doCopy(meta.prompt, "prompt"),
              children: copied === "prompt" ? "Copied" : "Copy prompt"
            }
          ) })
        ] }),
        meta?.negativePrompt && /* @__PURE__ */ u3("div", { class: "meta-section", children: [
          /* @__PURE__ */ u3("div", { class: "meta-label", children: "Negative Prompt" }),
          /* @__PURE__ */ u3("div", { class: "meta-prompt meta-neg-prompt", children: meta.negativePrompt })
        ] }),
        params.length > 0 && /* @__PURE__ */ u3("div", { class: "meta-section", children: [
          /* @__PURE__ */ u3("div", { class: "meta-label", children: "Parameters" }),
          /* @__PURE__ */ u3("div", { class: "meta-params", children: params.map((p3) => /* @__PURE__ */ u3("span", { class: "param-chip", title: p3.label, children: [
            p3.label,
            ": ",
            p3.value
          ] }, p3.label)) })
        ] }),
        /* @__PURE__ */ u3("div", { class: "meta-section", children: /* @__PURE__ */ u3("div", { class: "meta-actions", children: /* @__PURE__ */ u3("button", { class: "meta-action", onClick: () => openFolder(cur.thumbnailPath), children: "Open folder" }) }) })
      ] })
    ] })
  ] });
}

// dev/ui/src/components/PostDetailView.jsx
var REACTION_ICONS = {
  heartCount: "\u2764\uFE0F",
  likeCount: "\u{1F44D}",
  laughCount: "\u{1F602}",
  cryCount: "\u{1F622}",
  dislikeCount: "\u{1F44E}",
  collectedCount: "\u{1F4DA}",
  commentCount: "\u{1F4AC}"
};
var META_PARAM_KEYS2 = [
  ["Model", "Model"],
  ["sampler", "Sampler"],
  ["steps", "Steps"],
  ["cfgScale", "CFG Scale"],
  ["seed", "Seed"],
  ["Size", "Size"],
  ["Clip skip", "Clip Skip"],
  ["Hires upscale", "Hires Upscale"],
  ["Hires upscaler", "Hires Upscaler"],
  ["Denoising strength", "Denoising"]
];
function PostDetailView({ postId }) {
  const [data, setData] = d2(null);
  const [loading, setLoading] = d2(true);
  const [lightboxIdx, setLightboxIdx] = d2(null);
  const [copied, setCopied] = d2(null);
  y2(() => {
    let cancelled = false;
    setLoading(true);
    setData(null);
    getPost(postId).then((d3) => {
      if (!cancelled) setData(d3);
    }).catch(() => {
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [postId]);
  async function doCopy(text, label) {
    await copyToClipboard(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 1500);
  }
  if (loading) {
    return /* @__PURE__ */ u3("div", { class: "main-content", children: /* @__PURE__ */ u3("div", { class: "loading-bar", children: /* @__PURE__ */ u3("div", { class: "spinner" }) }) });
  }
  if (!data || !data.index) {
    return /* @__PURE__ */ u3("div", { class: "main-content", children: /* @__PURE__ */ u3("div", { class: "empty-state", children: [
      /* @__PURE__ */ u3("h2", { children: "Post not found" }),
      /* @__PURE__ */ u3("p", { children: "This post may not have been downloaded yet." }),
      /* @__PURE__ */ u3("button", { class: "meta-action", onClick: () => navigate("posts"), children: "Back to Posts" })
    ] }) });
  }
  const post = data.index;
  const raw = data.raw;
  const rawImages = raw?.images || [];
  const stats = post.stats || {};
  const reactions = Object.entries(REACTION_ICONS).filter(([key]) => stats[key] > 0).map(([key, icon]) => ({ key, icon, count: stats[key] }));
  return /* @__PURE__ */ u3("div", { class: "main-content", children: [
    /* @__PURE__ */ u3("div", { class: "post-detail", children: [
      /* @__PURE__ */ u3("button", { class: "post-detail-back", onClick: () => navigate("posts"), children: [
        "\u2190",
        " Posts"
      ] }),
      /* @__PURE__ */ u3("div", { class: "post-detail-header", children: [
        /* @__PURE__ */ u3("h1", { class: "post-detail-title", children: post.title || `Post #${post.id}` }),
        /* @__PURE__ */ u3("div", { class: "post-detail-date", children: [
          /* @__PURE__ */ u3("span", { children: formatDate(post.publishedAt) }),
          /* @__PURE__ */ u3("span", { class: "text-muted", children: [
            "\xB7",
            " ",
            relativeTime(post.publishedAt)
          ] })
        ] })
      ] }),
      reactions.length > 0 && /* @__PURE__ */ u3("div", { class: "post-detail-reactions", children: reactions.map((r3) => /* @__PURE__ */ u3("span", { class: "post-reaction-chip", children: [
        r3.icon,
        " ",
        r3.count
      ] }, r3.key)) }),
      post.detail && /* @__PURE__ */ u3("div", { class: "post-detail-description", dangerouslySetInnerHTML: { __html: post.detail } }),
      post.tags.length > 0 && /* @__PURE__ */ u3("div", { class: "post-detail-tags", children: post.tags.map((tag) => /* @__PURE__ */ u3("span", { class: "meta-tag", children: tag.name }, tag.id || tag.name)) }),
      /* @__PURE__ */ u3("div", { class: "post-detail-media-grid", children: post.media.map((m3, i3) => {
        const isVideo = m3.type === "video";
        const rawImg = rawImages.find((img) => img.id === m3.imageId) || null;
        const meta = m3.meta || rawImg?.meta || null;
        return /* @__PURE__ */ u3("div", { class: "post-media-card", children: [
          /* @__PURE__ */ u3("div", { class: "post-media-card-visual", onClick: () => setLightboxIdx(i3), children: [
            isVideo ? /* @__PURE__ */ u3("video", { src: m3.thumbnailPath, preload: "metadata", muted: true, playsInline: true }) : /* @__PURE__ */ u3("img", { src: m3.thumbnailPath, loading: "lazy", alt: "" }),
            isVideo && /* @__PURE__ */ u3("div", { class: "video-badge" }),
            /* @__PURE__ */ u3("div", { class: "post-media-card-zoom", children: "\u26F6" })
          ] }),
          /* @__PURE__ */ u3(
            MediaCardMeta,
            {
              media: m3,
              rawImage: rawImg,
              meta,
              doCopy,
              copied
            }
          )
        ] }, m3.imageId);
      }) }),
      /* @__PURE__ */ u3("div", { class: "post-detail-actions", children: [
        /* @__PURE__ */ u3("a", { class: "meta-action", href: post.url, target: "_blank", rel: "noopener noreferrer", children: "Open on Civitai" }),
        post.media[0] && /* @__PURE__ */ u3("button", { class: "meta-action", onClick: () => openFolder(post.media[0].thumbnailPath), children: "Open folder" })
      ] })
    ] }),
    lightboxIdx != null && /* @__PURE__ */ u3(
      PostMediaLightbox,
      {
        media: post.media,
        startIdx: lightboxIdx,
        onClose: () => setLightboxIdx(null)
      }
    )
  ] });
}
function MediaCardMeta({ media, rawImage, meta, doCopy, copied }) {
  const dims = media.width > 0 && media.height > 0 ? `${media.width}\xD7${media.height}` : null;
  if (!meta && !dims) return null;
  const params = meta ? META_PARAM_KEYS2.filter(([key]) => meta[key] != null && meta[key] !== "").map(([key, label]) => ({ label, value: String(meta[key]) })) : [];
  const seed = meta?.seed != null ? String(meta.seed) : null;
  return /* @__PURE__ */ u3("div", { class: "post-media-card-meta", children: [
    dims && /* @__PURE__ */ u3("div", { class: "post-media-dims", children: dims }),
    rawImage?.nsfwLevel != null && rawImage.nsfwLevel > 1 && /* @__PURE__ */ u3("span", { class: "param-chip post-media-nsfw", children: [
      "NSFW ",
      rawImage.nsfwLevel
    ] }),
    meta?.prompt && /* @__PURE__ */ u3("div", { class: "post-media-prompt", children: [
      /* @__PURE__ */ u3("div", { class: "post-media-prompt-text", children: meta.prompt }),
      /* @__PURE__ */ u3("div", { class: "meta-actions", children: /* @__PURE__ */ u3(
        "button",
        {
          class: `meta-action compact${copied === `prompt-${media.imageId}` ? " copied" : ""}`,
          onClick: () => doCopy(meta.prompt, `prompt-${media.imageId}`),
          children: copied === `prompt-${media.imageId}` ? "Copied" : "Copy prompt"
        }
      ) })
    ] }),
    params.length > 0 && /* @__PURE__ */ u3("div", { class: "meta-params", children: params.map((p3) => /* @__PURE__ */ u3("span", { class: "param-chip", title: p3.label, children: [
      p3.label,
      ": ",
      p3.value
    ] }, p3.label)) })
  ] });
}

// dev/ui/src/components/TimelineView.jsx
function monthLabel(key) {
  const [y3, m3] = key.split("-");
  const d3 = new Date(Number(y3), Number(m3) - 1);
  return d3.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}
function TimelineView() {
  const [months, setMonths] = d2([]);
  const [currentIdx, setCurrentIdx] = d2(0);
  const [items, setItems] = d2([]);
  const [loadingMonths, setLoadingMonths] = d2(true);
  const [loadingItems, setLoadingItems] = d2(false);
  const [selected, setSelected] = d2(null);
  const [cache] = d2(() => /* @__PURE__ */ new Map());
  y2(() => {
    let cancelled = false;
    setLoadingMonths(true);
    getTimelineMonths().then((data) => {
      if (cancelled) return;
      setMonths(data.months || []);
      setCurrentIdx(0);
      setLoadingMonths(false);
    }).catch(() => {
      if (!cancelled) setLoadingMonths(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  const current = months[currentIdx] || null;
  const monthKey = current?.month;
  y2(() => {
    if (!monthKey) return;
    if (cache.has(monthKey)) {
      setItems(cache.get(monthKey));
      return;
    }
    let cancelled = false;
    setLoadingItems(true);
    getTimelineMonth(monthKey).then((data) => {
      if (cancelled) return;
      const fetched = data.items || [];
      cache.set(monthKey, fetched);
      setItems(fetched);
      setLoadingItems(false);
    }).catch(() => {
      if (!cancelled) setLoadingItems(false);
    });
    return () => {
      cancelled = true;
    };
  }, [monthKey]);
  function goTo(idx) {
    if (idx >= 0 && idx < months.length) {
      setCurrentIdx(idx);
      setSelected(null);
    }
  }
  function openItem(item) {
    if (item._source === "post") {
      navigate(`posts/${item.id}`);
    } else {
      setSelected(item);
    }
  }
  const selectedIdx = selected ? items.indexOf(selected) : -1;
  function navPrev() {
    if (selectedIdx > 0) setSelected(items[selectedIdx - 1]);
  }
  function navNext() {
    if (selectedIdx < items.length - 1) setSelected(items[selectedIdx + 1]);
  }
  if (loadingMonths) {
    return /* @__PURE__ */ u3("div", { class: "main-content", children: /* @__PURE__ */ u3("div", { class: "loading-bar", children: /* @__PURE__ */ u3("div", { class: "spinner" }) }) });
  }
  if (!months.length) {
    return /* @__PURE__ */ u3("div", { class: "main-content", children: /* @__PURE__ */ u3("div", { class: "empty-state", children: [
      /* @__PURE__ */ u3("h2", { children: "No content yet" }),
      /* @__PURE__ */ u3("p", { children: "Download generations or posts to see your timeline." })
    ] }) });
  }
  return /* @__PURE__ */ u3("div", { class: "main-content", children: [
    /* @__PURE__ */ u3("div", { class: "month-picker", children: [
      /* @__PURE__ */ u3(
        "button",
        {
          class: "month-picker-arrow",
          disabled: currentIdx >= months.length - 1,
          onClick: () => goTo(currentIdx + 1),
          "aria-label": "Previous month",
          children: "\u2039"
        }
      ),
      /* @__PURE__ */ u3("div", { class: "month-picker-center", children: [
        /* @__PURE__ */ u3(
          "select",
          {
            class: "month-picker-select",
            value: currentIdx,
            onChange: (e3) => goTo(Number(e3.target.value)),
            children: months.map((m3, i3) => /* @__PURE__ */ u3("option", { value: i3, children: monthLabel(m3.month) }, m3.month))
          }
        ),
        /* @__PURE__ */ u3("div", { class: "month-picker-counts", children: [
          current.genCount > 0 && /* @__PURE__ */ u3("span", { children: [
            current.genCount,
            " generation",
            current.genCount !== 1 ? "s" : ""
          ] }),
          current.genCount > 0 && current.postCount > 0 && /* @__PURE__ */ u3("span", { class: "stat-separator", children: "\xB7" }),
          current.postCount > 0 && /* @__PURE__ */ u3("span", { children: [
            current.postCount,
            " post",
            current.postCount !== 1 ? "s" : ""
          ] })
        ] })
      ] }),
      /* @__PURE__ */ u3(
        "button",
        {
          class: "month-picker-arrow",
          disabled: currentIdx <= 0,
          onClick: () => goTo(currentIdx - 1),
          "aria-label": "Next month",
          children: "\u203A"
        }
      )
    ] }),
    loadingItems ? /* @__PURE__ */ u3("div", { class: "loading-bar", children: /* @__PURE__ */ u3("div", { class: "spinner" }) }) : /* @__PURE__ */ u3("div", { class: "timeline-grid", children: items.map((item) => {
      const thumb = item.media?.[0];
      if (!thumb) return null;
      const isVideo = thumb.type === "video";
      return /* @__PURE__ */ u3("div", { class: "timeline-thumb", onClick: () => openItem(item), children: [
        isVideo ? /* @__PURE__ */ u3("video", { src: thumb.thumbnailPath, preload: "metadata", muted: true, playsInline: true }) : /* @__PURE__ */ u3("img", { src: thumb.thumbnailPath, loading: "lazy", alt: "" }),
        item._source === "post" && /* @__PURE__ */ u3("span", { class: "timeline-badge post", children: "P" })
      ] }, `${item._source}-${item.id}`);
    }) }),
    selected && selected._source === "generation" && /* @__PURE__ */ u3(
      Lightbox,
      {
        item: selected,
        onClose: () => setSelected(null),
        onPrev: selectedIdx > 0 ? navPrev : null,
        onNext: selectedIdx < items.length - 1 ? navNext : null
      }
    )
  ] });
}

// dev/ui/src/components/SettingsView.jsx
var MEDIA_TYPES = [
  { value: "all", label: "All" },
  { value: "favorite", label: "Favorites" },
  { value: "feedback:liked", label: "Liked" },
  { value: "feedback:disliked", label: "Disliked" }
];
var TAG_LABELS2 = {
  all: "All",
  favorite: "Favorited",
  "feedback:liked": "Liked",
  "feedback:disliked": "Disliked"
};
function tagModeLabel(mediaTypes) {
  if (!mediaTypes || !mediaTypes.length) return "By tag";
  const tags = mediaTypes.filter((t3) => t3 !== "all");
  if (!tags.length) return "By tag";
  return tags.map((t3) => TAG_LABELS2[t3] || t3).join("/");
}
var GEN_MODES_BASE = [
  { value: "latest", label: "Latest", desc: "Most recent generations not yet saved" },
  { value: "oldest", label: "Oldest", desc: "Resume from oldest saved generation" },
  { value: "missing-tags", label: null, desc: "Tag-filtered generations (last 30 days)" },
  { value: "missing-all", label: "All", desc: "All generations in last 30 days" }
];
var POST_MODES = [
  { value: "latest", label: "Latest", desc: "Most recent posts not yet saved" },
  { value: "all", label: "All", desc: "Download all posts" }
];
function formatElapsed(ms) {
  if (!ms || ms < 0) return "0:00";
  const total = Math.floor(ms / 1e3);
  const h3 = Math.floor(total / 3600);
  const m3 = Math.floor(total % 3600 / 60);
  const s3 = total % 60;
  if (h3 > 0) return `${h3}:${String(m3).padStart(2, "0")}:${String(s3).padStart(2, "0")}`;
  return `${m3}:${String(s3).padStart(2, "0")}`;
}
function plural(n2, word) {
  return `${n2} ${word}${n2 === 1 ? "" : "s"}`;
}
function formatDaysAgo(isoDate) {
  if (!isoDate) return null;
  const days = Math.floor((Date.now() - new Date(isoDate).getTime()) / (1e3 * 60 * 60 * 24));
  if (days === 0) return { text: "today", days };
  if (days === 1) return { text: "yesterday", days };
  return { text: `${days} days ago`, days };
}
function SettingsView() {
  const [config, setConfig] = d2(null);
  const [genMode, setGenMode] = d2("latest");
  const [postMode, setPostMode] = d2("latest");
  const [downloadActive, setDownloadActive] = d2(false);
  const [downloadType, setDownloadType] = d2(null);
  const [downloadStartedAt, setDownloadStartedAt] = d2(null);
  const [progress, setProgress] = d2(null);
  const [lastResult, setLastResult] = d2(null);
  const [error, setError] = d2(null);
  const [rebuilding, setRebuilding] = d2(false);
  const [online, setOnline] = d2(navigator.onLine);
  const [unlockPassword, setUnlockPassword] = d2("");
  const [unlockError, setUnlockError] = d2(null);
  const [unlocking, setUnlocking] = d2(false);
  const disconnectSSE = A2(null);
  y2(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);
  y2(() => {
    getConfig().then(setConfig).catch(() => {
    });
    getDownloadStatus().then((status) => {
      if (status.active) {
        setDownloadActive(true);
        setDownloadType(status.type);
      }
    }).catch(() => {
    });
  }, []);
  y2(() => {
    const disconnect = connectProgress((event) => {
      if (event.type === "connected") {
        if (event.active) {
          setDownloadActive(true);
          setDownloadType(event.downloadType);
          if (!downloadStartedAt) setDownloadStartedAt(Date.now());
        }
        return;
      }
      if (event.final) {
        setDownloadActive(false);
        setDownloadStartedAt(null);
        setLastResult({ ...event });
        setProgress(null);
        getConfig().then(setConfig).catch(() => {
        });
        return;
      }
      if (event.status === "downloading") {
        setProgress(event);
        setDownloadActive(true);
        setDownloadType(event.type);
      }
    });
    disconnectSSE.current = disconnect;
    return disconnect;
  }, []);
  const handleStartGen = q2(async () => {
    setError(null);
    setLastResult(null);
    const result = await startDownload("generations", genMode);
    if (result.error) {
      setError(result.error);
    } else {
      setDownloadActive(true);
      setDownloadType("generations");
      setDownloadStartedAt(Date.now());
      setProgress({});
    }
  }, [genMode]);
  const handleStartPosts = q2(async () => {
    setError(null);
    setLastResult(null);
    const result = await startDownload("posts", postMode);
    if (result.error) {
      setError(result.error);
    } else {
      setDownloadActive(true);
      setDownloadType("posts");
      setDownloadStartedAt(Date.now());
      setProgress({});
    }
  }, [postMode]);
  const handleAbort = q2(async () => {
    await abortDownload();
  }, []);
  const handleRebuild = q2(async () => {
    setRebuilding(true);
    await rebuildIndex().catch(() => {
    });
    setRebuilding(false);
  }, []);
  const handleUnlock = q2(async () => {
    if (!unlockPassword) return;
    setUnlocking(true);
    setUnlockError(null);
    try {
      const result = await unlockKey(unlockPassword);
      if (result.ok) {
        setUnlockPassword("");
        getConfig().then(setConfig).catch(() => {
        });
      } else {
        setUnlockError(result.error || "Wrong password");
      }
    } catch {
      setUnlockError("Could not connect to server");
    }
    setUnlocking(false);
  }, [unlockPassword]);
  async function handleMediaTypeToggle(type) {
    if (!config) return;
    let types = [...config.generationMediaTypes || []];
    if (types.includes(type)) {
      types = types.filter((t3) => t3 !== type);
    } else {
      types.push(type);
    }
    if (!types.length) types = ["all"];
    types.sort();
    const result = await updateConfig({ generationMediaTypes: types });
    if (result.ok) {
      setConfig((prev) => ({ ...prev, generationMediaTypes: types }));
    }
  }
  async function handleExcludeImagesToggle() {
    if (!config) return;
    const newValue = !config.excludeImages;
    const result = await updateConfig({ excludeImages: newValue });
    if (result.ok) {
      setConfig((prev) => ({ ...prev, excludeImages: newValue }));
    }
  }
  if (!config) {
    return /* @__PURE__ */ u3("div", { class: "settings-loading", children: /* @__PURE__ */ u3("div", { class: "spinner" }) });
  }
  const needsUnlock = config.keyEncrypted && !config.keyUnlocked;
  const canDownload = config.hasKey && !needsUnlock;
  return /* @__PURE__ */ u3("div", { class: "main-content settings-view", children: [
    needsUnlock && /* @__PURE__ */ u3("section", { class: "settings-section unlock-section", children: [
      /* @__PURE__ */ u3("h2", { class: "settings-heading", children: "Unlock API Key" }),
      /* @__PURE__ */ u3("p", { class: "unlock-desc", children: "Your API key is encrypted. Enter your password to unlock it for this session." }),
      /* @__PURE__ */ u3("div", { class: "settings-row", children: [
        /* @__PURE__ */ u3(
          "input",
          {
            type: "password",
            class: "unlock-input",
            placeholder: "Password",
            value: unlockPassword,
            onInput: (e3) => setUnlockPassword(e3.target.value),
            onKeyDown: (e3) => {
              if (e3.key === "Enter") handleUnlock();
            },
            disabled: unlocking
          }
        ),
        /* @__PURE__ */ u3("button", { class: "action-btn download-btn", onClick: handleUnlock, disabled: unlocking || !unlockPassword, children: unlocking ? "Unlocking\u2026" : "Unlock" })
      ] }),
      unlockError && /* @__PURE__ */ u3("div", { class: "settings-error", children: unlockError })
    ] }),
    /* @__PURE__ */ u3("section", { class: "settings-section", children: [
      /* @__PURE__ */ u3("h2", { class: "settings-heading", children: "Download Generations" }),
      /* @__PURE__ */ u3(
        LastDownloadInfo,
        {
          isoDate: config.lastDownloadGenerations,
          warnDays: 25,
          expireDays: 30,
          online
        }
      ),
      /* @__PURE__ */ u3("div", { class: "settings-row", children: [
        /* @__PURE__ */ u3("div", { class: "mode-selector", children: GEN_MODES_BASE.map((m3) => /* @__PURE__ */ u3(
          "button",
          {
            class: `mode-btn${genMode === m3.value ? " active" : ""}`,
            onClick: () => setGenMode(m3.value),
            disabled: downloadActive,
            title: m3.desc,
            children: m3.label || tagModeLabel(config.generationMediaTypes)
          },
          m3.value
        )) }),
        downloadActive && downloadType === "generations" ? /* @__PURE__ */ u3("button", { class: "action-btn stop-btn", onClick: handleAbort, children: "Stop" }) : /* @__PURE__ */ u3("button", { class: "action-btn download-btn", onClick: handleStartGen, disabled: downloadActive || !online || !canDownload, children: "Download" })
      ] }),
      downloadActive && downloadType === "generations" && /* @__PURE__ */ u3(ProgressBar, { progress: progress || {}, type: "generations", startedAt: downloadStartedAt })
    ] }),
    /* @__PURE__ */ u3("section", { class: "settings-section", children: [
      /* @__PURE__ */ u3("h2", { class: "settings-heading", children: "Download Posts" }),
      /* @__PURE__ */ u3(
        LastDownloadInfo,
        {
          isoDate: config.lastDownloadPosts,
          online
        }
      ),
      /* @__PURE__ */ u3("div", { class: "settings-row", children: [
        /* @__PURE__ */ u3("div", { class: "mode-selector", children: POST_MODES.map((m3) => /* @__PURE__ */ u3(
          "button",
          {
            class: `mode-btn${postMode === m3.value ? " active" : ""}`,
            onClick: () => setPostMode(m3.value),
            disabled: downloadActive,
            title: m3.desc,
            children: m3.label
          },
          m3.value
        )) }),
        downloadActive && downloadType === "posts" ? /* @__PURE__ */ u3("button", { class: "action-btn stop-btn", onClick: handleAbort, children: "Stop" }) : /* @__PURE__ */ u3("button", { class: "action-btn download-btn", onClick: handleStartPosts, disabled: downloadActive || !online || !canDownload, children: "Download" })
      ] }),
      downloadActive && downloadType === "posts" && /* @__PURE__ */ u3(ProgressBar, { progress: progress || {}, type: "posts", startedAt: downloadStartedAt })
    ] }),
    lastResult && /* @__PURE__ */ u3(ResultBanner, { result: lastResult }),
    error && /* @__PURE__ */ u3("div", { class: "settings-error", children: error }),
    /* @__PURE__ */ u3("section", { class: "settings-section", children: [
      /* @__PURE__ */ u3("h2", { class: "settings-heading", children: "Media Options" }),
      /* @__PURE__ */ u3("div", { class: "settings-field", children: [
        /* @__PURE__ */ u3("label", { class: "settings-label", children: "Generation media directories" }),
        /* @__PURE__ */ u3("div", { class: "checkbox-group", children: MEDIA_TYPES.map((t3) => /* @__PURE__ */ u3("label", { class: "checkbox-label", children: [
          /* @__PURE__ */ u3(
            "input",
            {
              type: "checkbox",
              checked: (config.generationMediaTypes || []).includes(t3.value),
              onChange: () => handleMediaTypeToggle(t3.value)
            }
          ),
          t3.label
        ] }, t3.value)) })
      ] }),
      /* @__PURE__ */ u3("div", { class: "settings-field", children: /* @__PURE__ */ u3("label", { class: "checkbox-label", children: [
        /* @__PURE__ */ u3(
          "input",
          {
            type: "checkbox",
            checked: config.excludeImages,
            onChange: handleExcludeImagesToggle
          }
        ),
        "Data only (skip image downloads)"
      ] }) })
    ] }),
    /* @__PURE__ */ u3("section", { class: "settings-section", children: [
      /* @__PURE__ */ u3("h2", { class: "settings-heading", children: "Paths" }),
      /* @__PURE__ */ u3("div", { class: "settings-field", children: [
        /* @__PURE__ */ u3("label", { class: "settings-label", children: "Data path" }),
        /* @__PURE__ */ u3("div", { class: "settings-value mono", children: config.dataPath })
      ] }),
      /* @__PURE__ */ u3("div", { class: "settings-field", children: [
        /* @__PURE__ */ u3("label", { class: "settings-label", children: "Media path" }),
        /* @__PURE__ */ u3("div", { class: "settings-value mono", children: config.mediaPath })
      ] })
    ] }),
    /* @__PURE__ */ u3("section", { class: "settings-section", children: [
      /* @__PURE__ */ u3("h2", { class: "settings-heading", children: "Info" }),
      /* @__PURE__ */ u3("div", { class: "settings-field", children: [
        /* @__PURE__ */ u3("label", { class: "settings-label", children: "Version" }),
        /* @__PURE__ */ u3("div", { class: "settings-value", children: config.version || "unknown" })
      ] }),
      /* @__PURE__ */ u3("div", { class: "settings-field", children: [
        /* @__PURE__ */ u3("label", { class: "settings-label", children: "API key" }),
        /* @__PURE__ */ u3("div", { class: "settings-value", children: config.hasKey ? "Configured" : "Not set" })
      ] }),
      config.username && /* @__PURE__ */ u3("div", { class: "settings-field", children: [
        /* @__PURE__ */ u3("label", { class: "settings-label", children: "Username" }),
        /* @__PURE__ */ u3("div", { class: "settings-value", children: config.username })
      ] }),
      /* @__PURE__ */ u3("div", { class: "settings-actions", children: /* @__PURE__ */ u3("button", { class: "action-btn secondary-btn", onClick: handleRebuild, disabled: rebuilding, children: rebuilding ? "Rebuilding\u2026" : "Rebuild index" }) })
    ] })
  ] });
}
function ProgressBar({ progress, type, startedAt }) {
  const isGen = type === "generations";
  const newCount = isGen ? progress.generationsNew || 0 : progress.postsNew || 0;
  const newLabel = isGen ? "new generation" : "new post";
  const images = progress.imagesSaved || 0;
  const videos = progress.videosSaved || 0;
  const [now, setNow] = d2(Date.now());
  y2(() => {
    const id = setInterval(() => setNow(Date.now()), 1e3);
    return () => clearInterval(id);
  }, []);
  const elapsed = formatElapsed(startedAt ? now - startedAt : progress.elapsed || 0);
  const parts = [];
  if (newCount > 0) parts.push(plural(newCount, newLabel));
  if (images > 0) parts.push(plural(images, "image"));
  if (videos > 0) parts.push(plural(videos, "video"));
  return /* @__PURE__ */ u3("div", { class: "progress-bar", children: [
    /* @__PURE__ */ u3("div", { class: "progress-indicator", children: [
      /* @__PURE__ */ u3("div", { class: "progress-pulse" }),
      /* @__PURE__ */ u3("span", { class: "progress-status", children: [
        "Downloading",
        "\u2026"
      ] })
    ] }),
    /* @__PURE__ */ u3("div", { class: "progress-details", children: [
      parts.length > 0 && /* @__PURE__ */ u3("span", { class: "progress-counts", children: parts.join(" \xB7 ") }),
      /* @__PURE__ */ u3("span", { class: "progress-elapsed", children: elapsed })
    ] })
  ] });
}
function LastDownloadInfo({ isoDate, warnDays, expireDays, online }) {
  const info = formatDaysAgo(isoDate);
  return /* @__PURE__ */ u3("div", { class: "last-download-info", children: [
    !online && /* @__PURE__ */ u3("span", { class: "offline-badge", children: "Offline" }),
    info ? /* @__PURE__ */ u3("span", { class: expireDays && info.days >= expireDays ? "last-download-expired" : warnDays && info.days >= warnDays ? "last-download-warning" : "last-download-ok", children: [
      "Last downloaded ",
      info.text,
      expireDays && info.days >= expireDays && " \u2014 generations may have expired!",
      warnDays && info.days >= warnDays && info.days < expireDays && " \u2014 download soon to avoid expiry"
    ] }) : /* @__PURE__ */ u3("span", { class: "last-download-never", children: "Never downloaded" })
  ] });
}
function ResultBanner({ result }) {
  const isAborted = result.status === "aborted";
  const isError = result.status === "error";
  const isGen = result.type === "generations";
  const newCount = isGen ? result.generationsNew || 0 : result.postsNew || 0;
  const newLabel = isGen ? "new generation" : "new post";
  const images = result.imagesSaved || 0;
  const videos = result.videosSaved || 0;
  const elapsed = formatElapsed(result.elapsed);
  const hasData = newCount > 0 || images > 0 || videos > 0;
  let statusClass = "success";
  let statusText = "Download complete";
  if (isAborted) {
    statusClass = "warning";
    statusText = "Download stopped";
  }
  if (isError) {
    statusClass = "error";
    statusText = "Download failed";
  }
  if (!hasData && !isAborted && !isError) statusText = "Up to date";
  const parts = [];
  if (newCount > 0) parts.push(plural(newCount, newLabel));
  if (images > 0) parts.push(plural(images, "image"));
  if (videos > 0) parts.push(plural(videos, "video"));
  const errorMsg = isError && result.message ? result.message : null;
  return /* @__PURE__ */ u3("div", { class: `result-banner ${statusClass}`, children: [
    /* @__PURE__ */ u3("span", { class: "result-status", children: statusText }),
    errorMsg && /* @__PURE__ */ u3("span", { class: "result-error-msg", children: errorMsg }),
    parts.length > 0 && /* @__PURE__ */ u3("span", { class: "result-counts", children: parts.join(" \xB7 ") }),
    /* @__PURE__ */ u3("span", { class: "result-elapsed", children: elapsed })
  ] });
}

// dev/ui/src/app.jsx
function App() {
  const [route, setRoute] = d2(getRoute);
  const [username, setUsername] = d2("");
  y2(() => {
    const update = () => setRoute(getRoute());
    window.addEventListener("popstate", update);
    return () => window.removeEventListener("popstate", update);
  }, []);
  y2(() => {
    getConfig().then((cfg) => {
      if (cfg.username) setUsername(cfg.username);
    }).catch(() => {
    });
  }, []);
  const { top, sub } = route;
  return /* @__PURE__ */ u3(k, { children: [
    /* @__PURE__ */ u3(Nav, { route: top, username }),
    top === "generations" && /* @__PURE__ */ u3(GenerationsView, {}),
    top === "posts" && !sub && /* @__PURE__ */ u3(PostsView, {}),
    top === "posts" && sub && /* @__PURE__ */ u3(PostDetailView, { postId: sub }),
    top === "timeline" && /* @__PURE__ */ u3(TimelineView, {}),
    top === "settings" && /* @__PURE__ */ u3(SettingsView, {})
  ] });
}
J(/* @__PURE__ */ u3(App, {}), document.getElementById("app"));
