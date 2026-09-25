// Every class the builder renders starts with this, so a host's utility CSS (Tailwind Preflight and
// friends, unprefixed) can't collide with it.
export const RB = 'react-autoql-report-builder'

export const BLOCK_TYPES = ['heading', 'text', 'data', 'pagebreak']

// Named by what they do in the document, not by markdown convention.
export const HEADING_LEVELS = [
  [1, 'Title'],
  [2, 'Section'],
  [3, 'Subsection'],
]
export const DEFAULT_HEADING_LEVEL = 2

// A printed page can't scroll, so a table in a report is a capped slice of its tile.
export const TABLE_ROW_OPTIONS = [10, 25, 50, 100]
export const DEFAULT_TABLE_ROWS = 25
export const MAX_TABLE_ROWS = 100

export const WIDTH_OPTIONS = [
  ['full', 'Full'],
  ['half', 'Half'],
]
export const ALIGN_OPTIONS = [
  ['left', 'Left'],
  ['center', 'Centre'],
  ['right', 'Right'],
]
export const ORIENTATION_OPTIONS = [
  ['portrait', 'Portrait'],
  ['landscape', 'Landscape'],
]
export const MARGIN_OPTIONS = [
  ['narrow', 'Narrow'],
  ['normal', 'Normal'],
  ['wide', 'Wide'],
]
export const MARGINS_IN = { narrow: 0.5, normal: 0.75, wide: 1 }

// No font is fetched by default: external companies consume this library. Each stack falls back
// to fonts every platform has, and a host can load the named faces via fontStylesheetUrl.
export const TYPEFACES = {
  theme: { label: 'Theme default', stack: null },
  archivo: { label: 'Archivo (sans)', stack: "'Archivo', 'Helvetica Neue', Arial, sans-serif" },
  newsreader: { label: 'Newsreader (serif)', stack: "'Newsreader', Georgia, 'Times New Roman', serif" },
  'plex-mono': { label: 'IBM Plex Mono', stack: "'IBM Plex Mono', Menlo, Consolas, monospace" },
}

// In points, so paper text is the same size whatever the host's root font size.
export const TEXT_SIZES = {
  small: { label: 'Small', pt: 9 },
  normal: { label: 'Normal', pt: 10.5 },
  large: { label: 'Large', pt: 13.5 },
  xlarge: { label: 'Extra large', pt: 16.5 },
  huge: { label: 'Huge', pt: 21 },
}
export const TEXT_WEIGHTS = {
  regular: { label: 'Regular', value: 400 },
  medium: { label: 'Medium', value: 500 },
  semibold: { label: 'Semibold', value: 600 },
  bold: { label: 'Bold', value: 700 },
}

export const INK_SWATCHES = [
  ['#16181C', 'Ink'],
  ['#495057', 'Muted'],
  ['#7F848A', 'Grey'],
  ['#26A7E9', 'Accent'],
  ['#A5CD39', 'Green'],
  ['#DD6A6A', 'Red'],
  ['#FFA700', 'Amber'],
]
export const BG_SWATCHES = [
  ['#F1F3F5', 'Grey'],
  ['#E8F5FD', 'Blue'],
  ['#EDF4DC', 'Green'],
  ['#FFF2D9', 'Amber'],
  ['#FBE9E9', 'Red'],
]

export const CHART_HEIGHT_PX = { full: 280, half: 220 }

export const QUERY_CONCURRENCY = 6

// Display types v1 can't print faithfully: pivots need a second layout pass, network and sankey
// charts never report that they've finished drawing.
export const UNSUPPORTED_DISPLAY_TYPES = ['pivot_table', 'network_graph', 'sankey']

export const TILE_SOURCE = 'report_builder.tile'
export const QUESTION_SOURCE = 'report_builder.question'

export const BLOCK_INFO = {
  heading: {
    label: 'Heading',
    what: 'A section title. The table of contents is built from these.',
    note: 'Click the heading on the page to edit its words.',
  },
  text: {
    label: 'Text',
    what: 'A paragraph you write yourself — context, a caveat, or what the reader should take away.',
    note: 'Click the paragraph on the page to edit it.',
  },
  data: {
    label: 'Data',
    what: 'One result, shown exactly as its dashboard tile shows it. Pick a tile, or ask a question.',
    note: 'The block arrives empty — ask it a question, or pick a dashboard tile on the right.',
  },
  pagebreak: {
    label: 'Page break',
    what: 'Everything after this starts on a new page.',
    note: 'No settings.',
  },
}
