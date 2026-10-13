import { useState, useEffect, useId } from 'preact/hooks';

// Numeric / date range primitive used by FacetBar for the `*Min`/`*Max`
// (cfg, steps) and `dateFrom`/`dateTo` axes. Both bounds commit on blur or
// Enter — never on every keystroke — so the URL stays clean (the typed-round
// -trip is locked through parseUrl/formatUrl, steward ruling 9). An empty
// input clears that bound.
export function RangePicker ({ label, minKey, maxKey, state, update, type = 'number' }) {
  const fmt = (v) => (v == null || v === '' || (typeof v === 'number' && Number.isNaN(v)) ? '' : String(v));
  const [min, setMin] = useState(fmt(state[minKey]));
  const [max, setMax] = useState(fmt(state[maxKey]));

  // Adopt URL-side changes (back/forward, clear-all) into the buffers.
  useEffect(() => { setMin(fmt(state[minKey])); }, [state[minKey]]);
  useEffect(() => { setMax(fmt(state[maxKey])); }, [state[maxKey]]);

  function commit (key, raw) {
    if (type === 'date') {
      update({ [key]: raw || null });
      return;
    }
    const n = raw === '' ? null : Number(raw);
    update({ [key]: (n == null || Number.isNaN(n)) ? null : n });
  }

  const inputType = type === 'date' ? 'date' : 'number';
  const minId = useId();
  const maxId = useId();
  const minCaption = type === 'date' ? `${label} from` : `${label} minimum`;
  const maxCaption = type === 'date' ? `${label} to` : `${label} maximum`;
  const onBound = (key, setter) => ({
    value: key === minKey ? min : max,
    onInput: (e) => setter(e.target.value),
    onBlur: (e) => commit(key, e.target.value),
    onKeyDown: (e) => { if (e.key === 'Enter') commit(key, e.target.value); }
  });

  return (
    <div class="facet-range">
      <span class="facet-range-label">{label}</span>
      <label class="visually-hidden" for={minId}>{minCaption}</label>
      <input id={minId} class="facet-range-input" type={inputType}
        placeholder={type === 'date' ? 'from' : 'min'} {...onBound(minKey, setMin)} />
      <span class="facet-range-sep">{'\u2013'}</span>
      <label class="visually-hidden" for={maxId}>{maxCaption}</label>
      <input id={maxId} class="facet-range-input" type={inputType}
        placeholder={type === 'date' ? 'to' : 'max'} {...onBound(maxKey, setMax)} />
    </div>
  );
}
