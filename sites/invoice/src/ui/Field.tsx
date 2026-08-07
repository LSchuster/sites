import type { ReactNode } from 'react';

export function Field(props: { label: string; hint?: string; children: ReactNode; grow?: boolean }) {
  return (
    <label className={props.grow ? 'field grow' : 'field'}>
      <span className="field-label">{props.label}</span>
      {props.children}
      {props.hint ? <span className="field-hint">{props.hint}</span> : null}
    </label>
  );
}
