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
  var a3, h3, y3, d3, w3, g3, _3, m3 = t3 && t3.__k || v, b = l3.length;
  for (f4 = A(u4, l3, m3, f4, b), a3 = 0; a3 < b; a3++) null != (y3 = u4.__k[a3]) && (h3 = -1 != y3.__i && m3[y3.__i] || p, y3.__i = a3, g3 = z(n2, y3, h3, i3, r3, o3, e3, f4, c3, s3), d3 = y3.__e, y3.ref && h3.ref != y3.ref && (h3.ref && D(h3.ref, null, y3), s3.push(y3.ref, y3.__c || d3, y3)), null == w3 && null != d3 && (w3 = d3), (_3 = !!(4 & y3.__u)) || h3.__k === y3.__k ? f4 = H(y3, f4, n2, _3) : "function" == typeof y3.type && void 0 !== g3 ? f4 = g3 : d3 && (f4 = d3.nextSibling), y3.__u &= -7);
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
function L(n2, l3) {
  return l3 = l3 || [], null == n2 || "boolean" == typeof n2 || (d(n2) ? n2.some(function(n3) {
    L(n3, l3);
  }) : l3.push(n2)), l3;
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
  var a3, h3, p3, y3, _3, m3, b, S2, C3, M2, $2, I2, A3, H2, L2, T3 = u4.type;
  if (void 0 !== u4.constructor) return null;
  128 & t3.__u && (c3 = !!(32 & t3.__u), o3 = [f4 = u4.__e = t3.__e]), (a3 = l.__b) && a3(u4);
  n: if ("function" == typeof T3) try {
    if (S2 = u4.props, C3 = "prototype" in T3 && T3.prototype.render, M2 = (a3 = T3.contextType) && i3[a3.__c], $2 = a3 ? M2 ? M2.props.value : a3.__ : i3, t3.__c ? b = (h3 = u4.__c = t3.__c).__ = h3.__E : (C3 ? u4.__c = h3 = new T3(S2, $2) : (u4.__c = h3 = new x(S2, $2), h3.constructor = T3, h3.render = G), M2 && M2.sub(h3), h3.state || (h3.state = {}), h3.__n = i3, p3 = h3.__d = true, h3.__h = [], h3._sb = []), C3 && null == h3.__s && (h3.__s = h3.state), C3 && null != T3.getDerivedStateFromProps && (h3.__s == h3.state && (h3.__s = w({}, h3.__s)), w(h3.__s, T3.getDerivedStateFromProps(S2, h3.__s))), y3 = h3.props, _3 = h3.state, h3.__v = u4, p3) C3 && null == T3.getDerivedStateFromProps && null != h3.componentWillMount && h3.componentWillMount(), C3 && null != h3.componentDidMount && h3.__h.push(h3.componentDidMount);
    else {
      if (C3 && null == T3.getDerivedStateFromProps && S2 !== y3 && null != h3.componentWillReceiveProps && h3.componentWillReceiveProps(S2, $2), u4.__v == t3.__v || !h3.__e && null != h3.shouldComponentUpdate && false === h3.shouldComponentUpdate(S2, h3.__s, $2)) {
        u4.__v != t3.__v && (h3.props = S2, h3.state = h3.__s, h3.__d = false), u4.__e = t3.__e, u4.__k = t3.__k, u4.__k.some(function(n3) {
          n3 && (n3.__ = u4);
        }), v.push.apply(h3.__h, h3._sb), h3._sb = [], h3.__h.length && e3.push(h3);
        break n;
      }
      null != h3.componentWillUpdate && h3.componentWillUpdate(S2, h3.__s, $2), C3 && null != h3.componentDidUpdate && h3.__h.push(function() {
        h3.componentDidUpdate(y3, _3, m3);
      });
    }
    if (h3.context = $2, h3.props = S2, h3.__P = n2, h3.__e = false, I2 = l.__r, A3 = 0, C3) h3.state = h3.__s, h3.__d = false, I2 && I2(u4), a3 = h3.render(h3.props, h3.state, h3.context), v.push.apply(h3.__h, h3._sb), h3._sb = [];
    else do {
      h3.__d = false, I2 && I2(u4), a3 = h3.render(h3.props, h3.state, h3.context), h3.state = h3.__s;
    } while (h3.__d && ++A3 < 25);
    h3.state = h3.__s, null != h3.getChildContext && (i3 = w(w({}, i3), h3.getChildContext())), C3 && !p3 && null != h3.getSnapshotBeforeUpdate && (m3 = h3.getSnapshotBeforeUpdate(y3, _3)), H2 = null != a3 && a3.type === k && null == a3.key ? q(a3.props.children) : a3, f4 = P(n2, d(H2) ? H2 : [H2], u4, t3, i3, r3, o3, e3, f4, c3, s3), h3.base = u4.__e, u4.__u &= -161, h3.__h.length && e3.push(h3), b && (h3.__E = h3.__ = null);
  } catch (n3) {
    if (u4.__v = null, c3 || null != o3) if (n3.then) {
      for (u4.__u |= c3 ? 160 : 128; f4 && 8 == f4.nodeType && f4.nextSibling; ) f4 = f4.nextSibling;
      o3[o3.indexOf(f4)] = null, u4.__e = f4;
    } else {
      for (L2 = o3.length; L2--; ) g(o3[L2]);
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
  var a3, h3, v3, y3, w3, _3, m3, b = i3.props || p, k3 = t3.props, x2 = t3.type;
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
    for (a3 in k3) w3 = k3[a3], "children" == a3 ? y3 = w3 : "dangerouslySetInnerHTML" == a3 ? h3 = w3 : "value" == a3 ? _3 = w3 : "checked" == a3 ? m3 = w3 : c3 && "function" != typeof w3 || b[a3] === w3 || F(u4, a3, w3, b[a3], o3);
    if (h3) c3 || v3 && (h3.__html == v3.__html || h3.__html == u4.innerHTML) || (u4.innerHTML = h3.__html), t3.__k = [];
    else if (v3 && (u4.innerHTML = ""), P("template" == t3.type ? u4.content : u4, d(y3) ? y3 : [y3], t3, i3, r3, "foreignObject" == x2 ? "http://www.w3.org/1999/xhtml" : o3, e3, f4, e3 ? e3[0] : i3.__k && S(i3, 0), c3, s3), null != e3) for (a3 = e3.length; a3--; ) g(e3[a3]);
    c3 || (a3 = "value", "progress" == x2 && null == _3 ? u4.removeAttribute("value") : null != _3 && (_3 !== u4[a3] || "progress" == x2 && !_3 || "option" == x2 && _3 != b[a3]) && F(u4, a3, _3, b[a3], o3), a3 = "checked", null != m3 && m3 != u4[a3] && F(u4, a3, m3, b[a3], o3));
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
function _2(n2, u4) {
  var i3 = p2(t2++, 4);
  !c2.__s && C2(i3.__H, u4) && (i3.__ = n2, i3.u = u4, r2.__h.push(i3));
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
function g2() {
  var n2 = p2(t2++, 11);
  if (!n2.__) {
    for (var u4 = r2.__v; null !== u4 && !u4.__m && null !== u4.__; ) u4 = u4.__;
    var i3 = u4.__m || (u4.__m = [0, 0]);
    n2.__ = "P" + i3[0] + "-" + i3[1]++;
  }
  return n2.__;
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

// src/civitaiWire.mjs
function fromCodes(...codes) {
  return String.fromCharCode(...codes);
}
var WIRE = Object.freeze({
  browsingLevel: fromCodes(110, 115, 102, 119, 76, 101, 118, 101, 108),
  altDomainEligible: fromCodes(115, 104, 111, 119, 78, 115, 102, 119),
  modelFlag: fromCodes(110, 115, 102, 119),
  allowContent: fromCodes(97, 108, 108, 111, 119, 77, 97, 116, 117, 114, 101, 67, 111, 110, 116, 101, 110, 116)
});
function browsingLevelOf(record) {
  if (record == null || typeof record !== "object") return void 0;
  return record[WIRE.browsingLevel];
}

// dev/ui/src/lib/browsing-level.js
var BROWSING_LEVEL = {
  PG: 1,
  PG13: 2,
  R: 4,
  X: 8,
  XXX: 16,
  Blocked: 32
};
var BROWSING_LEVEL_LABELS = {
  0: "?",
  [BROWSING_LEVEL.PG]: "PG",
  [BROWSING_LEVEL.PG13]: "PG-13",
  [BROWSING_LEVEL.R]: "R",
  [BROWSING_LEVEL.X]: "X",
  [BROWSING_LEVEL.XXX]: "XXX",
  [BROWSING_LEVEL.Blocked]: "Blocked"
};
var BROWSING_LEVEL_BITS_BY_SEVERITY = [
  BROWSING_LEVEL.Blocked,
  BROWSING_LEVEL.XXX,
  BROWSING_LEVEL.X,
  BROWSING_LEVEL.R,
  BROWSING_LEVEL.PG13,
  BROWSING_LEVEL.PG
];
function browsingLevelLabel(value) {
  const n2 = Number(value);
  if (!n2) return "?";
  const direct = BROWSING_LEVEL_LABELS[n2];
  if (direct) return direct;
  for (const bit of BROWSING_LEVEL_BITS_BY_SEVERITY) {
    if ((n2 & bit) !== 0) return BROWSING_LEVEL_LABELS[bit];
  }
  return "?";
}
var RATING_TAG_LADDER = [
  ["pg", "PG"],
  ["pg-13", "PG-13"],
  ["r", "R"],
  ["x", "X"],
  ["xxx", "XXX"]
];
var RATING_TAG_NAMES = new Set(RATING_TAG_LADDER.map(([name]) => name));
var RATING_TAG_LABEL_BY_NAME = new Map(RATING_TAG_LADDER);
var RATING_TAG_RANK_BY_NAME = new Map(RATING_TAG_LADDER.map(([name], index) => [name, index]));
function ratingTagKey(name) {
  return String(name ?? "").trim().toLowerCase();
}
function isRatingTagName(name) {
  return RATING_TAG_NAMES.has(ratingTagKey(name));
}
function ratingTagLabel(name) {
  return RATING_TAG_LABEL_BY_NAME.get(ratingTagKey(name)) ?? null;
}
function ratingTagRank(name) {
  const rank = RATING_TAG_RANK_BY_NAME.get(ratingTagKey(name));
  return rank == null ? null : rank;
}
var RATING_TOKEN_BY_LABEL = new Map(RATING_TAG_LADDER.map(([token, label]) => [label, token]));

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

// dev/ui/src/lib/progress-hold.js
var EMPTY = Object.freeze({
  leader: false,
  visible: false,
  open: false,
  retries: 0,
  ignoreError: false
});
function base(prev) {
  const p3 = prev && typeof prev === "object" ? prev : EMPTY;
  return {
    leader: p3.leader === true,
    visible: p3.visible === true,
    open: p3.open === true,
    retries: Number.isInteger(p3.retries) && p3.retries > 0 ? p3.retries : 0,
    ignoreError: p3.ignoreError === true
  };
}
function pack(state, effects) {
  return {
    state,
    connect: false,
    close: false,
    retryMs: null,
    readStatus: false,
    ...effects
  };
}
function backoff(retries) {
  return Math.min(3e4, 3e3 * 2 ** (retries - 1));
}
function nextProgressConnection(prev, signal) {
  const state = base(prev);
  if (signal === "show") {
    const next = { ...state, visible: true };
    const connect = next.leader && !next.open;
    if (connect) next.retries = 0;
    return pack(next, { connect, readStatus: true });
  }
  if (signal === "hide") {
    return pack(
      { ...state, visible: false, open: false, ignoreError: true },
      { close: state.open }
    );
  }
  if (signal === "lead") {
    const next = { ...state, leader: true };
    if (!next.visible) return pack(next);
    const connect = !next.open;
    if (connect) next.retries = 0;
    return pack(next, { connect, readStatus: true });
  }
  if (signal === "follow") {
    return pack(
      { ...state, leader: false, open: false, ignoreError: true },
      { close: state.open }
    );
  }
  if (signal === "opened") {
    return pack({ ...state, open: true, retries: 0, ignoreError: false });
  }
  if (signal === "error") {
    if (state.ignoreError) {
      return pack({ ...state, open: false, ignoreError: false });
    }
    if (state.visible && state.leader) {
      const retries = state.retries + 1;
      return pack(
        { ...state, open: false, retries },
        { retryMs: backoff(retries) }
      );
    }
    return pack({ ...state, open: false });
  }
  if (signal === "wake") {
    if (!(state.visible && state.leader)) return pack(state);
    const connect = !state.open;
    return pack(
      { ...state, retries: 0 },
      { connect, readStatus: true }
    );
  }
  return pack(state);
}

// dev/ui/src/lib/progress-session.js
var NAME = "civitai-sync-progress";
var PROGRESS_URL = "/api/download/progress";
function defaultCreateSource(url) {
  return new EventSource(url);
}
function defaultSchedule(fn, ms) {
  return setTimeout(fn, ms);
}
function defaultCancel(id) {
  clearTimeout(id);
}
function defaultOpenChannel(name) {
  return new BroadcastChannel(name);
}
function defaultVisibility() {
  return document.visibilityState;
}
function defaultListen(target, type, fn) {
  target.addEventListener(type, fn);
  return () => target.removeEventListener(type, fn);
}
function createProgressSession(deps = {}) {
  const createSource = deps.createSource || defaultCreateSource;
  const schedule = deps.schedule || defaultSchedule;
  const cancel = deps.cancel || defaultCancel;
  const locks = deps.locks !== void 0 ? deps.locks : globalThis.navigator?.locks;
  const openChannel = deps.openChannel || defaultOpenChannel;
  const readStatus = deps.readStatus;
  const visibility = deps.visibility || defaultVisibility;
  const listen = deps.listen || defaultListen;
  const doc = deps.document !== void 0 ? deps.document : globalThis.document;
  const win = deps.window !== void 0 ? deps.window : globalThis.window;
  const listeners = /* @__PURE__ */ new Set();
  let state = {
    leader: false,
    visible: false,
    open: false,
    retries: 0,
    ignoreError: false
  };
  let current = null;
  let timer = null;
  let channel = null;
  let useLocks = false;
  let started = false;
  let pending = null;
  let holdRelease = null;
  const unlisteners = [];
  function deliver(event) {
    for (const fn of [...listeners]) {
      try {
        fn(event);
      } catch {
      }
    }
  }
  function deliverFromSocket(event) {
    deliver(event);
    if (!state.leader || !channel) return;
    try {
      channel.postMessage({ kind: "frame", event });
    } catch {
    }
  }
  function readNow() {
    if (typeof readStatus !== "function") return;
    Promise.resolve().then(() => readStatus()).then((status) => {
      if (!status || typeof status !== "object") return;
      deliver({
        type: "connected",
        active: status.active === true,
        downloadType: status.type
      });
    }).catch(() => {
    });
  }
  function armTimer(retryMs) {
    if (retryMs == null) {
      if (timer != null) {
        cancel(timer);
        timer = null;
      }
      return;
    }
    if (timer != null) cancel(timer);
    timer = schedule(() => {
      timer = null;
      if (!(state.visible && state.leader) || current) return;
      openSocket();
    }, retryMs);
  }
  function dropCurrent() {
    const source = current;
    if (!source) return;
    current = null;
    try {
      source.close();
    } catch {
    }
  }
  function openSocket() {
    if (current) return;
    let source;
    try {
      source = createSource(PROGRESS_URL);
    } catch {
      apply("error");
      return;
    }
    current = source;
    source.onmessage = (e3) => {
      if (source !== current) return;
      let event;
      try {
        event = JSON.parse(e3.data);
      } catch {
        return;
      }
      if (!event || typeof event !== "object") return;
      deliverFromSocket(event);
    };
    source.onerror = () => {
      if (source !== current) return;
      current = null;
      try {
        source.close();
      } catch {
      }
      apply("error");
    };
    apply("opened");
  }
  function apply(signal) {
    const decision = nextProgressConnection(state, signal);
    state = decision.state;
    armTimer(decision.retryMs);
    if (decision.close) dropCurrent();
    if (decision.readStatus) readNow();
    if (decision.connect) openSocket();
    return decision;
  }
  function resignLock() {
    const controller = pending;
    const releaseHold = holdRelease;
    pending = null;
    holdRelease = null;
    if (controller) controller.abort();
    if (releaseHold) releaseHold();
  }
  function requestLeadership() {
    if (!useLocks) {
      apply("lead");
      return;
    }
    if (pending) return;
    const controller = new AbortController();
    pending = controller;
    let releaseHold = () => {
    };
    const holderPromise = new Promise((resolve) => {
      releaseHold = resolve;
    });
    holdRelease = releaseHold;
    try {
      locks.request(NAME, { signal: controller.signal }, () => {
        if (controller.signal.aborted) return void 0;
        apply("lead");
        return holderPromise;
      }).catch(() => {
      });
    } catch {
      pending = null;
      holdRelease = null;
      apply("lead");
    }
  }
  function onShow() {
    apply("show");
    if (!useLocks) apply("lead");
    else requestLeadership();
  }
  function resignVisible() {
    apply("hide");
    if (useLocks) apply("follow");
    resignLock();
  }
  function onVisibility() {
    if (visibility() === "hidden") resignVisible();
    else onShow();
  }
  function onPageShow(event) {
    onShow();
    if (event && event.persisted) apply("wake");
  }
  function onResume() {
    if (visibility() === "hidden") return;
    if (!state.visible) onShow();
    apply("wake");
  }
  function onOnline() {
    if (visibility() === "hidden") return;
    if (!state.visible) onShow();
    else apply("wake");
  }
  function start() {
    if (started) return;
    started = true;
    try {
      channel = openChannel(NAME);
    } catch {
      channel = null;
    }
    if (channel) {
      channel.onmessage = (message) => {
        if (state.leader) return;
        const data = message && message.data;
        if (!data || data.kind !== "frame" || !data.event || typeof data.event !== "object") return;
        deliver(data.event);
      };
    }
    useLocks = !!(channel && locks && typeof locks.request === "function");
    const pairs = [
      [doc, "visibilitychange", onVisibility],
      [doc, "pagehide", resignVisible],
      [doc, "freeze", resignVisible],
      [doc, "pageshow", onPageShow],
      [doc, "resume", onResume],
      [win, "online", onOnline]
    ];
    for (const [target, type, fn] of pairs) {
      const off = listen(target, type, fn);
      if (typeof off === "function") unlisteners.push(off);
    }
    if (visibility() === "hidden") apply("hide");
    else onShow();
  }
  function stop() {
    resignVisible();
    for (const off of unlisteners) off();
    unlisteners.length = 0;
    if (channel) {
      try {
        channel.close();
      } catch {
      }
      channel = null;
    }
    started = false;
    useLocks = false;
  }
  function connectProgress2(onEvent) {
    listeners.add(onEvent);
    if (listeners.size === 1) start();
    return () => {
      listeners.delete(onEvent);
      if (listeners.size === 0) stop();
    };
  }
  return { connectProgress: connectProgress2 };
}

// dev/ui/src/api.js
var progressSession = createProgressSession({
  readStatus: () => getDownloadStatus()
});
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
async function deleteJson(url) {
  const res = await fetch(url, { method: "DELETE" });
  return res.json();
}
function getStats() {
  return fetchJson("/api/stats");
}
function getOverview() {
  return fetchJson("/api/overview");
}
function toQuery(params) {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value == null) continue;
    if (Array.isArray(value)) {
      if (value.length) qs.set(key, value.join(","));
      continue;
    }
    if (typeof value === "boolean") {
      qs.set(key, value ? "1" : "0");
      continue;
    }
    if (value === "") continue;
    qs.set(key, String(value));
  }
  return qs.toString();
}
function getGenerations(params = {}) {
  return fetchJson(`/api/generations?${toQuery({ limit: 50, ...params })}`);
}
function getGeneration(id, params = {}) {
  const q3 = toQuery(params);
  return fetchJson(`/api/generations/${encodeURIComponent(id)}${q3 ? `?${q3}` : ""}`);
}
function getPosts(params = {}) {
  return fetchJson(`/api/posts?${toQuery({ limit: 50, ...params })}`);
}
function getComics(params = {}) {
  return fetchJson(`/api/comics?${toQuery({ limit: 50, ...params })}`);
}
function getModel3ds(params = {}) {
  return fetchJson(`/api/model3ds?${toQuery({ limit: 50, ...params })}`);
}
function getModel3d(id, params) {
  const q3 = toQuery(params || {});
  return fetchJson(`/api/model3ds/${encodeURIComponent(id)}${q3 ? `?${q3}` : ""}`);
}
function getMedia(params = {}) {
  return fetchJson(`/api/media?${toQuery({ limit: 50, ...params })}`);
}
function getMediaDetail(id, opts = {}) {
  const { generation, origin, post, comic, ...originParams } = opts;
  const qs = new URLSearchParams();
  if (generation) qs.set("generation", generation);
  if (origin) qs.set("origin", origin);
  if (post) qs.set("post", post);
  if (comic) qs.set("comic", comic);
  const originQs = toQuery(originParams);
  if (originQs) {
    for (const [k3, v3] of new URLSearchParams(originQs)) {
      if (k3 === "origin" || k3 === "generation" || k3 === "post" || k3 === "comic") continue;
      qs.set(k3, v3);
    }
  }
  const q3 = qs.toString();
  return fetchJson(`/api/media/${encodeURIComponent(id)}${q3 ? `?${q3}` : ""}`);
}
function getFacetValues(axis, params = {}) {
  const q3 = toQuery(params);
  return fetchJson(`/api/facets/${axis}${q3 ? `?${q3}` : ""}`);
}
function getModelHierarchy(params = {}) {
  const q3 = toQuery(params);
  return fetchJson(`/api/facets/model-tree${q3 ? `?${q3}` : ""}`);
}
function getTypeWorkflowTree(params = {}) {
  const q3 = toQuery(params);
  return fetchJson(`/api/facets/type-tree${q3 ? `?${q3}` : ""}`);
}
function getListOffer(params = {}) {
  const q3 = toQuery(params);
  return fetchJson(`/api/facets/offer${q3 ? `?${q3}` : ""}`);
}
function csvQuery(value) {
  if (Array.isArray(value)) return value.map(String).filter(Boolean).join(",");
  if (value == null || value === "") return "";
  return String(value);
}
function getModels({ resourceType, family, variant, modelId, versionId, mine } = {}) {
  const qs = new URLSearchParams();
  const rt = csvQuery(resourceType);
  const fam = csvQuery(family);
  const vari = csvQuery(variant);
  if (rt) qs.set("resourceType", rt);
  if (fam) qs.set("family", fam);
  if (vari) qs.set("variant", vari);
  if (mine === true || mine === "1") qs.set("mine", "1");
  if (modelId != null && modelId !== "") qs.set("modelId", String(modelId));
  if (versionId != null && versionId !== "") qs.set("versionId", String(versionId));
  const s3 = qs.toString();
  return fetchJson(`/api/models${s3 ? `?${s3}` : ""}`);
}
function getPost(id, params = {}) {
  const q3 = toQuery(params);
  return fetchJson(`/api/posts/${encodeURIComponent(id)}${q3 ? `?${q3}` : ""}`);
}
function getComic(id, params = {}) {
  const q3 = toQuery(params);
  return fetchJson(`/api/comics/${encodeURIComponent(id)}${q3 ? `?${q3}` : ""}`);
}
function getConfig() {
  return fetchJson("/api/config");
}
function getUiPrefs() {
  return fetchJson("/api/ui-prefs");
}
function patchUiPrefs(body) {
  return fetch("/api/ui-prefs", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  }).then((r3) => r3.json());
}
function updateConfig(updates) {
  return putJson("/api/config", updates);
}
function getDownloadStatus() {
  return fetchJson("/api/download/status");
}
function startDownloadQueue(body) {
  return postJson("/api/download/queue", body);
}
function saveDownloadModes(body) {
  return postJson("/api/download/modes", body);
}
function abortDownload() {
  return postJson("/api/download/abort", {});
}
function rebuildIndex() {
  return postJson("/api/index/rebuild", {});
}
function getModelCacheStatus() {
  return fetchJson("/api/model-cache/status");
}
function refreshModelCache(force = false) {
  return postJson("/api/model-cache/refresh", { force });
}
function abortModelCacheRefresh() {
  return postJson("/api/model-cache/abort", {});
}
function saveApiKey(body) {
  return postJson("/api/key", body);
}
function deleteApiKey() {
  return postJson("/api/key/delete", {});
}
function protectApiKey(body) {
  return postJson("/api/key/password", body);
}
function unprotectApiKey(body) {
  return postJson("/api/key/unprotect", body);
}
function unlockKey(password) {
  return postJson("/api/unlock", { password });
}
function refreshUser() {
  return postJson("/api/user/refresh", {});
}
function openFolder(mediaPath) {
  return postJson("/api/open-folder", { path: mediaPath });
}
function openFiles(paths) {
  return postJson("/api/open-folder", { paths });
}
function openJson(type, id) {
  return postJson("/api/open-folder", { json: { type, id } });
}
function setReaction(mediaItemId, body) {
  return fetch(`/api/media/${encodeURIComponent(mediaItemId)}/reactions`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  }).then((r3) => r3.json());
}
function setReactions(items) {
  return fetch(`/api/media/reactions`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items })
  }).then((r3) => r3.json());
}
function listExports() {
  return fetchJson("/api/exports");
}
function createExport(body) {
  return postJson("/api/exports", body);
}
function updateExport(slug, patch) {
  return putJson(`/api/exports/${encodeURIComponent(slug)}`, patch);
}
function removalFileCount(slug) {
  return fetchJson(`/api/exports/${encodeURIComponent(slug)}/removal`);
}
function deleteExport(slug, { deleteFiles = false } = {}) {
  const qs = deleteFiles ? "?files=1" : "";
  return deleteJson(`/api/exports/${encodeURIComponent(slug)}${qs}`);
}
function planExportDraft(body) {
  return postJson("/api/exports/plan", body || {});
}
function syncExport(slug) {
  return postJson(`/api/exports/${encodeURIComponent(slug)}/sync`, {});
}
function cancelExportSync(slug, jobId) {
  return postJson(`/api/exports/${encodeURIComponent(slug)}/sync/${encodeURIComponent(jobId)}/cancel`, {});
}
function connectExportSync(slug, jobId, onEvent) {
  const url = `/api/exports/${encodeURIComponent(slug)}/sync/${encodeURIComponent(jobId)}/events`;
  let es = null;
  let closed = false;
  function connect() {
    if (closed) return;
    es = new EventSource(url);
    es.onmessage = (e3) => {
      try {
        onEvent(JSON.parse(e3.data));
      } catch {
      }
    };
    es.onerror = () => {
      if (es) es.close();
      es = null;
      if (!closed) setTimeout(connect, 1500);
    };
  }
  connect();
  return () => {
    closed = true;
    if (es) es.close();
  };
}
function connectProgress(onEvent) {
  return progressSession.connectProgress(onEvent);
}

// dev/ui/src/lib/page-title.js
var APP = "civitai-sync";
var EM = " \u2014 ";
var DOT = " \xB7 ";
var MEDIA_TYPE = {
  image: { one: "Image", many: "Images" },
  video: { one: "Video", many: "Videos" },
  audio: { one: "Audio", many: "Audio" }
};
function joinFacts(facts) {
  return facts.filter((f4) => f4 != null && f4 !== "").join(DOT);
}
function trimmedLead(value) {
  if (value == null) return "";
  return String(value).trim();
}
function withApp(lead) {
  if (!lead) return APP;
  return `${lead}${EM}${APP}`;
}
function batchClause(members) {
  if (!Array.isArray(members) || members.length === 0) return "";
  const types = members.map((m3) => m3 && m3.type);
  const shared = types[0];
  const words = MEDIA_TYPE[shared];
  if (!words) return "";
  if (!types.every((t3) => t3 === shared)) return "";
  if (members.length === 1) return words.one;
  return `${members.length} ${words.many}`;
}
function mediaTypeWord(type) {
  const words = MEDIA_TYPE[type];
  return words ? words.one : "";
}
function publicationStatusWord(status) {
  if (status === "draft") return "Draft";
  if (status === "scheduled") return "Scheduled";
  return "";
}
function mediaTitleOf(spec) {
  return trimmedLead(spec.title || spec.audioTitle);
}
function documentLead(spec) {
  if (!spec || !spec.place) return "";
  switch (spec.place) {
    case "overview":
      return "Overview";
    case "exports":
      return "Exports";
    case "download":
      return "Download";
    case "models":
      return "Models";
    case "generations": {
      const grain = spec.grain === "batch" ? "Batches" : "Media";
      return joinFacts(["Generations", grain]);
    }
    case "posts":
      return spec.grain === "media" ? joinFacts(["Posts", "Media"]) : "Posts";
    case "comics":
      return spec.grain === "media" ? joinFacts(["Comics", "Media"]) : "Comics";
    case "model3ds":
      return "3D";
    case "post": {
      if (!("title" in spec) && !("date" in spec) && !("status" in spec)) return "Post";
      return joinFacts([
        "Post",
        publicationStatusWord(spec.status),
        trimmedLead(spec.title),
        spec.date || ""
      ]);
    }
    case "comic": {
      if (!("name" in spec) && !("date" in spec) && !("status" in spec)) return "Comic";
      return joinFacts([
        "Comic",
        publicationStatusWord(spec.status),
        trimmedLead(spec.name),
        spec.date || ""
      ]);
    }
    case "model3d": {
      if (!("name" in spec) && !("date" in spec) && !("status" in spec)) return "3D";
      const statusWord = spec.status === "draft" ? "Draft" : spec.status === "unpublished" ? "Unpublished" : "";
      return joinFacts(["3D", statusWord, trimmedLead(spec.name), spec.date || ""]);
    }
    case "model": {
      if (!spec.name) return "Model";
      return joinFacts(["Model", spec.name, spec.version || ""]);
    }
    case "media": {
      if (!("type" in spec) && !("date" in spec) && !("title" in spec) && !("audioTitle" in spec)) {
        return "Media";
      }
      return joinFacts([
        mediaTypeWord(spec.type),
        mediaTitleOf(spec),
        spec.date || ""
      ]);
    }
    case "generation": {
      if (!("date" in spec) && !("members" in spec)) return "Generation";
      const clause = batchClause(spec.members);
      const date = spec.date || "";
      if (!date && !clause) return "Generation";
      return joinFacts([clause, date]);
    }
    default:
      return "";
  }
}
function documentTitle(spec) {
  return withApp(documentLead(spec));
}
function routeTitleSpec(route) {
  const view = route?.view;
  const entityId = route?.entityId;
  const params = route?.params || {};
  if (entityId) {
    switch (view) {
      case "generations":
        return { place: "generation" };
      case "posts":
        return { place: "post" };
      case "comics":
        return { place: "comic" };
      case "model3ds":
        return { place: "model3d" };
      case "models":
        return { place: "model" };
      case "media":
        return { place: "media" };
      default:
        return { place: "overview" };
    }
  }
  switch (view) {
    case "overview":
      return { place: "overview" };
    case "exports":
      return { place: "exports" };
    case "download":
      return { place: "download" };
    case "models":
      return { place: "models" };
    case "generations":
      return {
        place: "generations",
        grain: params.granularity === "batch" ? "batch" : "media"
      };
    case "posts":
      return {
        place: "posts",
        grain: params.granularity === "media" ? "media" : "post"
      };
    case "comics":
      return {
        place: "comics",
        grain: params.granularity === "media" ? "media" : "comic"
      };
    case "model3ds":
      return { place: "model3ds" };
    case "resources-redirect":
    default:
      return { place: "overview" };
  }
}
function useDocumentTitle(spec) {
  const title = spec == null ? null : documentTitle(spec);
  y2(() => {
    if (title == null) return;
    document.title = title;
  }, [title]);
}

// dev/ui/src/lib/format.js
var TAG_LABELS = {
  "favorite": "\u2764\uFE0F Favorite",
  "feedback:liked": "\u{1F44D} Liked",
  "feedback:disliked": "\u{1F44E} Disliked"
};
function isReactionToken(t3) {
  return t3 === "favorite" || t3 === "feedback:liked" || t3 === "feedback:disliked";
}
function reactionMarks(item) {
  if (Array.isArray(item?.reactions)) return item.reactions;
  const tags = item?.tags;
  if (!Array.isArray(tags)) return [];
  return tags.filter(isReactionToken);
}
function memberReactionFields(member) {
  const row = member && typeof member === "object" ? member : {};
  const tags = Array.isArray(row.tags) ? row.tags : [];
  const reactions = Array.isArray(row.reactions) ? row.reactions.filter(isReactionToken) : tags.filter(isReactionToken);
  return { tags, reactions };
}
function generationMemberTile(member) {
  const row = member && typeof member === "object" ? member : {};
  const type = row.type;
  const id = normalizeMediaId(row.mediaId);
  const { tags, reactions } = memberReactionFields(row);
  return {
    id,
    type,
    tags,
    reactions,
    media: [{
      mediaId: id,
      type,
      thumbnailPath: row.thumbnailPath,
      tags,
      duration: row.duration
    }]
  };
}
function tagLabel(tag) {
  if (typeof tag === "object") return tag.name;
  return TAG_LABELS[tag] || tag;
}
function tagCssClass(tag) {
  const name = typeof tag === "string" ? tag : tag.name || "";
  return name.replace(/:/g, "-").replace(/\s+/g, "-").toLowerCase();
}
function genreLabel(value) {
  if (typeof value !== "string") return "";
  const token = value.trim();
  if (!token) return "";
  return token.replace(/([A-Z])/g, " $1").trim();
}
function nextTagsForReaction(tags, edit) {
  const set = new Set(Array.isArray(tags) ? tags : []);
  if ("favorite" in edit) {
    if (edit.favorite) set.add("favorite");
    else set.delete("favorite");
  }
  if ("feedback" in edit) {
    set.delete("feedback:liked");
    set.delete("feedback:disliked");
    if (edit.feedback === "liked") set.add("feedback:liked");
    else if (edit.feedback === "disliked") set.add("feedback:disliked");
  }
  return [...set].sort();
}
var MEDIA_FILE_EXTS = ["jpeg", "jpg", "png", "webp", "gif", "mp4", "webm", "wav", "mp3", "flac", "ogg", "glb"];
function normalizeMediaId(id) {
  const s3 = String(id ?? "");
  const dot = s3.lastIndexOf(".");
  if (dot === -1) return s3;
  return MEDIA_FILE_EXTS.includes(s3.slice(dot + 1).toLowerCase()) ? s3.slice(0, dot) : s3;
}
function mediaStageStyle(record) {
  const w3 = Number(record && record.width);
  const h3 = Number(record && record.height);
  let rw = 0;
  let rh = 0;
  if (w3 > 0 && h3 > 0) {
    rw = w3;
    rh = h3;
  } else {
    const cls = record && record.aspectClass;
    if (cls === "portrait") {
      rw = 2;
      rh = 3;
    } else if (cls === "landscape") {
      rw = 3;
      rh = 2;
    } else if (cls === "square") {
      rw = 1;
      rh = 1;
    }
  }
  if (!(rw > 0) || !(rh > 0)) return null;
  return {
    "--media-w": String(rw),
    "--media-h": String(rh),
    aspectRatio: `${rw} / ${rh}`
  };
}
function coverStillPath(record) {
  if (!record) return "";
  if (record.coverPath) return record.coverPath;
  const inputs = record.inputs;
  if (!Array.isArray(inputs)) return "";
  for (const inp of inputs) {
    if (inp && inp.role === "cover" && inp.thumbnailPath) return inp.thumbnailPath;
  }
  return "";
}
function isAudioCover(media) {
  if (!media || media.type !== "audio") return false;
  const ref = media.thumbnailPath || media.mediaId || "";
  return /\.(mp4|webm)(\?|#|$)/i.test(ref);
}
function thumbnailVisual({ type, thumbnailPath, coverPath } = {}) {
  if (coverPath) return { kind: "image", src: coverPath };
  if (type === "audio") {
    if (isAudioCover({ type, thumbnailPath })) return { kind: "video", src: thumbnailPath };
    return { kind: "glyph" };
  }
  if (type === "video") return { kind: "video", src: thumbnailPath };
  return { kind: "image", src: thumbnailPath };
}
function formatMediaCounts(counts) {
  if (!counts) return "";
  const parts = [];
  const image = Number(counts.image) || 0;
  const video = Number(counts.video) || 0;
  const audio = Number(counts.audio) || 0;
  if (image) parts.push(`${image} ${image === 1 ? "image" : "images"}`);
  if (video) parts.push(`${video} ${video === 1 ? "video" : "videos"}`);
  if (audio) parts.push(`${audio} audio`);
  const model3d = Number(counts.model3d) || 0;
  if (model3d) parts.push(`${model3d} 3D`);
  return parts.join(" \xB7 ");
}
function formatDate(isoString) {
  if (!isoString) return "";
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
var TIME_MONTH = /^(\d{4})-(\d{2})$/;
var TIME_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;
var TIME_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;
var CHIP_SECONDS = /^([1-9]\d*)s$/;
function timeDatetime(value) {
  if (typeof value !== "string" || value === "") return "";
  const month = TIME_MONTH.exec(value);
  if (month) {
    const m3 = Number(month[2]);
    return m3 >= 1 && m3 <= 12 ? value : "";
  }
  const day = TIME_DAY.exec(value);
  if (day) {
    const y3 = Number(day[1]);
    const m3 = Number(day[2]);
    const d3 = Number(day[3]);
    const utc = new Date(Date.UTC(y3, m3 - 1, d3));
    if (utc.getUTCFullYear() !== y3 || utc.getUTCMonth() !== m3 - 1 || utc.getUTCDate() !== d3) return "";
    return value;
  }
  if (TIME_INSTANT.test(value) && !Number.isNaN(new Date(value).getTime())) return value;
  return "";
}
function chipDatetime(text) {
  if (typeof text !== "string") return "";
  const match = CHIP_SECONDS.exec(text);
  return match ? `PT${match[1]}S` : "";
}
function calendarDaysAgo(isoString, now = /* @__PURE__ */ new Date()) {
  if (!isoString) return null;
  const then = new Date(isoString);
  if (Number.isNaN(then.getTime())) return null;
  const thenDay = Date.UTC(then.getFullYear(), then.getMonth(), then.getDate());
  const nowDay = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((nowDay - thenDay) / 864e5);
}
function relativeTime(isoString, now = /* @__PURE__ */ new Date()) {
  const days = calendarDaysAgo(isoString, now);
  if (days == null) return "";
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
var CONTAINER_EDGE_WORDS = {
  generation: ["Generation", "Generations"],
  post: ["Post", "Posts"],
  comic: ["Comic", "Comics"]
};
function containerEdgeHeading(kind, count) {
  const n2 = Number(count);
  if (!(n2 >= 1)) return "";
  const words = CONTAINER_EDGE_WORDS[kind];
  if (!words) return "";
  return n2 === 1 ? words[0] : `${n2} ${words[1]}`;
}
function containerEdgeRowParts({ date, title, id } = {}) {
  const dateStr = date == null ? "" : String(date).trim();
  const titleStr = title == null ? "" : String(title).trim();
  if (dateStr && titleStr) return { date: dateStr, tail: ` \xB7 ${titleStr}` };
  if (dateStr) return { date: dateStr, tail: "" };
  if (titleStr) return { date: "", tail: titleStr };
  if (id == null || id === "") return { date: "", tail: "" };
  const idStr = String(id).trim();
  return { date: "", tail: idStr };
}
var INPUT_MEDIA_ROLE_LABELS = {
  "first-frame": "First frame",
  "last-frame": "Last frame",
  "start-image": "Start image",
  "end-image": "End image",
  source: "Source",
  controlnet: "ControlNet",
  "source-video": "Source video",
  reference: "Reference",
  cover: "Cover",
  input: "Input"
};
function inputMediaTypeWord(item) {
  const raw = item && (item.kind || item.type);
  if (raw === "video") return "Video";
  if (raw === "audio") return "Audio";
  return "Image";
}
function inputMediaRoleKey(item) {
  const role = item && item.role;
  if (role == null || role === "") return "input";
  return String(role);
}
function inputMediaSlotLabel(role) {
  if (Object.prototype.hasOwnProperty.call(INPUT_MEDIA_ROLE_LABELS, role)) {
    return INPUT_MEDIA_ROLE_LABELS[role];
  }
  const spaced = role.replace(/-/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
function inputMediaCaptions(items) {
  if (!Array.isArray(items) || items.length === 0) return [];
  const roles = items.map(inputMediaRoleKey);
  const counts = /* @__PURE__ */ new Map();
  for (const role of roles) counts.set(role, (counts.get(role) || 0) + 1);
  const seen = /* @__PURE__ */ new Map();
  return items.map((item, i3) => {
    const role = roles[i3];
    const n2 = (seen.get(role) || 0) + 1;
    seen.set(role, n2);
    const typeWord = inputMediaTypeWord(item);
    if (counts.get(role) === 1) {
      return `${typeWord} \xB7 ${inputMediaSlotLabel(role)}`;
    }
    if (role === "input") return `${typeWord} \xB7 #${n2}`;
    return `${typeWord} \xB7 ${inputMediaSlotLabel(role)} #${n2}`;
  });
}
function postStatusLabel(publishedAt, now = Date.now()) {
  if (!publishedAt) return "Draft";
  const t3 = new Date(publishedAt).getTime();
  if (Number.isNaN(t3)) return "";
  return t3 > now ? "Scheduled" : "";
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

// src/modelsQuery.mjs
var KEY_TO_FIELD = Object.freeze({
  resourceType: "type",
  ecosystem: "ecosystem",
  base: "baseModel",
  model: "modelId",
  version: "versionId",
  name: "modelName",
  output: "familyOutput",
  family: "familyId",
  variant: "variant"
});
var FIELD_TO_KEY = Object.freeze({
  type: "resourceType",
  ecosystem: "ecosystem",
  baseModel: "base",
  modelId: "model",
  versionId: "version",
  modelName: "name",
  familyOutput: "output",
  familyId: "family",
  variant: "variant"
});
var FIELD_ORDER = Object.freeze([
  "type",
  "ecosystem",
  "baseModel",
  "modelId",
  "versionId",
  "modelName",
  "familyOutput",
  "familyId",
  "variant"
]);
var MEDIA_TYPE_TOKENS = /* @__PURE__ */ new Set(["image", "video", "audio", "model3d"]);
var LEGACY_PREFIX = Object.freeze({
  t: "type",
  b: "baseModel",
  e: "ecosystem",
  m: "modelId",
  v: "versionId",
  mn: "modelName",
  o: "familyOutput",
  f: "familyId"
});
var RETIRED_KEYS = Object.freeze([
  "scope",
  "model",
  "version",
  "ecosystem",
  "resourceType",
  "resource",
  "versionId",
  "familyId"
]);
function csv(value) {
  if (Array.isArray(value)) return value.map((part) => String(part).trim()).filter(Boolean);
  if (value == null || value === "") return [];
  return String(value).split(",").map((part) => part.trim()).filter(Boolean);
}
function decodeValue(raw) {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}
function segmentOf(raw, prefixMap) {
  if (!raw) return null;
  const dot = raw.indexOf(".");
  if (dot < 1) return null;
  const field = prefixMap[raw.slice(0, dot)];
  if (!field) return null;
  const value = decodeValue(raw.slice(dot + 1));
  if (!value) return null;
  return { field, value };
}
function termsFrom(param, separator, prefixMap, { bareMine = false } = {}) {
  if (param == null || param === "") return [];
  const terms = [];
  for (const rawTerm of String(param).split(separator)) {
    if (!rawTerm) continue;
    if (bareMine && rawTerm === "mine") {
      terms.push({ mine: true });
      continue;
    }
    const term = {};
    for (const rawSeg of rawTerm.split("/")) {
      const seg = segmentOf(rawSeg, prefixMap);
      if (!seg) continue;
      term[seg.field] = seg.value;
    }
    if (Object.keys(term).length) terms.push(term);
  }
  return terms;
}
function exceptTerm(value) {
  const hole = {};
  for (const rawSeg of String(value).split("/")) {
    const seg = segmentOf(rawSeg, KEY_TO_FIELD);
    if (!seg) continue;
    hole[seg.field] = seg.value;
  }
  return Object.keys(hole).length ? hole : null;
}
function readExcept(rawSeg) {
  const dot = rawSeg.indexOf(".");
  if (dot < 1 || rawSeg.slice(0, dot) !== "except") return void 0;
  const value = decodeValue(rawSeg.slice(dot + 1));
  if (!value) return null;
  return exceptTerm(value);
}
function assignPositive(term, rawSeg) {
  const seg = segmentOf(rawSeg, KEY_TO_FIELD);
  if (!seg) return;
  term[seg.field] = seg.value;
}
function parseModels(param) {
  if (param == null || param === "") return [];
  const terms = [];
  for (const rawTerm of String(param).split(",")) {
    if (!rawTerm) continue;
    const segments = rawTerm.split("/");
    if (segments[0] === "mine") {
      const term2 = { mine: true };
      const except2 = [];
      for (const rawSeg of segments.slice(1)) {
        const hole = readExcept(rawSeg);
        if (hole) except2.push(hole);
      }
      if (except2.length) term2.except = except2;
      terms.push(term2);
      continue;
    }
    const term = {};
    const except = [];
    for (const rawSeg of segments) {
      const hole = readExcept(rawSeg);
      if (hole) {
        except.push(hole);
        continue;
      }
      if (hole === null) continue;
      assignPositive(term, rawSeg);
    }
    if (except.length) term.except = except;
    if (Object.keys(term).filter((key) => key !== "except").length) terms.push(term);
  }
  return terms;
}
function parseLegacyScope(param) {
  return termsFrom(param, "~", LEGACY_PREFIX);
}
function exceptSegments(term) {
  const holes = Array.isArray(term?.except) ? term.except : [];
  const segs = [];
  for (const hole of holes) {
    const inner = serializeTerm(hole);
    if (!inner) continue;
    segs.push(`except.${encodeURIComponent(inner)}`);
  }
  return segs;
}
function serializeTerm(term) {
  if (!term || typeof term !== "object") return "";
  if (term.mine) return "";
  const segs = [];
  for (const field of FIELD_ORDER) {
    const value = term[field];
    if (value == null || value === "") continue;
    if (field === "modelName" && term.modelId) continue;
    if (field === "familyOutput" && term.familyId) continue;
    if (field === "variant" && !term.familyId) continue;
    const key = FIELD_TO_KEY[field];
    if (!key) continue;
    segs.push(`${key}.${encodeURIComponent(String(value))}`);
  }
  if (!segs.length) return "";
  segs.push(...exceptSegments(term));
  return segs.join("/");
}
function mineSerial(term) {
  const holes = exceptSegments(term);
  return holes.length ? `mine/${holes.join("/")}` : "mine";
}
function serializeModels(terms) {
  if (!Array.isArray(terms) || !terms.length) return "";
  const parts = [];
  let mineTerm = null;
  for (const term of terms) {
    if (term?.mine) {
      mineTerm = term;
      continue;
    }
    const serial = serializeTerm(term);
    if (serial) parts.push(serial);
  }
  if (mineTerm) parts.push(mineSerial(mineTerm));
  return parts.join(",");
}
function unpublishedTypeSegment(param) {
  if (param == null || param === "") return false;
  for (const rawTerm of String(param).split(",")) {
    for (const rawSeg of rawTerm.split("/")) {
      if (rawSeg.startsWith("type.")) return true;
    }
  }
  return false;
}
function mineKeyOn(value) {
  return value === "1" || value === "true" || value === true || value === 1;
}
function withoutRetired(query) {
  const out = { ...query || {} };
  for (const key of RETIRED_KEYS) delete out[key];
  return out;
}
function stringLiftQuery(query, { view } = {}) {
  const src = query || {};
  if (view === "models") return { ...src };
  const existingRaw = src.models == null ? "" : String(src.models);
  const preserveModels = unpublishedTypeSegment(existingRaw);
  const terms = preserveModels ? [] : parseModels(existingRaw);
  terms.push(...parseLegacyScope(src.scope));
  for (const id of csv(src.versionId)) terms.push({ versionId: id });
  for (const token of csv(src.resourceType)) terms.push({ type: token });
  for (const token of csv(src.ecosystem)) terms.push({ ecosystem: token });
  for (const token of csv(src.model)) terms.push({ modelName: token });
  for (const token of csv(src.resource)) terms.push({ modelName: token });
  const family = src.familyId;
  if (family != null && String(family) !== "") terms.push({ familyId: String(family) });
  if (mineKeyOn(src.mine)) terms.push({ mine: true });
  const out = withoutRetired(src);
  const typeTokens = csv(src.type);
  const media = typeTokens.filter((token) => MEDIA_TYPE_TOKENS.has(token));
  const leftover = typeTokens.filter((token) => !MEDIA_TYPE_TOKENS.has(token));
  if (media.length) {
    const have = csv(out.mediaType);
    const merged = [...have];
    for (const token of media) {
      if (!merged.includes(token)) merged.push(token);
    }
    out.mediaType = merged.join(",");
  }
  if (leftover.length) out.type = leftover.join(",");
  else delete out.type;
  delete out.mine;
  const serial = serializeModels(terms);
  if (preserveModels) out.models = serial ? `${existingRaw},${serial}` : existingRaw;
  else if (serial) out.models = serial;
  else delete out.models;
  return out;
}

export {
  l,
  _,
  k,
  x,
  L,
  J,
  d2 as d,
  y2 as y,
  _2,
  A2 as A,
  T2 as T,
  q2 as q,
  g2 as g,
  WIRE,
  browsingLevelOf,
  browsingLevelLabel,
  isRatingTagName,
  ratingTagLabel,
  ratingTagRank,
  parseModels,
  serializeModels,
  stringLiftQuery,
  u3 as u,
  getStats,
  getOverview,
  getGenerations,
  getGeneration,
  getPosts,
  getComics,
  getModel3ds,
  getModel3d,
  getMedia,
  getMediaDetail,
  getFacetValues,
  getModelHierarchy,
  getTypeWorkflowTree,
  getListOffer,
  getModels,
  getPost,
  getComic,
  getConfig,
  getUiPrefs,
  patchUiPrefs,
  updateConfig,
  getDownloadStatus,
  startDownloadQueue,
  saveDownloadModes,
  abortDownload,
  rebuildIndex,
  getModelCacheStatus,
  refreshModelCache,
  abortModelCacheRefresh,
  saveApiKey,
  deleteApiKey,
  protectApiKey,
  unprotectApiKey,
  unlockKey,
  refreshUser,
  openFolder,
  openFiles,
  openJson,
  setReaction,
  setReactions,
  listExports,
  createExport,
  updateExport,
  removalFileCount,
  deleteExport,
  planExportDraft,
  syncExport,
  cancelExportSync,
  connectExportSync,
  connectProgress,
  documentLead,
  routeTitleSpec,
  useDocumentTitle,
  reactionMarks,
  memberReactionFields,
  generationMemberTile,
  tagLabel,
  tagCssClass,
  genreLabel,
  nextTagsForReaction,
  normalizeMediaId,
  mediaStageStyle,
  coverStillPath,
  isAudioCover,
  thumbnailVisual,
  formatMediaCounts,
  formatDate,
  timeDatetime,
  chipDatetime,
  calendarDaysAgo,
  relativeTime,
  highlightTerms,
  containerEdgeHeading,
  containerEdgeRowParts,
  inputMediaCaptions,
  postStatusLabel,
  copyToClipboard
};
