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

// A Tab to one that the line cuts off scrolls the line to show it, while it has the focus (ReportBuilder.scss lets
// the line scroll only then). A click doesn't: it would leave the title's start out of view.
const showIfTabbedTo = (e) => {
  let tabbed = false
  try {
    tabbed = e.currentTarget.matches(':focus-visible')
  } catch (error) {
    // Without :focus-visible, the line stays as it prints.
  }
  if (tabbed) {
    e.currentTarget.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
  }
}

// Inline, so the header still reads as it prints (the line cut short at its end), and a button to the keyboard too.
const InlineButton = ({ className, title, testId, onActivate, children }) => (
  <span
    role='button'
    tabIndex={0}
    className={className}
    title={title}
    data-test={testId}
    onClick={onActivate}
    onFocus={showIfTabbedTo}
    onKeyDown={(e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        onActivate()
      }
    }}
  >
    {children}
  </span>
)

const lockOf = (lock, onLockClick, lockLabel) =>
  lock ? (
    <span className={`${RB}-running-lock`} data-test='report-running-lock'>
      {' · '}
      {onLockClick ? (
        <InlineButton
          className={`${RB}-running-lock-button`}
          title={STRINGS.filterLock.changeIn(lockLabel || STRINGS.filterLock.title)}
          testId='report-running-lock-button'
          onActivate={onLockClick}
        >
          {lock}
        </InlineButton>
      ) : (
        lock
      )}
    </span>
  ) : null

// The title where the page is edited (RW-363): a click renames the report in place, as the toolbar's title field
// does. Return or a click elsewhere keeps the new name, and Escape puts back the one it had. What the report is for
// opens its picker.
const EditableRunningTitle = ({ title, onTitleChange, lock, onLockClick, lockLabel }) => {
  const [editing, setEditing] = React.useState(false)
  // The title when the field opened, which Escape puts back.
  const opened = React.useRef(title)
  return (
    <div className={`${RB}-running-title`} data-editing={editing ? '' : undefined}>
      {editing ? (
        <input
          type='text'
          className={`${RB}-running-title-input`}
          value={title}
          placeholder={STRINGS.titlePlaceholder}
          aria-label={STRINGS.titleLabel}
          data-test='report-running-title-input'
          autoFocus
          onChange={(e) => onTitleChange(e.target.value)}
          onBlur={() => setEditing(false)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === 'Escape') {
              e.preventDefault()
              e.stopPropagation()
              if (e.key === 'Escape' && title !== opened.current) {
                onTitleChange(opened.current)
              }
              setEditing(false)
            }
          }}
        />
      ) : (
        <InlineButton
          className={`${RB}-running-title-text`}
          title={STRINGS.renameTitle}
          testId='report-running-title'
          onActivate={() => {
            opened.current = title
            setEditing(true)
          }}
        >
          {title || STRINGS.untitled}
        </InlineButton>
      )}
      {lockOf(lock, onLockClick, lockLabel)}
    </div>
  )
}

// The title and the lockup, the lockup left, centred or right (branding.position) and the title clear of it. A report
// with a filter lock says what it's for after its title, on the same line: the header is one line high.
//
// Where the page is edited (RW-363), `onTitleChange` renames the report from its title, and `onLockClick` opens the
// lock's setting (`lockLabel` names it). As it prints, it's only drawn.
export const RunningHeader = ({ branding, title, lock, onTitleChange, onLockClick, lockLabel }) => (
  <header
    className={`${RB}-running-header`}
    data-brand-position={hasBranding(branding) ? branding.position || DEFAULT_BRAND_POSITION : undefined}
  >
    {onTitleChange ? (
      <EditableRunningTitle
        title={title}
        onTitleChange={onTitleChange}
        lock={lock}
        onLockClick={onLockClick}
        lockLabel={lockLabel}
      />
    ) : (
      <div className={`${RB}-running-title`}>
        {title || STRINGS.untitled}
        {lockOf(lock)}
      </div>
    )}
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
  if (dataAsOf) {
    return `${STRINGS.preview.dataAsOf} ${dataAsOf}`
  }
  return hasData ? STRINGS.preview.notRunYet : null
}

export const footerText = ({ generated, dataAsOf, hasData = true }) =>
  [generated ? `${STRINGS.preview.generated} ${generated}` : null, dataAgeText({ dataAsOf, hasData })]
    .filter(Boolean)
    .join(' · ')

export const hasDataBlocks = (report) => (report?.blocks || []).some((block) => block.type === 'data' && block.source)
