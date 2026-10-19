import React from 'react'
import { RB } from '../constants'
import { STRINGS } from '../strings'
import { brandFontFaceCss, DEFAULT_BRAND_POSITION } from '../model/branding'

// The organisation's branding (model/branding.js), as the pages draw it.

export const hasBranding = (branding) => !!(branding && (branding.name || branding.logoUrl || branding.wordmarkUrl))

// The lockup: the logo where there is one, then the wordmark, or else the name. Without a logo, the name stands
// alone.
export const BrandMark = ({ branding, size = 'small' }) => {
  if (!hasBranding(branding)) {
    return null
  }
  const { name, logoUrl, wordmarkUrl } = branding
  return (
    <div className={`${RB}-brand`} data-size={size}>
      {logoUrl ? <img className={`${RB}-brand-logo`} src={logoUrl} alt='' /> : null}
      {wordmarkUrl ? (
        <img className={`${RB}-brand-wordmark`} src={wordmarkUrl} alt={name || ''} />
      ) : name ? (
        <span className={`${RB}-brand-name`}>{name}</span>
      ) : null}
    </div>
  )
}

// The title and the lockup, the lockup left, centred or right (branding.position) and the title clear of it.
export const RunningHeader = ({ branding, title }) => (
  <header
    className={`${RB}-running-header`}
    data-brand-position={hasBranding(branding) ? branding.position || DEFAULT_BRAND_POSITION : undefined}
  >
    <div className={`${RB}-running-title`}>{title || STRINGS.untitled}</div>
    <BrandMark branding={branding} />
  </header>
)

// The organisation's fonts, as @font-face rules on the page — where the print frame, which copies every
// stylesheet on the page, finds them too.
export const BrandFonts = ({ branding, families }) => {
  const css = brandFontFaceCss(branding, families)
  return css ? <style data-report-brand-fonts=''>{css}</style> : null
}

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
