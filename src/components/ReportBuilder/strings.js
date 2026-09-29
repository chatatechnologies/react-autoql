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
  newReport: 'New report',
  getStarted: 'Get started…',
  getStartedHint: 'Start from a question, a dashboard, or a blank page.',
  paletteNote: 'A Data block shows a dashboard tile exactly as its dashboard does, or answers a question.',
  paletteNoteCaptures: 'To add data, use “Add to Report…” on a dashboard tile or an answer in the Query view.',
  // When Data blocks keep what they're given (enableDataBlocks): with and without the host's tile picker.
  paletteNoteDataBlocks: {
    tiles:
      'A Data block keeps a result as it was shown: a question you ask here, dashboard tiles you pick, or an answer added with “Add to Report…”.',
    ask: 'A Data block keeps a result as it was shown: a question you ask here, or an answer added with “Add to Report…”.',
  },
  // The details layer's copy for such a Data block.
  dataDetails: {
    tiles: {
      what: 'A result kept as it was shown: ask a question, or pick dashboard tiles. Nothing reruns by itself.',
      note: 'The block arrives empty — ask it a question, or pick dashboard tiles for it.',
    },
    ask: {
      what: 'A result kept as it was shown: ask a question, and its answer stays as it came back.',
      note: 'The block arrives empty — ask it a question.',
    },
  },

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

  analyzeResult: 'Auto Analyze this result (uses one credit)',
  moveUp: 'Move up',
  moveDown: 'Move down',
  duplicate: 'Duplicate',
  remove: 'Delete',

  data: {
    emptyTitle: 'What should this block show?',
    emptyBody: 'Ask a question, or pick a dashboard tile in the panel on the right.',
    askPlaceholder: 'Type a query in your own words',
    pickTiles: 'Pick dashboard tiles…',
    picking: 'Picking tiles…',
    pickBody: 'Each tile you pick becomes a Data block here, as its dashboard shows it now.',
    or: 'or',
    askBody: 'Press Enter to ask. The answer is kept as it comes back; nothing reruns by itself.',
    asking: (query) => `Asking “${query}”…`,
    askFailed: {
      error: 'That question didn’t run.',
      'no-data': 'That question came back with no data to show.',
      unsupported: 'That answer can’t be kept in a report yet.',
    },
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

  analysis: {
    emptyTitle: 'Nothing written yet',
    emptyBody: 'Choose a result in the panel on the right, then Analyze.',
    emptyReady: 'Analyze in the panel on the right to write about this result.',
    writing: 'Auto Analyze is writing…',
    source: 'Auto Analyze',
    from: (title) => `from “${title}”`,
    focus: (focus) => `focus: ${focus}`,
    // In the editor only.
    targetGone: 'The result this was written about has been removed from the report.',
    targetChanged: 'Its result has changed since this was written. Analyze again to update the wording.',
    failed: 'Auto Analyze couldn’t write this.',
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
    pickTilesNote:
      'Each tile you pick becomes a Data block of its own, kept as its dashboard shows it now. Nothing reruns by itself.',
    askCaptureNote: 'Press Enter to ask. The answer is kept as it comes back — nothing reruns by itself.',
    orTiles: 'or pick dashboard tiles',
    askedNote: 'This is the answer as it came back when the question was asked, kept as it was.',
    rerun: 'Rerun',
    rerunning: 'Asking again…',
    rerunNote: 'Asks the question again, and keeps the new answer in place of this one.',

    analysisResult: 'Result',
    chooseResult: 'Choose a result…',
    removedResult: 'A result that was removed',
    thisResult: 'This result',
    noResults: 'Add a Data block with a result to the report first.',
    focus: 'Focus (optional)',
    focusPlaceholder: 'e.g., “Anomaly detection”',
    analyze: 'Analyze',
    analyzeAgain: 'Analyze again',
    analyzing: 'Analyzing…',
    analyzeNote: 'The same Auto Analyze an answer has. Each run uses one Auto Analyze credit.',
    analyzeAgainNote: 'Replaces the wording below. Each run uses one Auto Analyze credit.',
    cantAnalyze:
      'This result can’t be analyzed: it was kept without the query id Auto Analyze needs. Add it again to analyze it.',
    wording: 'Wording',
    wordingNote: 'Edit it as you like: it prints as written, and Analyze again replaces it.',
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
