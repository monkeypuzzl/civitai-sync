// Allowlisted Civitai HTML tree → Preact elements. Never innerHTML.

const TAGS = new Set([
  'p', 'h1', 'h2', 'h3', 'ul', 'ol', 'li', 'blockquote', 'pre',
  'hr', 'br', 'strong', 'em', 'u', 's', 'code'
]);

function SafeNode ({ node }) {
  if (!node || typeof node !== 'object') return null;
  if (node.t === 'text') return node.v;
  if (node.t === 'br') return <br />;
  if (node.t === 'hr') return <hr />;
  const children = Array.isArray(node.c)
    ? node.c.map((child, i) => <SafeNode key={i} node={child} />)
    : null;
  if (node.t === 'a') {
    return (
      <a href={node.href} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    );
  }
  if (!TAGS.has(node.t)) return children;
  const Tag = node.t;
  return <Tag>{children}</Tag>;
}

export function SafeRichText ({ tree }) {
  if (!Array.isArray(tree) || tree.length === 0) return null;
  return tree.map((node, i) => <SafeNode key={i} node={node} />);
}
