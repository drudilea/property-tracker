import type { InputHTMLAttributes, ReactNode } from 'react';

interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  label: string;
  value: string;
  onChange: (value: string) => void;
  help?: ReactNode;
}

export function Field({ label, value, onChange, type = 'text', placeholder, help, ...rest }: FieldProps) {
  return (
    <div className="field">
      <label>
        <span className="field-label-row">
          {label}
          {help}
        </span>
        <input
          type={type}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          {...rest}
        />
      </label>
    </div>
  );
}
