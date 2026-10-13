export function GranularityToggle ({ value, options, onChange }) {
  return (
    <fieldset class="granularity-toggle">
      <legend class="granularity-label">View</legend>
      {(options || []).map(opt => (
        <label key={opt.value} class="granularity-option">
          <input
            type="radio"
            name="granularity"
            value={opt.value}
            checked={value === opt.value}
            onChange={() => onChange(opt.value)}
          />
          {opt.label}
        </label>
      ))}
    </fieldset>
  );
}
