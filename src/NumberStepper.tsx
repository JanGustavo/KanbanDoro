import { useEffect, useState } from 'react';

type Props = { value: number; min: number; max: number; label: string; onChange: (value: number) => void };

export default function NumberStepper({ value, min, max, label, onChange }: Props) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const commit = (raw: string) => {
    const parsed = Number(raw);
    const next = raw.trim() && Number.isFinite(parsed) ? Math.max(min, Math.min(max, Math.round(parsed))) : value;
    setDraft(String(next));
    if (next !== value) onChange(next);
  };
  return <div className="number-stepper">
    <button type="button" aria-label={`Diminuir ${label}`} disabled={value <= min} onClick={() => commit(String(value - 1))}>−</button>
    <input type="number" aria-label={label} min={min} max={max} value={draft} onChange={event => setDraft(event.target.value)} onBlur={event => commit(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); commit(event.currentTarget.value); } }} />
    <button type="button" aria-label={`Aumentar ${label}`} disabled={value >= max} onClick={() => commit(String(value + 1))}>+</button>
  </div>;
}
