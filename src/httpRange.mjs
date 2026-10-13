// Single byte-range for media file responses. Multi-range is `null`
// (caller sends the whole file). An unsatisfiable range is the string
// 'unsatisfiable' (caller sends 416).

const BYTE_SPEC = /^bytes=([^,]*)$/i;

export function parseByteRange (header, total) {
  if (header == null) return null;
  const raw = String(Array.isArray(header) ? header[0] : header).trim();
  if (!raw) return null;
  if (raw.includes(',')) return null;

  const match = BYTE_SPEC.exec(raw);
  if (!match) return 'unsatisfiable';
  const spec = match[1].trim();
  if (!spec) return null;

  const size = Number(total);
  if (!Number.isSafeInteger(size) || size <= 0) return 'unsatisfiable';

  const dash = spec.indexOf('-');
  if (dash <= -1) return 'unsatisfiable';
  const startStr = spec.slice(0, dash);
  const endStr = spec.slice(dash + 1);
  if (startStr === '' && endStr === '') return null;
  if (startStr !== '' && !/^\d+$/.test(startStr)) return 'unsatisfiable';
  if (endStr !== '' && !/^\d+$/.test(endStr)) return 'unsatisfiable';

  if (startStr === '') {
    const suffix = Number(endStr);
    if (suffix <= 0) return 'unsatisfiable';
    const len = Math.min(suffix, size);
    return { start: size - len, end: size - 1 };
  }

  const start = Number(startStr);
  if (start >= size) return 'unsatisfiable';
  let end = endStr === '' ? size - 1 : Number(endStr);
  if (end < start) return 'unsatisfiable';
  if (end >= size) end = size - 1;
  return { start, end };
}
