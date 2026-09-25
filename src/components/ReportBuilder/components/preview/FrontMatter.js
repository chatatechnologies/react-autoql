import React from 'react'
import { RB } from '../../constants'
import { STRINGS } from '../../strings'
import { BrandMark, dataAgeText } from '../PageFurniture'

// The cover has no running header or footer. The table of contents gets a page of its own after it.

export const CoverPage = ({ title, branding, generated, dataAsOf, hasData }) => (
  <div className={`${RB}-cover`}>
    <BrandMark branding={branding} size='large' />
    <div className={`${RB}-cover-middle`}>
      <div className={`${RB}-cover-title`} role='heading' aria-level={1}>
        {title || STRINGS.untitled}
      </div>
      <div className={`${RB}-cover-sub`}>{dataAgeText({ dataAsOf, hasData })}</div>
    </div>
    <div className={`${RB}-cover-foot`}>
      <span>{generated ? `${STRINGS.preview.generated} ${generated}` : ''}</span>
      <span>{branding?.name || ''}</span>
    </div>
  </div>
)

// entries: [{ id, text, level, page }] — page is the printed page number.
export const TableOfContents = ({ entries }) => (
  <nav className={`${RB}-toc`} aria-label={STRINGS.preview.contents}>
    <div className={`${RB}-toc-title`}>{STRINGS.preview.contents}</div>
    {entries.map((entry) => (
      <div key={entry.id} className={`${RB}-toc-entry`} data-level={entry.level}>
        <span>{entry.text}</span>
        <i aria-hidden='true' />
        <b>{entry.page}</b>
      </div>
    ))}
  </nav>
)
