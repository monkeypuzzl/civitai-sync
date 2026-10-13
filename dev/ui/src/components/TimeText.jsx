import { timeDatetime } from '../lib/format.js';

// Visible text is always `children`. `datetime` is used as given (a file
// length). `at` is a source instant passed through timeDatetime. An empty
// attribute renders the children with no time element. No children renders
// nothing, so the attribute is never shown as text.
export function TimeText ({ at, datetime, class: className, children }) {
  if (children == null || children === false || children === '') return null;
  const resolved = datetime != null && datetime !== ''
    ? String(datetime)
    : timeDatetime(at);
  if (!resolved) {
    if (className) return <span class={className}>{children}</span>;
    return <>{children}</>;
  }
  return <time class={className} datetime={resolved}>{children}</time>;
}
