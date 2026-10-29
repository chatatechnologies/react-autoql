// The builder's copy, carried over from the prototype. Kept in one place so it reads as one voice.

export const STRINGS = {
  untitled: 'Untitled report',
  titlePlaceholder: 'Untitled report',
  titleLabel: 'Report title',

  run: 'Run report',
  runAgain: 'Run again',
  running: 'Running…',
  cancelRun: 'Stop',
  openPreview: 'Preview',
  backToEditing: 'Back to editing',
  print: 'Print…',
  printTitle: 'Opens your browser’s print dialog. Choose “Save as PDF” to download a file.',
  printing: 'Preparing…',
  zoom: {
    label: 'Zoom',
    title: 'How large the pages show here. They always print at their true size.',
    fit: (percent) => `Fit (${percent}%)`,
    level: (percent) => `${percent}%`,
  },

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
  panelToggle: {
    label: 'Properties panel',
    hide: 'Hide the properties panel',
    show: 'Show the properties panel',
  },
  resizePanel: 'Resize the properties panel',
  resizePanelHint: 'Drag to resize. Double-click to reset.',
  close: 'Close',
  // The ⋮ at the end of the toolbar.
  reportOptions: {
    label: 'Report options',
    pageSetup: 'Page setup',
    branding: 'Branding…',
    saveAsTemplate: 'Save as template…',
    rerunAll: 'Rerun all',
  },
  // Rerun all: every question asked in the report, asked again a few at a time, and the line over the report that
  // says how it's going — or, before, how many questions have no answer yet.
  rerunAll: {
    unanswered: (n) => `${n} ${n === 1 ? 'block has' : 'blocks have'} no answer yet.`,
    action: 'Rerun all',
    running: (done, total) => `Rerunning: ${done} of ${total} done…`,
    stop: 'Stop',
    failed: (failed, total) =>
      `${failed} of ${total} ${total === 1 ? 'block' : 'blocks'} didn’t answer. Select one to see why.`,
    dismiss: 'Dismiss',
  },
  // The organisation's branding (enableBranding), as the prototype's Branding dialog has it, with what RW-332
  // asks for: a logo and a wordmark, where they sit, brand colours, and fonts.
  branding: {
    title: 'Branding',
    what: 'Applies to every report in your organisation. Stored centrally, never on one report.',
    sample: 'Top of every page, and on the cover',
    sampleBody: 'Body text is set in your body font.',
    name: 'Organisation name',
    nameRequired: 'Add your organisation’s name.',
    logo: 'Logo',
    logoNote: 'Your mark or symbol, shown before your name or wordmark.',
    wordmark: 'Wordmark',
    wordmarkNote: 'Your name set as an image, or your whole lockup. It takes the place of the name.',
    imageNote: 'A PNG, JPEG, SVG or WebP image of 256 KB or less.',
    none: 'None',
    upload: 'Upload…',
    replace: 'Replace…',
    remove: 'Remove',
    imageTooLarge: (kb) => `That image is ${kb} KB. Use one of 256 KB or less.`,
    imageWrongType: 'Use a PNG, JPEG, SVG or WebP image.',
    imageUnreadable: 'That image couldn’t be read. Try another one.',
    position: 'Position',
    positions: [
      ['left', 'Left'],
      ['center', 'Center'],
      ['right', 'Right'],
    ],
    positionNote: 'Where the logo and wordmark sit, in each page’s header and on the cover.',
    colours: 'Brand colours',
    colourLabel: (n) => `Brand colour ${n}`,
    colourPick: (n) => `Pick brand colour ${n}`,
    colourPlaceholder: '#1B4D8F or 27, 77, 143',
    addColour: 'Add a colour',
    removeColour: (n) => `Remove brand colour ${n}`,
    colourInvalid: 'Use HEX, like #1B4D8F, or RGB, like 27, 77, 143.',
    coloursNote: (max) =>
      `Up to ${max}, as HEX or RGB. They’re offered in the colour pickers for text and backgrounds.`,
    fonts: 'Fonts',
    headingFont: 'Headings',
    bodyFont: 'Body text',
    fontSample: 'Aa Bb Cc 123',
    fontNote:
      'WOFF2, WOFF, TTF or OTF files of 500 KB or less. Reports on the Theme default typeface use them, on screen and in print; charts keep AutoQL’s own type. Check that your font licence allows embedding.',
    fontTooLarge: (kb) => `That font is ${kb} KB. Use one of 500 KB or less.`,
    fontWrongType: 'Use a WOFF2, WOFF, TTF or OTF font file.',
    fontUnreadable: 'That font couldn’t be read. Try another file.',
    // A font whose file name has nothing AutoQL keeps in a name.
    fontFallbackName: 'Brand font',
    unsaved: 'Unsaved changes.',
    saved: 'Saved for your organisation.',
    saving: 'Saving…',
    saveFailed: 'Your branding wasn’t saved. Try again.',
    discard: 'Discard',
    save: 'Save branding',
  },

  // The formatting bar on top of the block whose text is being edited (RW-346).
  formatting: {
    toolbar: 'Text formatting',
    style: 'Text style',
    paragraph: 'Normal text',
    heading: 'Heading',
    subheading: 'Subheading',
    bold: 'Bold',
    italic: 'Italic',
    underline: 'Underline',
    strike: 'Strikethrough',
    bulletList: 'Bulleted list',
    orderedList: 'Numbered list',
    link: 'Link',
    clear: 'Clear formatting',
    linkAddress: 'Link address',
    linkPlaceholder: 'Paste or type a link',
    linkApply: 'Apply',
    linkRemove: 'Remove link',
    linkCancel: 'Cancel',
    linkInvalid: 'Use a web address, like example.com, or an email address.',
    hint: 'Click into a paragraph or an analysis to format it.',
  },

  // The bar shown for a while after a block is deleted, to put it back.
  blockRemoved: 'Block deleted.',
  undoRemove: 'Undo',

  emptyReportTitle: 'This report is empty',
  emptyReportBody: 'Add a block from the left. A Data block reads a dashboard tile, or asks a question of its own.',
  frontMatter: {
    both: 'Starts with a cover page and a table of contents. See them in Preview.',
    cover: 'Starts with a cover page. See it in Preview.',
    toc: 'Starts with a table of contents. See it in Preview.',
  },

  headingPlaceholder: 'Heading',
  // Under a heading while it's typed in: Return on a Mac's keyboard, Enter elsewhere.
  headingNewLine: (mac) => `Shift + ${mac ? 'Return' : 'Enter'} for a new line`,
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
    // A question asked in the report that has no answer yet, as a block of a report made from a template has.
    notAsked: 'No answer yet. Rerun asks the question.',
    noAnswer: 'No answer yet.',
    // A template's data block, and a report made from one while AutoQL fills in its data, then the blocks it
    // couldn't fill (by the report service's reason) — said with unfilledText.
    fromTemplate: 'Your data goes here when a report is started from this template.',
    filling: 'Filling in your data…',
    unfilled: {
      not_confident: 'AutoQL wasn’t sure what this question means for your data.',
      access_denied: 'You don’t have access to the data this question asks about.',
      no_data: 'This question had no data to show.',
      query_failed: 'This question didn’t run.',
      timeout: 'This question took too long to answer.',
      too_large: 'Its answer would make the report too large to save.',
      tile_unavailable: 'The dashboard tile it comes from isn’t available to you.',
      no_question: 'This block has no question to ask.',
      stale_block: 'This block changed while its data was being filled in.',
      busy: 'AutoQL was too busy to fill this in.',
      interrupted: 'Filling this in was interrupted.',
      unknown: 'This couldn’t be filled in.',
    },
    unfilledRerun: 'Rerun asks it again.',
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
    askedAs: 'Asked as',
    total: 'Total',
  },

  analysis: {
    emptyTitle: 'Nothing written yet',
    emptyBody: 'Choose a result in the panel on the right, then Analyze.',
    emptyReady: 'Analyze in the panel on the right to write about this result.',
    emptyBlocked: 'Auto Analyze can’t write about this result. Choose another in the panel on the right.',
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
    // The theme's typeface, where the organisation has fonts of its own (Branding).
    themeBrandFonts: 'Theme default (brand fonts)',
    brandSwatch: (n, hex) => `Brand colour ${n} (${hex.toUpperCase()})`,
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
    headingNote: (mac) =>
      `Click the heading on the page to edit its words. Shift + ${mac ? 'Return' : 'Enter'} starts a new line.`,
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
    notAskedNote: 'This block has its question and how to show the answer, but no answer yet.',
    rerun: 'Rerun',
    rerunning: 'Asking again…',
    rerunNote: 'Asks the question again, and shows the new answer in place of this one, set up the same way.',
    firstAskNote: 'Asks the question, and shows the answer the way this block is set up.',

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
    analyzeAgainNote: 'Replaces the wording on the page. Each run uses one Auto Analyze credit.',
    cantAnalyze:
      'This result can’t be analyzed: it was kept without the query id Auto Analyze needs. Add it again to analyze it.',
    cantAnalyzeTooLittle:
      'Auto Analyze needs more than one row to write about, so it isn’t offered for this result, as in the Query view and on dashboards.',
    // A result in the list that can't be chosen, and why.
    cantAnalyzeOption: (label, blocker) =>
      blocker === 'no-query-id' ? `${label} (kept without a query id)` : `${label} (too little to analyze)`,
    wording: 'Wording',
    wordingNote:
      'Edit the wording on the page, formatting it with the bar that appears above it. It prints as written, and Analyze again replaces it.',
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
      } listed: pivot tables, network graphs, Sankey charts and treemaps can’t be printed yet.`,

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
    axesNote: 'Click an axis title on the chart to choose which column it shows. It prints that way.',

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

// Why AutoQL couldn't fill in a Data block's answer (a view in the 'unfilled' state): the reason in plain words, with
// the query's own when it didn't run, and that Rerun asks it again where it can.
export const unfilledText = ({ reason, message, askedHere } = {}, { canRerun = false } = {}) => {
  const why = STRINGS.data.unfilled[reason] || STRINGS.data.unfilled.unknown
  const said = reason === 'query_failed' && message ? `${why} ${message}` : why
  return askedHere && canRerun ? `${said} ${STRINGS.data.unfilledRerun}` : said
}
