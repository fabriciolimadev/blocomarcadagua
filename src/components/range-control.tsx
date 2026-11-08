"use client";

export function RangeControl({ label, value, min, max, description, disabled, onChange }: {
  label: string; value: number; min: number; max: number; description?: string;
  disabled: boolean; onChange: (value: number) => void;
}) {
  const id = `range-${label.toLowerCase().replaceAll(" ", "-")}`;
  return <div className="range-control">
    <div className="control-label"><label htmlFor={id}>{label}</label><output htmlFor={id}>{Math.round(value)}<span>%</span></output></div>
    <input id={id} type="range" min={min} max={max} value={value} disabled={disabled} onChange={(event) => onChange(Number(event.target.value))}
      style={{ backgroundImage: `linear-gradient(to right, var(--accent) ${(value - min) / (max - min) * 100}%, var(--track) ${(value - min) / (max - min) * 100}%)` }} />
    {description && <p className="field-hint">{description}</p>}
  </div>;
}
