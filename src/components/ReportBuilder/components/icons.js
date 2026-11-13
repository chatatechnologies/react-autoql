import React from 'react'
import { RB } from '../constants'

// Inline icons, drawn in currentColor, so the builder needs no icon font and no portal-rendered popovers.

const PATHS = {
  heading: <path d='M3.5 3v10M11 3v10M3.5 8H11' />,
  text: <path d='M2.5 4h11M2.5 8h11M2.5 12h6.5' />,
  data: (
    <>
      <rect x='2' y='3' width='12' height='10' rx='1.5' />
      <path d='M2 6.4h12M6.2 6.4V13M10 6.4V13' />
    </>
  ),
  // Auto Analyze's sparkle.
  analysis: (
    <>
      <path d='M7.6 2.4l1.1 2.9 2.9 1.1-2.9 1.1-1.1 2.9-1.1-2.9L3.6 6.4l2.9-1.1z' />
      <path d='M12.3 10.2l.5 1.3 1.3.5-1.3.5-.5 1.3-.5-1.3-1.3-.5 1.3-.5z' />
    </>
  ),
  pagebreak: (
    <>
      <path d='M4.6 5.2V2.6h6.8v2.6M4.6 10.8v2.6h6.8v-2.6' />
      <path d='M1.8 8h12.4' strokeDasharray='2.4 2' />
    </>
  ),
  // A new report.
  new: (
    <>
      <path d='M4 2.5h5l3 3v8H4z' />
      <path d='M8 7.5v4M6 9.5h4' />
    </>
  ),
  up: <path d='M4 10l4-4 4 4' />,
  down: <path d='M4 6l4 4 4-4' />,
  duplicate: (
    <>
      <rect x='5.5' y='5.5' width='8' height='8' rx='1.2' />
      <path d='M10.5 5.5V3.7a1.2 1.2 0 0 0-1.2-1.2H3.7a1.2 1.2 0 0 0-1.2 1.2v5.6a1.2 1.2 0 0 0 1.2 1.2h1.8' />
    </>
  ),
  remove: <path d='M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8.5h5.8l.6-8.5' />,
  close: <path d='M4 4l8 8M12 4l-8 8' />,
  play: <path d='M5 3.5v9l7.5-4.5z' />,
  printer: (
    <>
      <path d='M4.5 6V2.5h7V6' />
      <rect x='2' y='6' width='12' height='5.5' rx='1.2' />
      <path d='M4.5 9.5h7V13.5h-7z' />
    </>
  ),
  eye: (
    <>
      <path d='M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8z' />
      <circle cx='8' cy='8' r='2' />
    </>
  ),
  back: <path d='M9.5 3.5L5 8l4.5 4.5' />,
  // The properties panel, at the right.
  panel: (
    <>
      <rect x='2' y='3' width='12' height='10' rx='1.5' />
      <path d='M10 3v10' />
    </>
  ),
  warning: <path d='M8 2.5l6 10.5H2zM8 6.5v3M8 11.2v.3' />,
  // The report options menu: three dots, one above the other.
  more: (
    <>
      <circle cx='8' cy='3.5' r='1.15' fill='currentColor' stroke='none' />
      <circle cx='8' cy='8' r='1.15' fill='currentColor' stroke='none' />
      <circle cx='8' cy='12.5' r='1.15' fill='currentColor' stroke='none' />
    </>
  ),
  // The reports workspace (workspace/): its home tab, a report's tab, New report, saving, and starting points.
  home: <path d='M2.5 7.5L8 3l5.5 4.5M4 6.5V13h3V9.5h2V13h3V6.5' />,
  file: (
    <>
      <path d='M4 2.5h5l3 3v8H4z' />
      <path d='M9 2.5v3h3M6 8.5h4M6 11h4' />
    </>
  ),
  plus: <path d='M8 3.5v9M3.5 8h9' />,
  spinner: <path d='M8 2.5a5.5 5.5 0 1 1-5.5 5.5' />,
  check: <path d='M3.5 8.5l3 3 6-7' />,
  refresh: (
    <>
      <path d='M13 8a5 5 0 1 1-1.5-3.6' />
      <path d='M13 2.5v3h-3' />
    </>
  ),
  alert: (
    <>
      <circle cx='8' cy='8' r='5.5' />
      <path d='M8 5v3.5M8 10.8v.2' />
    </>
  ),
  question: <path d='M3 3.5h10v7H7l-3 2.5v-2.5H3z' />,
  // A page laid out: a report template.
  template: (
    <>
      <rect x='3.5' y='2' width='9' height='12' rx='1' />
      <path d='M5.75 4.75h4.5M5.75 7h4.5' />
      <rect x='5.75' y='9.25' width='4.5' height='2.5' rx='0.5' />
    </>
  ),
  dashboard: (
    <>
      <rect x='2.5' y='2.5' width='4.5' height='4.5' rx='1' />
      <rect x='9' y='2.5' width='4.5' height='4.5' rx='1' />
      <rect x='2.5' y='9' width='4.5' height='4.5' rx='1' />
      <rect x='9' y='9' width='4.5' height='4.5' rx='1' />
    </>
  ),
  // The formatting bar's.
  'list-bulleted': (
    <>
      <path d='M6.5 4h7M6.5 8h7M6.5 12h7' />
      <path d='M3 4h.01M3 8h.01M3 12h.01' strokeWidth='2.2' />
    </>
  ),
  'list-numbered': (
    <>
      <path d='M7 4h6.5M7 8h6.5M7 12h6.5' />
      <path d='M2.6 3.2l1-.7v3M2.4 7.6c.3-.5 1.7-.6 1.7.3 0 .7-1.7 1.4-1.7 2.1h1.8' strokeWidth='1.1' />
    </>
  ),
  link: (
    <>
      <path d='M6.8 9.2a2.6 2.6 0 0 0 3.7 0l2.2-2.2a2.6 2.6 0 0 0-3.7-3.7l-.9.9' />
      <path d='M9.2 6.8a2.6 2.6 0 0 0-3.7 0L3.3 9a2.6 2.6 0 0 0 3.7 3.7l.9-.9' />
    </>
  ),
  'clear-format': (
    <>
      <path d='M4 3.5h8M8 3.5l-2 9M5 12.5h3' />
      <path d='M10 9.5l3.5 3.5M13.5 9.5L10 13' />
    </>
  ),
}

export const Icon = ({ name, size = 15, title }) => (
  <svg
    className={`${RB}-icon`}
    viewBox='0 0 16 16'
    width={size}
    height={size}
    fill='none'
    stroke='currentColor'
    strokeWidth='1.5'
    strokeLinecap='round'
    strokeLinejoin='round'
    aria-hidden={title ? undefined : 'true'}
    role={title ? 'img' : undefined}
    focusable='false'
  >
    {title ? <title>{title}</title> : null}
    {PATHS[name] || null}
  </svg>
)
