'use client';

import React, { useEffect, useState } from 'react';
import { getCountryOptions, matchCountryLabel } from '@/lib/country-origin';

const COUNTRY_OPTIONS = getCountryOptions();
const OTHER_VALUE = '__other__';

type CountrySelectProps = {
  value: string;
  onChange: (country: string) => void;
  required?: boolean;
  id?: string;
  className?: string;
  disabled?: boolean;
};

function deriveMode(value: string): string {
  const matched = matchCountryLabel(value);
  if (matched) return matched;
  if (value.trim()) return OTHER_VALUE;
  return '';
}

/**
 * Country dropdown aligned with storefront flag matching (`getCountryOptions`).
 * Unknown saved values fall into "Other" with a free-text field.
 */
export default function CountrySelect({
  value,
  onChange,
  required,
  id,
  className = 'saas-input text-xs',
  disabled,
}: CountrySelectProps) {
  const [mode, setMode] = useState(() => deriveMode(value));
  const [otherText, setOtherText] = useState(() =>
    matchCountryLabel(value) ? '' : value
  );

  useEffect(() => {
    const nextMode = deriveMode(value);
    setMode(nextMode);
    setOtherText(matchCountryLabel(value) ? '' : value);
  }, [value]);

  return (
    <div className="space-y-2">
      <select
        id={id}
        required={required && mode !== OTHER_VALUE}
        disabled={disabled}
        value={mode}
        onChange={(e) => {
          const next = e.target.value;
          setMode(next);
          if (next === OTHER_VALUE) {
            onChange(otherText.trim());
            return;
          }
          if (!next) {
            onChange('');
            return;
          }
          setOtherText('');
          onChange(next);
        }}
        className={className}
      >
        <option value="">Select country…</option>
        {COUNTRY_OPTIONS.map((c) => (
          <option key={c.code} value={c.label}>
            {c.label}
          </option>
        ))}
        <option value={OTHER_VALUE}>Other (custom)</option>
      </select>
      {mode === OTHER_VALUE && (
        <input
          type="text"
          required={required}
          disabled={disabled}
          value={otherText}
          onChange={(e) => {
            setOtherText(e.target.value);
            onChange(e.target.value);
          }}
          placeholder="Enter country or region"
          className={className}
        />
      )}
    </div>
  );
}
