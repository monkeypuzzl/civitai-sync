// Closed When-button readout for an inclusive dateFrom/dateTo pair.
// Month names match the When panel. Calendar days are UTC.

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

const EN = '\u2013';
const ELLIPSIS = '\u2026';

function lastUtcDay (year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function parseIsoDate (raw) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12) return null;
  const last = lastUtcDay(y, mo);
  if (d < 1 || d > last) return null;
  return { y, mo, d, iso: m[0] };
}

function monthName (mo) {
  return MONTHS[mo - 1];
}

function point (p) {
  return `${p.d} ${monthName(p.mo)} ${p.y}`;
}

function dayMonth (p) {
  return `${p.d} ${monthName(p.mo)}`;
}

function sideText (raw, parsed) {
  return parsed ? point(parsed) : raw;
}

function formatMonthSpan (from, to) {
  if (from.mo === 1 && to.mo === 12) {
    if (from.y === to.y) return String(from.y);
    return `${from.y} ${EN} ${to.y}`;
  }
  const fromMon = monthName(from.mo);
  const toMon = monthName(to.mo);
  if (from.y === to.y && from.mo === to.mo) return `${fromMon} ${from.y}`;
  if (from.y === to.y) return `${fromMon} ${EN} ${toMon} ${from.y}`;
  return `${fromMon} ${from.y} ${EN} ${toMon} ${to.y}`;
}

export function formatWhenRange (dateFrom, dateTo) {
  const fromRaw = String(dateFrom || '').trim();
  const toRaw = String(dateTo || '').trim();
  if (!fromRaw && !toRaw) return '';

  const from = fromRaw ? parseIsoDate(fromRaw) : null;
  const to = toRaw ? parseIsoDate(toRaw) : null;

  if (!fromRaw) return `${ELLIPSIS} ${EN} ${sideText(toRaw, to)}`;
  if (!toRaw) return `${sideText(fromRaw, from)} ${EN} ${ELLIPSIS}`;
  if (!from || !to || from.iso > to.iso) {
    return `${sideText(fromRaw, from)} ${EN} ${sideText(toRaw, to)}`;
  }
  if (from.iso === to.iso) return point(from);
  if (from.d === 1 && to.d === lastUtcDay(to.y, to.mo)) return formatMonthSpan(from, to);
  if (from.y === to.y && from.mo === to.mo) {
    return `${from.d}${EN}${to.d} ${monthName(from.mo)} ${from.y}`;
  }
  if (from.y === to.y) return `${dayMonth(from)} ${EN} ${dayMonth(to)} ${from.y}`;
  return `${point(from)} ${EN} ${point(to)}`;
}
