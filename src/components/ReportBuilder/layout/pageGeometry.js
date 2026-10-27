import { MARGINS_IN } from '../constants'

// Reports are always US Letter. Everything is in inches so the paper is the same size whatever the
// host's root font size; 96 CSS px per inch is what browsers print at.
export const PX_PER_IN = 96
export const LETTER_IN = { width: 8.5, height: 11 }
export const HEADER_IN = 0.55
export const FOOTER_IN = 0.35

export const getPageGeometry = (page = {}) => {
  const landscape = page.orientation === 'landscape'
  const widthIn = landscape ? LETTER_IN.height : LETTER_IN.width
  const heightIn = landscape ? LETTER_IN.width : LETTER_IN.height
  const marginIn = MARGINS_IN[page.margins] ?? MARGINS_IN.normal
  const headerIn = page.header ? HEADER_IN : 0
  const footerIn = page.footer || page.pageNumbers ? FOOTER_IN : 0
  const contentWidthIn = widthIn - 2 * marginIn
  const contentHeightIn = heightIn - 2 * marginIn - headerIn - footerIn

  return {
    orientation: landscape ? 'landscape' : 'portrait',
    widthIn,
    heightIn,
    marginIn,
    headerIn,
    footerIn,
    contentWidthIn,
    contentHeightIn,
    contentWidthPx: Math.round(contentWidthIn * PX_PER_IN),
    contentHeightPx: Math.round(contentHeightIn * PX_PER_IN),
  }
}
