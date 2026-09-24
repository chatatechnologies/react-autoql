import { v4 as uuid } from 'uuid'
import {
  ALIGN_OPTIONS,
  DEFAULT_HEADING_LEVEL,
  DEFAULT_TABLE_ROWS,
  MARGINS_IN,
  MAX_TABLE_ROWS,
  ORIENTATION_OPTIONS,
  TABLE_ROW_OPTIONS,
  TEXT_SIZES,
  TEXT_WEIGHTS,
  TYPEFACES,
  WIDTH_OPTIONS,
} from '../constants'

// A report is a template: its blocks say what to show, never the data itself. Everything here is
// plain JSON, so a host can persist it as-is. Query responses live only in the builder's state.

export const REPORT_SCHEMA_VERSION = 1

export const DEFAULT_PAGE_SETUP = {
  orientation: 'portrait',
  margins: 'normal',
  typeface: 'theme',
  header: true,
  footer: true,
  pageNumbers: true,
  repeatTableHeaders: true,
  showInterpretation: true,
  coverPage: false,
  tableOfContents: false,
}

const HEX = /^#[0-9a-f]{6}$/i
const isObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v)
const oneOf = (value, allowed, fallback) => (allowed.includes(value) ? value : fallback)
const optionKeys = (options) => options.map(([key]) => key)

// Snap to the largest allowed row count at or below the request, within the cap.
export const snapTableRows = (rows) => {
  const n = Number(rows)
  if (!Number.isFinite(n)) {
    return DEFAULT_TABLE_ROWS
  }
  const capped = Math.min(n, MAX_TABLE_ROWS)
  const fits = TABLE_ROW_OPTIONS.filter((option) => option <= capped)
  return fits.length ? fits[fits.length - 1] : TABLE_ROW_OPTIONS[0]
}

// Unknown or empty style keys are dropped: absent means "follow the theme".
export const normalizeStyle = (style) => {
  if (!isObject(style)) {
    return undefined
  }
  const out = {}
  if (style.font && style.font !== 'theme' && TYPEFACES[style.font]) out.font = style.font
  if (TEXT_SIZES[style.size]) out.size = style.size
  if (TEXT_WEIGHTS[style.weight]) out.weight = style.weight
  if (HEX.test(style.color || '')) out.color = style.color
  if (HEX.test(style.background || '')) out.background = style.background
  if (optionKeys(ALIGN_OPTIONS).includes(style.align) && style.align !== 'left') out.align = style.align
  return Object.keys(out).length ? out : undefined
}

export const normalizeSource = (source) => {
  if (!isObject(source)) {
    return null
  }
  if (source.type === 'tile' && source.dashboardId != null && source.tileKey != null) {
    return {
      type: 'tile',
      dashboardId: String(source.dashboardId),
      tileKey: String(source.tileKey),
      // Labels for when the tile can't be found; never executed.
      ...(isObject(source.snapshot) ? { snapshot: source.snapshot } : {}),
    }
  }
  if (source.type === 'query' && typeof source.query === 'string' && source.query.trim()) {
    return { type: 'query', query: source.query }
  }
  return null
}

// Always replaces the raw style copied in by the caller's spread, so an invalid one can't survive.
const withStyle = (block, style) => {
  const normalized = normalizeStyle(style)
  const { style: raw, ...rest } = block
  return normalized ? { ...rest, style: normalized } : rest
}

export const normalizeBlock = (block) => {
  if (!isObject(block)) {
    return null
  }
  const id = typeof block.id === 'string' && block.id ? block.id : uuid()
  const width = oneOf(block.width, optionKeys(WIDTH_OPTIONS), 'full')

  switch (block.type) {
    case 'heading':
      return withStyle(
        {
          ...block,
          id,
          type: 'heading',
          text: typeof block.text === 'string' ? block.text : '',
          level: [1, 2, 3].includes(block.level) ? block.level : DEFAULT_HEADING_LEVEL,
          width,
        },
        block.style,
      )
    case 'text':
      return withStyle(
        { ...block, id, type: 'text', text: typeof block.text === 'string' ? block.text : '', width },
        block.style,
      )
    case 'data': {
      const { style, displayType, ...rest } = block // a data block looks the way its tile does
      return {
        ...rest,
        id,
        type: 'data',
        width,
        source: normalizeSource(block.source),
        rows: snapTableRows(block.rows),
        // How it's shown, when not as captured; checked against the data when it's drawn.
        ...(typeof displayType === 'string' && displayType ? { displayType } : {}),
      }
    }
    case 'pagebreak':
      return { id, type: 'pagebreak' }
    default:
      // A block type from a newer version: keep it untouched so a save doesn't destroy it.
      return { ...block, id }
  }
}

export const normalizePageSetup = (page) => {
  const input = isObject(page) ? page : {}
  const out = { ...DEFAULT_PAGE_SETUP, ...input }
  out.orientation = oneOf(input.orientation, optionKeys(ORIENTATION_OPTIONS), DEFAULT_PAGE_SETUP.orientation)
  out.margins = oneOf(input.margins, Object.keys(MARGINS_IN), DEFAULT_PAGE_SETUP.margins)
  out.typeface = oneOf(input.typeface, Object.keys(TYPEFACES), DEFAULT_PAGE_SETUP.typeface)
  Object.keys(DEFAULT_PAGE_SETUP).forEach((key) => {
    if (typeof DEFAULT_PAGE_SETUP[key] === 'boolean' && typeof out[key] !== 'boolean') {
      out[key] = DEFAULT_PAGE_SETUP[key]
    }
  })
  return out
}

export const createEmptyReport = (overrides = {}) => {
  const { page, ...rest } = overrides || {}
  return {
    schemaVersion: REPORT_SCHEMA_VERSION,
    title: '',
    blocks: [],
    ...rest,
    page: normalizePageSetup(page),
  }
}

// Fills defaults, validates every value against the options the builder offers, and gives each
// block an id. Unknown top-level fields and unknown block types are kept.
export const normalizeReport = (report) => {
  if (!isObject(report)) {
    return createEmptyReport()
  }
  return {
    ...report,
    schemaVersion: typeof report.schemaVersion === 'number' ? report.schemaVersion : REPORT_SCHEMA_VERSION,
    title: typeof report.title === 'string' ? report.title : '',
    page: normalizePageSetup(report.page),
    blocks: (Array.isArray(report.blocks) ? report.blocks : []).map(normalizeBlock).filter(Boolean),
  }
}

export const isNewerSchema = (report) => (report?.schemaVersion || 0) > REPORT_SCHEMA_VERSION

// A new block as inserted from the details layer. The draft carries what was chosen there.
export const createBlock = (type, draft = {}) => {
  const base = { id: uuid(), width: 'full' }
  switch (type) {
    case 'heading':
      return { ...base, type, text: '', level: [1, 2, 3].includes(draft.level) ? draft.level : DEFAULT_HEADING_LEVEL }
    case 'text':
      return { ...base, type, text: '' }
    case 'data':
      return { ...base, type, source: null, rows: DEFAULT_TABLE_ROWS }
    case 'pagebreak':
      return { id: base.id, type }
    default:
      return null
  }
}
