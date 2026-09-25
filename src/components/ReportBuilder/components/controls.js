import React, { useRef } from 'react'
import { RB } from '../constants'
import { STRINGS } from '../strings'

// Native form controls with prefixed classes. The library's own Select renders its menu in a portal,
// whose stacking a host app controls; a native <select> has no such dependency.

let idCounter = 0
export const useStableId = (prefix = 'field') => {
  const ref = useRef(null)
  if (ref.current === null) {
    idCounter += 1
    ref.current = `${RB}-${prefix}-${idCounter}`
  }
  return ref.current
}

export const SectionLabel = ({ children }) => <div className={`${RB}-section-label`}>{children}</div>

export const Note = ({ children, tone }) => (
  <p className={`${RB}-note`} data-tone={tone || undefined}>
    {children}
  </p>
)

export const Divider = () => <hr className={`${RB}-divider`} />

export const Field = ({ label, htmlFor, children }) => (
  <div className={`${RB}-field`}>
    {htmlFor ? (
      <label className={`${RB}-label`} htmlFor={htmlFor}>
        {label}
      </label>
    ) : (
      <div className={`${RB}-label`}>{label}</div>
    )}
    {children}
  </div>
)

// options: [[value, label], ...]. Values are compared as strings, as a <select> reports them.
export const SelectField = ({ label, value, options, onChange, disabled, testId }) => {
  const id = useStableId('select')
  const current = value == null ? '' : String(value)
  return (
    <Field label={label} htmlFor={id}>
      <select
        id={id}
        className={`${RB}-select`}
        value={current}
        disabled={disabled}
        data-test={testId}
        onChange={(e) => {
          const match = options.find(([optionValue]) => String(optionValue) === e.target.value)
          onChange(match ? match[0] : e.target.value)
        }}
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={String(optionValue)} value={String(optionValue)}>
            {optionLabel}
          </option>
        ))}
      </select>
    </Field>
  )
}

export const Segmented = ({ label, value, options, onChange, testId }) => (
  <Field label={label}>
    <div className={`${RB}-segmented`} role='group' aria-label={label} data-test={testId}>
      {options.map(([optionValue, optionLabel]) => (
        <button
          key={String(optionValue)}
          type='button'
          className={`${RB}-segment`}
          aria-pressed={optionValue === value}
          data-selected={optionValue === value || undefined}
          onClick={() => onChange(optionValue)}
        >
          {optionLabel}
        </button>
      ))}
    </div>
  </Field>
)

export const Toggle = ({ label, checked, onChange, testId }) => {
  const id = useStableId('toggle')
  return (
    <div className={`${RB}-toggle`}>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type='checkbox'
        role='switch'
        className={`${RB}-switch`}
        checked={!!checked}
        aria-checked={!!checked}
        data-test={testId}
        onChange={(e) => onChange(e.target.checked)}
      />
    </div>
  )
}

// Swatches, a "none" chip that clears the value, and a native colour input for anything else.
export const Swatches = ({ label, value, swatches, onChange, noneLabel = STRINGS.panel.themeDefault, testId }) => {
  const id = useStableId('colour')
  const current = (value || '').toLowerCase()
  const isCustom = !!current && !swatches.some(([hex]) => hex.toLowerCase() === current)
  return (
    <Field label={label}>
      <div className={`${RB}-swatches`} data-test={testId}>
        <button
          type='button'
          className={`${RB}-swatch`}
          data-none
          data-selected={!current || undefined}
          aria-pressed={!current}
          title={noneLabel}
          aria-label={noneLabel}
          onClick={() => onChange('')}
        />
        {swatches.map(([hex, name]) => (
          <button
            key={hex}
            type='button'
            className={`${RB}-swatch`}
            style={{ background: hex }}
            data-selected={hex.toLowerCase() === current || undefined}
            aria-pressed={hex.toLowerCase() === current}
            title={name}
            aria-label={name}
            onClick={() => onChange(hex)}
          />
        ))}
        <label
          className={`${RB}-swatch`}
          data-custom
          data-selected={isCustom || undefined}
          title={STRINGS.panel.customColour}
        >
          <input
            id={id}
            type='color'
            aria-label={STRINGS.panel.customColour}
            value={current || '#26a7e9'}
            onChange={(e) => onChange(e.target.value)}
          />
        </label>
      </div>
    </Field>
  )
}
