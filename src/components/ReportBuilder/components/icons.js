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
  pagebreak: (
    <>
      <path d='M4.6 5.2V2.6h6.8v2.6M4.6 10.8v2.6h6.8v-2.6' />
      <path d='M1.8 8h12.4' strokeDasharray='2.4 2' />
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
  warning: <path d='M8 2.5l6 10.5H2zM8 6.5v3M8 11.2v.3' />,
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
