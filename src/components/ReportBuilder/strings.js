// The builder's copy, carried over from the prototype. Kept in one place so it reads as one voice.

export const STRINGS = {
  untitled: 'Untitled report',
  titlePlaceholder: 'Untitled report',
  titleLabel: 'Report title',

  run: 'Run report',
  runAgain: 'Run again',
  running: 'Running…',
  cancelRun: 'Stop',
  runStopped: 'Run stopped · some data not loaded',
  openPreview: 'Preview',
  backToEditing: 'Back to editing',
  print: 'Print…',
  printTitle: 'Opens your browser’s print dialog. Choose “Save as PDF” to download a file.',
  printing: 'Preparing…',

  addBlock: 'Add a block',
  paletteHint: 'Click a block to see what it does, then insert it.',
  paletteNote: 'A Data block shows a dashboard tile exactly as its dashboard does, or answers a question.',
  paletteNoteCaptures: 'To add data, use “Add to Report…” on a dashboard tile or an answer in the Query view.',

  details: 'Details',
  detailsSub: 'Report blocks',
  previewSample: 'Preview · sample data',
  insert: 'Insert block',
  properties: 'Properties',
  close: 'Close',

  emptyReportTitle: 'This report is empty',
  emptyReportBody: 'Add a block from the left. A Data block reads a dashboard tile, or asks a question of its own.',
  frontMatter: {
    both: 'Starts with a cover page and a table of contents. See them in Preview.',
    cover: 'Starts with a cover page. See it in Preview.',
    toc: 'Starts with a table of contents. See it in Preview.',
  },

  headingPlaceholder: 'Heading',
  textPlaceholder: 'Write anything here — context, a caveat, what the reader should take away.',
  pageBreak: 'Page break',

  moveUp: 'Move up',
  moveDown: 'Move down',
  duplicate: 'Duplicate',
  remove: 'Delete',

  data: {
    emptyTitle: 'What should this block show?',
    emptyBody: 'Ask a question, or pick a dashboard tile in the panel on the right.',
    askPlaceholder: 'Type a query in your own words',
    notRun: 'Run the report to load this.',
    noCapture:
      'No data was kept for this block. Add it again with “Add to Report…” from its dashboard or the Query view.',
    asOf: (when) => `As of ${when}`,
    filteredBy: (what) => `Filtered: ${what}`,
    loading: 'Loading…',
    stale: 'Changed since the last run. Run the report to update it.',
    missing: 'This tile is no longer on its dashboard.',
    unsupported: {
      unsupported: 'This kind of tile can’t be printed yet.',
      'no-query': 'This tile has no query to run.',
    },
    error: 'This query didn’t run.',
    continued: 'Continued on the next page',
    continuedTitle: '(continued)',
    interpretedAs: 'Interpreted as',
    // In the editor only, when interpretations are on but this answer came without one.
    noInterpretation: {
      tile: 'No interpretation to print: dashboard tiles don’t come with one yet.',
      query: 'No interpretation to print: AutoQL didn’t return one for this answer.',
    },
    askedAs: 'Asked as',
    total: 'Total',
  },

  panel: {
    pageSetup: 'Page setup',
    orientation: 'Orientation',
    margins: 'Margins',
    typeface: 'Typeface',
    typefaceNote: 'Applies to the whole report — headings, text and tables. Charts keep the product’s own type.',
    headerFooter: 'Running header & footer',
    header: 'Header on every page',
    footer: 'Footer on every page',
    pageNumbers: 'Page numbers',
    repeatTableHeaders: 'Repeat table headers',
    results: 'Results',
    showInterpretation: 'Show how each question was read',
    showInterpretationNote:
      'Prints AutoQL’s interpretation under each result, so a forwarded PDF can be checked. Answers added from a dashboard tile don’t have one yet.',
    frontMatter: 'Front matter',
    coverPage: 'Cover page',
    tableOfContents: 'Table of contents',
    nothingSelected: 'Select a block to change it. Blocks follow the theme until you override them.',

    level: 'Level',
    headingNote: 'Click the heading on the page to edit its words.',
    textNote: 'Click the paragraph on the page to edit it.',
    pageBreakNote: 'Everything after this starts on a new page. No settings.',
    unknownNote: 'This block was made by a newer version of the report builder. It’s kept as it is.',

    text: 'Text',
    font: 'Font',
    size: 'Size',
    weight: 'Weight',
    textColour: 'Text colour',
    block: 'Block',
    width: 'Width',
    align: 'Align',
    background: 'Background',
    resetToTheme: 'Reset to theme',
    themeNote: 'Left on the defaults, blocks follow the theme your organisation has configured.',
    default: 'Default',
    themeDefault: 'Theme default',
    none: 'None',
    customColour: 'Custom colour',

    source: 'Source',
    dashboard: 'Dashboard',
    tile: 'Tile',
    question: 'Question',
    sourceNote:
      'Chart type, columns, sorting and number format come from this tile. To change how it looks, edit the tile on its dashboard — every report that uses it follows.',
    captured: 'Captured',
    capturedNote:
      'This is what the answer showed when it was added — its data, sorting, filters, columns and chart settings — kept as it was. Add it again to update it.',
    noCaptureNote: 'Data blocks come from “Add to Report…” on a dashboard tile or an answer in the Query view.',
    questionNote: 'A question has no tile to inherit from, so it shows AutoQL’s default display.',
    changeSource: 'Change source',
    cancel: 'Cancel',
    askQuestion: 'Ask a question',
    askNote: 'Press Enter to use it. It runs with the rest of the report.',
    orExisting: 'or use existing data',
    chooseDashboard: 'Choose a dashboard…',
    chooseTile: 'Choose a tile…',
    noDashboards: 'No dashboards are available.',
    hiddenTiles: (n) =>
      `${n} ${
        n === 1 ? 'tile isn’t' : 'tiles aren’t'
      } listed: pivot tables, network graphs and Sankey charts can’t be printed yet.`,

    showAs: 'Show as',
    // The names the answer's chart toolbar uses.
    displayTypes: {
      table: 'Table',
      column: 'Column Chart',
      bar: 'Bar Chart',
      line: 'Line Chart',
      pie: 'Pie Chart',
      heatmap: 'Heatmap',
      bubble: 'Bubble Chart',
      stacked_bar: 'Stacked Bar Chart',
      stacked_column: 'Stacked Column Chart',
      stacked_line: 'Stacked Area Chart',
      column_line: 'Column Line Combo Chart',
      histogram: 'Histogram',
      scatterplot: 'Scatterplot',
    },
    chartOfSlice: (shown, total) =>
      `The chart draws the ${Number(shown).toLocaleString()} rows this block keeps, not all ${Number(
        total,
      ).toLocaleString()}.`,

    rows: 'Rows to include',
    rowsCap: (max) => `A printed page can’t scroll, so a table shows at most ${max} rows.`,
    rowsRanked: (by) => ` These are the top rows by ${by} — the tile’s own order.`,
    rowsRankedUnnamed: ' These are the top rows in the tile’s own order.',
    rowsUnranked: (n) =>
      ` The tile isn’t sorted, so these are the first ${n} rows as returned, not a top ${n}. Sort the tile on its dashboard to rank them.`,
    rowsQuestion: (n) => ` Nothing sorts a question’s rows, so these are the first ${n} as returned.`,
    rowsCaptured: (by) => ` These are the top rows by ${by}, sorted as the table was when it was added.`,
    rowsCapturedUnnamed: ' These are the top rows, sorted as the table was when it was added.',
    rowsCapturedUnsorted: (n) =>
      ` The table wasn’t sorted when it was added, so these are its first ${n} rows, not a top ${n}. To rank them, sort the table and add it again.`,
    rowsNoTotal: ' No total is shown while the table is cut off — only the server can total the full result.',
  },

  preview: {
    title: 'Print preview',
    measuring: 'Laying out pages…',
    pages: (n) => `${n} ${n === 1 ? 'page' : 'pages'}`,
    letter: 'Letter',
    overflow: 'Taller than a page — it will be cut off.',
    overflowNotice: (n) =>
      `${n} ${n === 1 ? 'page has' : 'pages have'} a block taller than a page, which will be cut off when printed.`,
    chartsTimedOut: (n) => `${n} ${n === 1 ? 'chart hadn’t' : 'charts hadn’t'} finished drawing and may print blank.`,
    contents: 'Contents',
    generated: 'Generated',
    dataAsOf: 'Data as of',
    page: (n, total) => `Page ${n} of ${total}`,
    notRunYet: 'Not yet run',
  },
}
