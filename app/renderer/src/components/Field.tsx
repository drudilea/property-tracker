import type { InputHTMLAttributes } from 'react';

interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

export function Field({ label, value, onChange, type = 'text', placeholder, ...rest }: FieldProps) {
  return (
    <div className="field">
      <label>
        {label}
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
