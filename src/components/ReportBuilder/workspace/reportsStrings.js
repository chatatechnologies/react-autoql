// The reports workspace's copy, as the wealth app had it. Kept in one place, beside the builder's, so the two
// read as one voice.

const plural = (n, one, many) => (n === 1 ? one : many)

export const REPORTS_STRINGS = {
  untitled: 'Untitled report',
  untitledDashboard: 'Untitled dashboard',
  cancel: 'Cancel',
  close: 'Close',
  tryAgain: 'Try again',
  loadingReports: 'Loading reports…',
  loadingDashboards: 'Loading dashboards…',
  noDashboards: 'You have no dashboards yet.',

  // The workspace around the open report.
  workspace: {
    opening: 'Opening report…',
    readOnly: 'This report was saved by a newer version of the app, so it can’t be changed here.',
    deletedElsewhere: (title) => `“${title}” was deleted in another tab or window.`,
    dashboardsFailed: (reason) => `Dashboards couldn’t be loaded, so only questions can be used: ${reason}`,
    noReports: 'No reports yet. Start one with New report.',
    homeLabel: 'Reports',
    justNow: 'Just now',
    minutesAgo: (n) => (n === 1 ? '1 minute ago' : `${n} minutes ago`),
  },

  // The tab strip.
  tabs: {
    label: 'Report tabs',
    home: 'All reports',
    notSaved: ', not saved',
    close: (title) => `Close ${title}`,
    closeTitle: 'Close',
    resize: 'Drag to resize · double-click to fit the whole title',
    newReport: 'New report',
  },

  // The save control in the builder's toolbar.
  saveStatus: {
    saved: 'Saved',
    savedAt: (time) => `Saved at ${time}`,
    allSaved: 'All changes are saved',
    saving: 'Saving…',
    saveNow: 'Save now (⌘S / Ctrl+S)',
    failed: 'Not saved · Try again',
    tryAgain: 'Try saving again (⌘S / Ctrl+S)',
    conflict: 'Changed elsewhere · Reload',
    reload: 'Open the latest saved version',
  },

  // Saving, and what went wrong.
  save: {
    conflict:
      'This report was changed in another tab or window. Reload to see the latest version — changes made here since then won’t be kept.',
    retrying: 'Trying again shortly.',
  },
  errors: {
    lead: {
      load: 'Reports couldn’t be loaded',
      loadSome: 'Some reports couldn’t be listed',
      open: 'This report couldn’t be opened',
      save: 'This change isn’t saved yet',
      add: 'Nothing was added',
      delete: 'The report wasn’t deleted',
      organizers: 'Folders and tags couldn’t be loaded',
      folder: 'The folder wasn’t saved',
      deleteFolder: 'The folder wasn’t deleted',
      tag: 'The tag wasn’t saved',
      deleteTag: 'The tag wasn’t deleted',
      organize: 'Nothing was changed',
    },
    signedOut: 'you’re signed out',
    notFound: 'the report no longer exists (it may have been deleted in another tab)',
    noDataSource: 'this data source is no longer available',
    tooLarge: 'the report is too large (over 5 MB) — remove a block, or show fewer rows',
    titleTooLong: (max) => `report titles can be up to ${max} characters`,
    otherDataSource: 'the report belongs to another data source',
    unreachable: 'couldn’t reach the server',
    serverFailed: 'the server had a problem',
    refused: 'the server didn’t accept it',
    keptChanging: 'blocks kept being added to it in another tab or window while it saved',
    folderGone: 'the folder no longer exists (it may have been deleted in another tab)',
    tagGone: 'the tag no longer exists (it may have been deleted in another tab)',
    folderNameTaken: 'there’s already a folder with that name',
    tagNameTaken: 'there’s already a tag with that name',
    nameInvalid: 'a name can be 1 to 80 characters',
    tooManyTags: 'a report can carry up to 20 tags',
    organizerLimit: 'that’s over the limit of 100 folders and 100 tags',
    reportLimit: 'that’s over the limit of 1,000 reports',
    tooManyReports: 'up to 200 reports can be changed at once',
  },

  // New report, from the tab strip: a question, a dashboard, or a blank page.
  newReport: {
    title: 'New report',
    what: 'Start from a question, a dashboard, or a blank page.',
    whatWithoutDashboards: 'Start from a question or a blank page.',
    startFrom: 'Start from',
    question: 'Start from a question',
    questionLabel: 'Question',
    questionPlaceholder: 'Type a query in your own words',
    questionNote: 'Asked once, and kept as it answers. Rerun asks it again.',
    dashboard: 'Start from a dashboard',
    dashboardLabel: 'Dashboard',
    dashboardOption: (name, tiles) => `${name} · ${tiles} ${plural(tiles, 'tile', 'tiles')}`,
    blank: 'Blank page',
    asking: 'Asking…',
    chooseTiles: 'Choose tiles…',
    create: 'Create report',
    failed: {
      error: 'That question didn’t run.',
      'no-data': 'That question came back with no data to show.',
      unsupported: 'That answer can’t be kept in a report yet.',
    },
  },

  // Dashboard tiles into a report: an empty Data block's "Pick dashboard tiles…", or New report from a dashboard.
  tilePicker: {
    titleAdd: 'Add dashboard tiles',
    titleStart: 'Start from a dashboard',
    whatAdd: 'Tick the tiles to add. Each is added as it looks here, and stays that way.',
    whatStart:
      'Every tile is ticked as it loads — untick any you don’t want. Each comes in as it looks here, and stays that way.',
    dashboard: 'Dashboard',
    tiles: 'Tiles',
    noTiles: 'This dashboard has no tiles.',
    untitledTile: 'Untitled',
    noQuestion: 'No question',
    unsupported: 'Pivot tables, network graphs, Sankey charts and treemaps can’t be added yet',
    noData: 'No data to add',
    loading: 'Loading…',
    stillLoading: (n) => (n === 1 ? '1 tile is still loading.' : `${n} tiles are still loading.`),
    tileFailed: (title, message) => `“${title}”: ${message}`,
    tooLarge: (megabytes) =>
      `With these tiles the report would be ${megabytes} MB — more than a report can hold (5 MB). Tick fewer tiles, or show long charts as tables first.`,
    add: (n) => (n === 0 ? 'Add tiles' : n === 1 ? 'Add 1 tile' : `Add ${n} tiles`),
  },

  // An answer or a tile kept as a block ("Add to Report…").
  capture: {
    tooLarge: (rows, max) =>
      `This chart draws ${rows} rows — more than a report keeps (${max}). Narrow the question, or show it as a table first.`,
    tooManyRows: 'too many',
    unsupported:
      'This kind of answer can’t be added to a report yet (pivot tables, network graphs, Sankey charts and treemaps).',
    noData: 'This answer has no data to add.',
    loading: 'This tile hasn’t finished loading.',
    notFound: 'This tile isn’t on the dashboard any more.',
    thisTile: 'This tile',
    thisAnswer: 'This answer',
    quoted: (query) => `“${query}”`,
  },

  // "Add to Report…", from an answer's or a dashboard tile's More menu.
  addToReport: {
    title: 'Add to Report',
    what: (block) =>
      `${block} is added at the end of the report, as it looks now — its data, sorting and chart. It stays as it is when the data changes.`,
    chooseReport: 'Choose a report',
    edited: (date) => `Edited ${date}`,
    newReport: 'Create new report',
    newName: 'Report name',
    newNamePlaceholder: 'e.g. Q3 book of business',
    noDataSource: 'Reports can’t be used until a data source is selected.',
    adding: 'Adding…',
    add: 'Add to report',
  },
}
