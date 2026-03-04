import { highlightTerms } from '../lib/format.js';

export function HighlightText ({ text, search }) {
  if (!search || !text) return text || null;
  const parts = highlightTerms(text, search);
  if (parts.length <= 1) return text;
  const terms = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return parts.map((part, i) =>
    terms.includes(part.toLowerCase())
      ? <mark key={i} class="search-highlight">{part}</mark>
      : part
  );
}
