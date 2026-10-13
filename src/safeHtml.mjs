// Civitai TipTap HTML → allowlisted JSON tree. Never round-trip to innerHTML.
// Media/embed nodes are dropped (including descendants). Models then truncate
// the tree; posts render it as-is.

export const SAFE_HTML_BLOCK_MAX = 400;
export const SAFE_HTML_TOTAL_MAX = 1000;
export const SAFE_HTML_GLUE_MAX = 60;

const KEEP = new Set([
  'p', 'h1', 'h2', 'h3', 'ul', 'ol', 'li', 'blockquote', 'pre',
  'hr', 'br', 'strong', 'em', 'u', 's', 'code', 'a'
]);

const VOID = new Set([
  'br', 'hr', 'img', 'source', 'embed', 'area', 'base', 'col',
  'link', 'meta', 'wbr', 'input'
]);

const DROP = new Set([
  'img', 'picture', 'source', 'video', 'audio', 'iframe', 'embed',
  'object', 'canvas', 'svg', 'edge-media', 'script', 'style', 'noscript'
]);

const EMBED_DATA_TYPES = new Set(['youtube', 'instagram', 'strawpoll', 'blurb']);

const NAMED_ENTITIES = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: '\u00a0'
};

export function decodeHtmlEntities (str) {
  if (typeof str !== 'string' || str === '') return '';
  return str.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z][a-zA-Z0-9]+);/g, (full, body) => {
    if (body[0] === '#') {
      const code = body[1] === 'x' || body[1] === 'X'
        ? Number.parseInt(body.slice(2), 16)
        : Number.parseInt(body.slice(1), 10);
      if (!Number.isFinite(code) || code < 0) return full;
      try {
        return String.fromCodePoint(code);
      } catch {
        return full;
      }
    }
    const named = NAMED_ENTITIES[body.toLowerCase()];
    return named === undefined ? full : named;
  });
}

function parseAttrs (raw) {
  const attrs = {};
  if (typeof raw !== 'string' || raw === '') return attrs;
  const re = /([^\s=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let m;
  while ((m = re.exec(raw))) {
    const name = m[1].toLowerCase();
    if (name === '/' || name === '') continue;
    attrs[name] = decodeHtmlEntities(m[2] ?? m[3] ?? m[4] ?? '');
  }
  return attrs;
}

function readTag (s, i) {
  if (s[i] !== '<') return null;
  let j = i + 1;
  if (j >= s.length) return null;
  const isEnd = s[j] === '/';
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
    if (ch === '>') {
      const attrRaw = s.slice(attrStart, j).trim();
      const selfClosing = attrRaw.endsWith('/') || VOID.has(name);
      return {
        next: j + 1,
        kind: isEnd ? 'end' : 'start',
        name,
        attrs: isEnd ? {} : parseAttrs(attrRaw.replace(/\/\s*$/, '')),
        selfClosing: isEnd ? false : selfClosing
      };
    }
    j++;
  }
  return null;
}

function tokenize (html) {
  const s = String(html);
  const tokens = [];
  let i = 0;
  while (i < s.length) {
    if (s.startsWith('<!--', i)) {
      const end = s.indexOf('-->', i + 4);
      i = end === -1 ? s.length : end + 3;
      continue;
    }
    if (s[i] === '<') {
      const tag = readTag(s, i);
      if (tag) {
        tokens.push(tag);
        i = tag.next;
        continue;
      }
    }
    const next = s.indexOf('<', i + 1);
    const end = next === -1 ? s.length : next;
    tokens.push({ kind: 'text', value: s.slice(i, end) });
    i = end;
  }
  return tokens;
}

function buildRaw (tokens) {
  const root = { type: 'element', name: '#root', attrs: {}, children: [] };
  const stack = [root];
  for (const tok of tokens) {
    const parent = stack[stack.length - 1];
    if (tok.kind === 'text') {
      parent.children.push({ type: 'text', value: tok.value });
      continue;
    }
    if (tok.kind === 'start') {
      const el = { type: 'element', name: tok.name, attrs: tok.attrs, children: [] };
      parent.children.push(el);
      if (!tok.selfClosing && !VOID.has(tok.name)) stack.push(el);
      continue;
    }
    if (tok.kind === 'end') {
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

function isEmbedDiv (attrs) {
  if (!attrs || typeof attrs !== 'object') return false;
  if (Object.prototype.hasOwnProperty.call(attrs, 'data-youtube-video')) return true;
  const dataType = String(attrs['data-type'] || '').toLowerCase();
  return EMBED_DATA_TYPES.has(dataType);
}

function pushSafe (out, node) {
  if (node == null) return;
  if (Array.isArray(node)) {
    for (const n of node) pushSafe(out, n);
    return;
  }
  out.push(node);
}

function toSafeList (nodes) {
  const out = [];
  if (!Array.isArray(nodes)) return out;
  for (const n of nodes) pushSafe(out, toSafeNode(n));
  return out;
}

function toSafeNode (n) {
  if (!n || typeof n !== 'object') return null;
  if (n.type === 'text') {
    const v = decodeHtmlEntities(n.value);
    return v === '' ? null : { t: 'text', v };
  }
  const name = n.name;
  if (DROP.has(name) || (name === 'div' && isEmbedDiv(n.attrs))) return null;

  const kids = toSafeList(n.children);

  if (name === 'a') {
    const href = typeof n.attrs?.href === 'string' ? n.attrs.href.trim() : '';
    if (/^https?:\/\//i.test(href)) return { t: 'a', href, c: kids };
    return kids;
  }

  if (KEEP.has(name)) {
    if (name === 'br' || name === 'hr') return { t: name };
    return { t: name, c: kids };
  }
  return kids;
}

export function htmlToSafeTree (html) {
  if (html == null) return [];
  const s = String(html);
  if (s === '') return [];
  return toSafeList(buildRaw(tokenize(s)));
}

export function collectTreeText (tree) {
  if (tree == null) return '';
  if (Array.isArray(tree)) return tree.map(collectTreeText).join('');
  if (typeof tree !== 'object') return '';
  if (tree.t === 'text') return typeof tree.v === 'string' ? tree.v : '';
  if (Array.isArray(tree.c)) return collectTreeText(tree.c);
  return '';
}

export function treeHasText (tree) {
  return collectTreeText(tree).replace(/\s+/g, '').length > 0;
}

function sentenceTrim (text, max) {
  const src = String(text);
  if (src.length <= max) return src.trim();
  let out = '';
  let i = 0;
  while (i < src.length) {
    const rest = src.slice(i);
    const m = rest.match(/^[\s\S]*?[.。!？](?:\s+|$)/);
    const chunk = m ? m[0] : rest;
    if (chunk.length > max && out === '') return '';
    if (out.length + chunk.length > max) break;
    out += chunk;
    i += chunk.length;
    if (!m) break;
  }
  return out.trim();
}

export function truncateTree (tree) {
  if (!Array.isArray(tree) || tree.length === 0) return null;
  const infos = tree.map(node => ({ node, n: collectTreeText(node).length }));
  const skipped = infos.map(info => info.n === 0 || info.n > SAFE_HTML_BLOCK_MAX);
  const anyKeepable = skipped.some(s => !s);

  if (!anyKeepable) {
    const first = infos.find(info => info.n > 0);
    if (!first) return null;
    const trimmed = sentenceTrim(collectTreeText(first.node), SAFE_HTML_BLOCK_MAX);
    if (!trimmed) return null;
    return [{ t: 'p', c: [{ t: 'text', v: trimmed }] }];
  }

  const glueSkip = skipped.slice();
  for (let i = 0; i < infos.length; i++) {
    if (glueSkip[i]) continue;
    if (infos[i].n < SAFE_HTML_GLUE_MAX && i + 1 < infos.length && skipped[i + 1]) {
      glueSkip[i] = true;
    }
  }

  const kept = [];
  let total = 0;
  for (let i = 0; i < infos.length; i++) {
    if (glueSkip[i]) continue;
    const n = infos[i].n;
    if (total + n > SAFE_HTML_TOTAL_MAX) break;
    kept.push(infos[i].node);
    total += n;
  }
  return kept.length ? kept : null;
}
