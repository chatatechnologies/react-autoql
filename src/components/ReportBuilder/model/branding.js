import { TYPEFACES } from '../constants'

// The organisation's branding: what the builder draws at the top of every page and on the cover (its name, a
// logo, a wordmark, and where they sit), the colours offered in the panel's colour pickers, and the fonts a
// report on the theme's typeface is set in. AutoQL keeps it for the organisation (run/brandingApi.js); the
// host's `branding` fills in whatever isn't set there.

export const BRAND_NAME_MAX = 80
export const BRAND_POSITIONS = ['left', 'center', 'right']
export const DEFAULT_BRAND_POSITION = 'left'
export const MAX_BRAND_COLOURS = 6
export const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp']
export const IMAGE_MAX_BYTES = 256 * 1024
// A font file's extension → the media type its data: URL carries, and the format() its @font-face names.
export const FONT_TYPES = {
  woff2: { mime: 'font/woff2', format: 'woff2' },
  woff: { mime: 'font/woff', format: 'woff' },
  ttf: { mime: 'font/ttf', format: 'truetype' },
  otf: { mime: 'font/otf', format: 'opentype' },
}
export const FONT_MAX_BYTES = 500 * 1024
export const BRAND_FONT_ROLES = ['heading', 'body']
// The families the uploaded fonts go by, on screen and in print.
export const BRAND_FONT_FAMILIES = { heading: 'react-autoql-brand-heading', body: 'react-autoql-brand-body' }
// Set on a report's paper when it's on the theme's typeface and the organisation has fonts (ReportPaper.scss).
export const BODY_FONT_VAR = '--react-autoql-report-builder-body-font'
export const HEADING_FONT_VAR = '--react-autoql-report-builder-heading-font'
const THEME_FONT = "var(--react-autoql-font-family, 'Helvetica Neue', Arial, sans-serif)"

const HEX6 = /^#?([0-9a-f]{6})$/i
const HEX3 = /^#?([0-9a-f]{3})$/i
const RGB = /^(?:rgb\s*\(\s*)?(\d{1,3})\s*[,\s]\s*(\d{1,3})\s*[,\s]\s*(\d{1,3})\s*\)?$/i

// "#1B4D8F", "1b4d8f", "#fa0", "rgb(27, 77, 143)" or "27, 77, 143" → "#1b4d8f"; anything else → null.
export const parseColour = (input) => {
  const text = String(input ?? '').trim()
  let match = text.match(HEX6)
  if (match) return `#${match[1].toLowerCase()}`
  match = text.match(HEX3)
  if (match) {
    return `#${match[1]
      .split('')
      .map((c) => c + c)
      .join('')
      .toLowerCase()}`
  }
  match = text.match(RGB)
  if (match) {
    const parts = match.slice(1, 4).map(Number)
    if (parts.every((n) => n <= 255)) return `#${parts.map((n) => n.toString(16).padStart(2, '0')).join('')}`
  }
  return null
}

const isText = (value) => typeof value === 'string' && value.length > 0

// A font as the builder keeps it: { name (as shown), url (a data: URL) }.
const fontOf = (font) =>
  font && typeof font === 'object' && isText(font.url)
    ? { name: isText(font.name) ? font.name : '', url: font.url }
    : undefined

// The branding as the builder draws it. `color` is the initials badge's: the first brand colour, else the one
// given on its own (the host's).
export const normalizeBranding = (raw) => {
  const b = raw && typeof raw === 'object' ? raw : {}
  const colors = (Array.isArray(b.colors) ? b.colors : [])
    .map(parseColour)
    .filter(Boolean)
    .filter((hex, i, all) => all.indexOf(hex) === i)
    .slice(0, MAX_BRAND_COLOURS)
  return {
    name: isText(b.name) ? b.name : '',
    logoUrl: isText(b.logoUrl) ? b.logoUrl : undefined,
    wordmarkUrl: isText(b.wordmarkUrl) ? b.wordmarkUrl : undefined,
    position: BRAND_POSITIONS.includes(b.position) ? b.position : DEFAULT_BRAND_POSITION,
    colors,
    color: colors[0] || parseColour(b.color) || undefined,
    headingFont: fontOf(b.headingFont),
    bodyFont: fontOf(b.bodyFont),
  }
}

const isSet = (value) => value != null && value !== '' && !(Array.isArray(value) && value.length === 0)

// What the organisation set in AutoQL wins; the host's branding fills in the rest (its name, say).
export const mergeBranding = (host, org) => {
  const merged = { ...(host && typeof host === 'object' ? host : {}) }
  Object.entries(org && typeof org === 'object' ? org : {}).forEach(([key, value]) => {
    if (isSet(value)) merged[key] = value
  })
  // The host's own badge colour gives way to the organisation's colours.
  if (isSet(org?.colors)) delete merged.color
  return normalizeBranding(merged)
}

const fontFromApi = (font) =>
  font && typeof font === 'object' && isText(font.data)
    ? { name: isText(font.name) ? font.name : '', url: font.data }
    : undefined

// AutoQL's branding (snake_case, images and fonts as data: URLs) → the builder's, leaving out what isn't set.
export const brandingFromApi = (data) => {
  const d = data && typeof data === 'object' ? data : {}
  const out = {
    name: isText(d.name) ? d.name : undefined,
    logoUrl: isText(d.logo) ? d.logo : undefined,
    wordmarkUrl: isText(d.wordmark) ? d.wordmark : undefined,
    position: BRAND_POSITIONS.includes(d.position) ? d.position : undefined,
    colors: Array.isArray(d.colors) ? d.colors.map(parseColour).filter(Boolean) : undefined,
    headingFont: fontFromApi(d.heading_font),
    bodyFont: fontFromApi(d.body_font),
  }
  Object.keys(out).forEach((key) => out[key] === undefined && delete out[key])
  return out
}

// The whole branding as AutoQL stores it: what's left out is cleared.
export const brandingToApi = (branding) => {
  const b = normalizeBranding(branding)
  const font = (f) => (f ? { name: f.name, data: f.url } : null)
  return {
    name: b.name,
    logo: b.logoUrl || null,
    wordmark: b.wordmarkUrl || null,
    position: b.position,
    colors: b.colors,
    heading_font: font(b.headingFont),
    body_font: font(b.bodyFont),
  }
}

// ---------------------------------------------------------------- fonts

const FONT_URL = /^data:([a-z0-9.+/-]+);base64,[a-z0-9+/=]+$/i

const formatOf = (url) => {
  const mime = (url.match(FONT_URL) || [])[1]?.toLowerCase()
  return Object.values(FONT_TYPES).find((type) => type.mime === mime)?.format
}

// @font-face rules for the organisation's fonts, under the families given (the dialog previews a draft under
// families of its own). Only base64 data: URLs are written out, so nothing can end the rule or the <style>.
export const brandFontFaceCss = (branding, families = BRAND_FONT_FAMILIES) =>
  BRAND_FONT_ROLES.map((role) => {
    const url = branding?.[`${role}Font`]?.url
    if (!isText(url) || !FONT_URL.test(url)) return ''
    const format = formatOf(url)
    return `@font-face{font-family:'${families[role]}';src:url("${url}")${
      format ? ` format('${format}')` : ''
    };font-display:block;}`
  }).join('')

// How a report's paper takes its type: a typeface chosen by name, as is; on the theme's, the organisation's
// fonts where it has them — its body font for the text, its heading font (else the body font) for headings.
// Charts keep AutoQL's own type. `families` are the ones brandFontFaceCss was given.
export const paperFontStyle = (page, branding, families = BRAND_FONT_FAMILIES) => {
  const stack = TYPEFACES[page?.typeface]?.stack
  if (stack) return { fontFamily: stack }
  const style = {}
  if (branding?.bodyFont) style[BODY_FONT_VAR] = `'${families.body}', ${THEME_FONT}`
  if (branding?.headingFont) style[HEADING_FONT_VAR] = `'${families.heading}', ${THEME_FONT}`
  return Object.keys(style).length ? style : undefined
}

// Whether two brandings set type alike: pages are laid out again only when they don't.
export const sameBrandFonts = (a, b) =>
  BRAND_FONT_ROLES.every((role) => (a?.[`${role}Font`]?.url || '') === (b?.[`${role}Font`]?.url || ''))

// The first family of each font a report's paper uses, to load before anything is measured.
export const paperFontFamilies = (page, branding) => {
  const stack = TYPEFACES[page?.typeface]?.stack
  if (stack) return [stack]
  return BRAND_FONT_ROLES.filter((role) => branding?.[`${role}Font`]).map((role) => `'${BRAND_FONT_FAMILIES[role]}'`)
}
