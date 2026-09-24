import React from 'react'
import { RB } from '../constants'
import { STRINGS } from '../strings'

// Branding comes from the host (organisation-level), so the builder only draws it.

const initialsOf = (name) =>
  String(name || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join('')

export const hasBranding = (branding) => !!(branding && (branding.name || branding.logoUrl))

export const BrandMark = ({ branding, size = 'small' }) => {
  if (!hasBranding(branding)) {
    return null
  }
  const { name, logoUrl, color } = branding
  return (
    <div className={`${RB}-brand`} data-size={size}>
      {logoUrl ? (
        <img className={`${RB}-brand-logo`} src={logoUrl} alt={name || ''} />
      ) : (
        <span className={`${RB}-brand-chip`} style={color ? { background: color } : undefined} aria-hidden='true'>
          {initialsOf(name)}
        </span>
      )}
      {name && !logoUrl ? <span className={`${RB}-brand-name`}>{name}</span> : null}
    </div>
  )
}

export const RunningHeader = ({ branding, title }) => (
  <header className={`${RB}-running-header`}>
    <div className={`${RB}-running-title`}>{title || STRINGS.untitled}</div>
    <BrandMark branding={branding} />
  </header>
)

export const RunningFooter = ({ left, right }) => (
  <footer className={`${RB}-running-footer`}>
    <span>{left}</span>
    <span>{right}</span>
  </footer>
)

// "Generated 23 Sep 2026 · Data as of 23 Sep 2026, 14:05", or "… · Not yet run" before a run. A report
// with no data says nothing about data.
export const dataAgeText = ({ dataAsOf, hasData }) => {
  if (dataAsOf) return `${STRINGS.preview.dataAsOf} ${dataAsOf}`
  return hasData ? STRINGS.preview.notRunYet : null
}

export const footerText = ({ generated, dataAsOf, hasData = true }) =>
  [generated ? `${STRINGS.preview.generated} ${generated}` : null, dataAgeText({ dataAsOf, hasData })]
    .filter(Boolean)
    .join(' · ')

export const hasDataBlocks = (report) => (report?.blocks || []).some((block) => block.type === 'data' && block.source)
