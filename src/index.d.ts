import * as React from 'react'
import type { Authentication } from 'autoql-fe-utils'

export * from 'autoql-fe-utils'

export type BillingQuotaStatus = 'no_quota' | 'under_quota' | 'at_or_over_quota'

export type BillingCustomerKeyState = 'idle' | 'loading' | 'success' | 'missing_customer' | 'error'

export type BillingUsageState = 'idle' | 'loading' | 'success' | 'missing_customer' | 'unavailable' | 'error'

export type BillingHistoryState = 'idle' | 'loading' | 'success' | 'unavailable' | 'error'

export interface BillingCustomerScope {
  scope_type?: string
  scope_id?: string
}

export type BillingExecutionType = 'STRIPE' | 'EXPORT'

export interface BillingCustomerKeyResponse {
  billing_customer_key: string
  scope?: BillingCustomerScope | null
  billing_execution_type?: BillingExecutionType
}

export interface BillingCurrentUsage {
  integrator_id: number
  billing_customer_key: string
  billing_period: string
  usage_to_date_micros: number
  free_allowance_micros: number
  allowance_applied_to_date_micros: number
  allowance_remaining_micros: number
  estimated_billable_usage_micros: number
  active_monthly_quota_micros: number | null
  pending_monthly_quota_micros: number | null
  pending_effective_billing_period: string | null
  remaining_quota_micros: number | null
  quota_status: BillingQuotaStatus
}

export interface BillingHistoryItem {
  billing_period: string
  usage_to_date_micros: number
  quota_projection_label: 'current_quota_projection'
  current_quota_projection_monthly_micros?: number | null
  current_quota_projection_status: BillingQuotaStatus
}

export interface BillingQuotaUpdateResponse {
  integrator_id: number
  billing_customer_key: string
  currency: string
  active_monthly_quota_micros: number | null
  active_effective_billing_period: string | null
  pending_monthly_quota_micros: number | null
  pending_effective_billing_period: string | null
  current_billing_period: string
  current_period_usage_micros: number
  upsert_result: 'created' | 'updated' | 'noop'
  effective_update_mode: 'immediate' | 'scheduled' | 'none'
  updated_by?: string | null
  updated_by_type?: string | null
}

export interface UseBillingCustomerKeyArgs {
  authentication: Authentication
}

export interface UseBillingCustomerKeyResult {
  billingCustomerKey: string | null
  data: BillingCustomerKeyResponse | null
  scope: BillingCustomerScope | null
  state: BillingCustomerKeyState
}

export interface UseBillingUsageArgs {
  authentication: Authentication
  billingCustomerKey?: string | null
  refreshKey?: number
}

export interface UseBillingUsageResult {
  data: BillingCurrentUsage | null
  state: BillingUsageState
}

export interface UseBillingHistoryArgs {
  authentication: Authentication
  billingCustomerKey?: string | null
  from?: string
  to?: string
}

export interface UseBillingHistoryResult {
  items: BillingHistoryItem[]
  state: BillingHistoryState
}

export interface UseBillingQuotaUpdateArgs {
  authentication: Authentication
  billingCustomerKey?: string | null
}

export interface UseBillingQuotaUpdateResult {
  isSaving: boolean
  updateQuota: (monthlyQuotaMicros: number) => Promise<BillingQuotaUpdateResponse>
}

export declare function useBillingCustomerKey(args: UseBillingCustomerKeyArgs): UseBillingCustomerKeyResult
export declare function useBillingUsage(args: UseBillingUsageArgs): UseBillingUsageResult
export declare function useBillingHistory(args: UseBillingHistoryArgs): UseBillingHistoryResult
export declare function useBillingQuotaUpdate(args: UseBillingQuotaUpdateArgs): UseBillingQuotaUpdateResult

export type MagicWandBillingGateState = 'over_quota' | 'unavailable' | null

export interface UseMagicWandBillingGateArgs {
  authentication?: Authentication
  enabled?: boolean
}

export interface UseMagicWandBillingGateResult {
  quotaStatus?: BillingQuotaStatus
  billingExecutionType?: BillingExecutionType
}

export declare function useMagicWandBillingGate(
  args?: UseMagicWandBillingGateArgs,
): UseMagicWandBillingGateResult

export declare function getMagicWandBillingErrorState(error: any): MagicWandBillingGateState

export declare const MAGIC_WAND_BILLING_GATE_MESSAGES: {
  over_quota: string
  over_quota_summary: string
  unavailable: string
}

// Broadcasts to every mounted useMagicWandBillingGate instance that billing usage may have
// changed (e.g. call this after a quota-increase flow completes) so proactive blocking clears
// without waiting for a remount.
export declare function refreshBillingUsage(): void

export declare function formatMicrosAsCurrency(
  micros?: number | null,
  emptyLabel?: string,
  currency?: string,
  locale?: string,
): string
export declare function microsFromCurrencyInput(value: string): number | null
export declare function currencyInputFromMicros(micros?: number | null, currency?: string): string
export declare function formatBillingPeriod(period?: string | null): string
export declare function getDefaultBillingHistoryRange(): { from: string; to: string }

export declare function getStoredBillingCustomerKey(apiKey?: string): string | null
export declare function setStoredBillingCustomerKey(billingCustomerKey: string, apiKey?: string): void
export declare function clearStoredBillingCustomerKey(apiKey?: string): void

// ─── Shared config interfaces ────────────────────────────────────────────────

export interface AutoQLConfig {
  translation?: string
  test?: boolean
  enableAutocomplete?: boolean
  enableQueryValidation?: boolean
  enableDrilldowns?: boolean
  enableQuerySuggestions?: boolean
  enableColumnVisibilityManager?: boolean
  enableNotifications?: boolean
  projectId?: string
  enableProjectSelect?: boolean
  enableEditReverseTranslation?: boolean
}

export interface DataFormatting {
  currencyCode?: string
  languageCode?: string
  currencyDecimals?: number
  quantityDecimals?: number
  ratioDecimals?: number
  comparisonDisplay?: string
  monthYearFormat?: string
  dayMonthYearFormat?: string
}

// ─── Dashboard ───────────────────────────────────────────────────────────────

export interface DashboardTile {
  key?: string
  i?: string | number
  query?: string
  secondQuery?: string
  title?: string
  displayType?: string
  w?: number
  h?: number
  x?: number
  y?: number
  queryResponse?: any
  dataConfig?: any
  aggConfig?: any
  projectId?: string | number
  [key: string]: any
}

export interface DashboardProps {
  authentication?: Authentication
  autoQLConfig?: AutoQLConfig
  dataFormatting?: DataFormatting
  tiles?: DashboardTile[]
  isEditing?: boolean
  isEditable?: boolean
  executeOnMount?: boolean
  executeOnStopEditing?: boolean
  dataPageSize?: number
  notExecutedText?: string | React.ReactElement
  onChange?: (tiles: DashboardTile[], slicers?: any[]) => void
  onErrorCallback?: (error: any) => void
  onSuccessCallback?: (response: any) => void
  autoChartAggregations?: boolean
  enableDynamicCharting?: boolean
  disableAggregationMenu?: boolean
  allowCustomColumnsOnDrilldown?: boolean
  onCSVDownloadStart?: () => void
  onCSVDownloadProgress?: (progress: number) => void
  onCSVDownloadFinish?: () => void
  onPNGDownloadFinish?: () => void
  cancelQueriesOnUnmount?: boolean
  startEditingCallback?: () => void
  stopEditingCallback?: () => void
  onSaveCallback?: () => void
  onDeleteCallback?: () => void
  showToolbar?: boolean
  refreshInterval?: number
  dashboardId?: string
  enableAutoRefresh?: boolean
  enableSlicers?: boolean
  initialSlicers?: Array<{ type: string; data: any }>
  slicerSuggestion?: string
  enableCyclicalDates?: boolean
  enableMagicWand?: boolean
  showMagicWandQuoteButton?: boolean
  enableBillingGate?: boolean
  onQuotaExceeded?: () => void
  enableCustomColumns?: boolean
  preferRegularTableInitialDisplayType?: boolean
  source?: string | string[]
  scope?: string
  offline?: boolean
  projectSelectList?: Array<{ projectId: string | number; displayName: string }>
  getAuthenticationForProject?: (projectId: string | number) => Authentication | undefined
  onTileAuthExpired?: (projectId: string | number) => void
  showProjectIndicator?: boolean
  isProjectDashboard?: boolean
  [key: string]: any
}

export declare class Dashboard extends React.Component<DashboardProps> {
  // What the chosen tiles show now, for a report: each tile captured as "Add to Report…" captures it
  // (QueryOutput.captureForReport). Without tileKeys, every tile in reading order.
  captureTilesForReport(options?: {
    tileKeys?: Array<string | number>
    maxTableRows?: number
    maxChartRows?: number
  }): DashboardTileCapture[]
}

// One tile's capture from Dashboard.captureTilesForReport. `result` is { ok: false, reason: 'loading' }
// while the tile has no finished answer on screen, and 'not-found' for a key the dashboard has no tile for.
export interface DashboardTileCapture {
  tileKey: string | number
  dashboardId?: string
  title: string
  query: string
  displayType?: string
  result: ReportCaptureResult | { ok: false; reason: 'loading' | 'not-found' }
}

// ─── DataMessenger ───────────────────────────────────────────────────────────

export interface DataMessengerProps {
  authentication?: Authentication
  autoQLConfig?: AutoQLConfig
  dataFormatting?: DataFormatting
  placement?: 'left' | 'right' | 'top' | 'bottom'
  maskClosable?: boolean
  width?: string | number
  height?: string | number
  showHandle?: boolean
  handleImage?: string
  handleStyles?: React.CSSProperties
  shiftScreen?: boolean
  userDisplayName?: string
  clearOnClose?: boolean
  enableVoiceRecord?: boolean
  title?: string
  maxMessages?: number
  emptyStateTitle?: React.ReactNode
  emptyStateSubtitle?: React.ReactNode
  enableExploreQueriesTab?: boolean
  enableNotificationsTab?: boolean
  resizable?: boolean
  inputPlaceholder?: string
  enableDPRTab?: boolean
  dataPageSize?: number
  notificationCount?: number
  defaultOpen?: boolean
  popoverParentElement?: React.ReactElement
  enableDynamicCharting?: boolean
  defaultTab?: string
  autoChartAggregations?: boolean
  enableFilterLocking?: boolean
  enableQueryQuickStartTopics?: boolean
  enableQueryInputTopics?: boolean
  enableQuerySuggestions?: boolean
  disableColumnSelectionForDataExplorer?: boolean
  enableMagicWand?: boolean
  showMagicWandQuoteButton?: boolean
  enableBillingGate?: boolean
  onQuotaExceeded?: () => void
  enableCyclicalDates?: boolean
  projectSelectList?: Array<{ projectId: string; displayName: string }>
  selectedProjectId?: string
  onNotificationExpandCallback?: (notification: any) => void
  onNewNotification?: (notification: any) => void
  onNotificationCount?: (count: number) => void
  onVisibleChange?: (visible: boolean) => void
  onErrorCallback?: (error: any) => void
  onSuccessAlert?: (message: string) => void
  onProjectSelectChange?: (projectId: string) => void
  source?: string | string[]
  [key: string]: any
}

export declare class DataMessenger extends React.Component<DataMessengerProps> {}

// ─── QueryOutput ─────────────────────────────────────────────────────────────

export interface QueryOutputProps {
  authentication?: Authentication
  autoQLConfig?: AutoQLConfig
  dataFormatting?: DataFormatting
  queryResponse?: any
  initialDisplayType?: string
  initialTableConfigs?: {
    tableConfig?: any
    pivotTableConfig?: any
    columnOverrides?: Record<string, any>
  }
  initialAggConfig?: Record<string, any>
  isResizing?: boolean
  shouldRender?: boolean
  enableDynamicCharting?: boolean
  autoChartAggregations?: boolean
  autoSelectQueryValidationSuggestion?: boolean
  queryValidationSelections?: any[]
  renderSuggestionsAsDropdown?: boolean
  defaultSelectedSuggestion?: string
  reverseTranslationPlacement?: string
  reverseTranslationCompact?: boolean
  allowDisplayTypeChange?: boolean
  allowColumnAddition?: boolean
  enableTableSorting?: boolean
  useInfiniteScroll?: boolean
  showQueryInterpretation?: boolean
  mutable?: boolean
  height?: string | number
  width?: string | number
  autoHeight?: boolean
  source?: string | string[]
  scope?: string
  tooltipID?: string
  chartTooltipID?: string
  onTableConfigChange?: (config: any) => void
  onAggConfigChange?: (config: any) => void
  onColumnChange?: (...args: any[]) => void
  onDisplayTypeChange?: (displayType: string) => void
  onSuggestionClick?: (params: any) => void
  onNoneOfTheseClick?: () => void
  onDrilldownStart?: (params: any) => void
  onDrilldownEnd?: () => void
  onErrorCallback?: (error: any) => void
  [key: string]: any
}

export declare class QueryOutput extends React.Component<QueryOutputProps> {
  // What the answer shows now, as plain JSON, for a report to keep (a report's Data block `capture`).
  captureForReport(options?: { maxTableRows?: number; maxChartRows?: number }): ReportCaptureResult
  changeDisplayType(displayType: string): void
  getCurrentSupportedDisplayTypes(): string[]
  readonly state: { displayType: string; [key: string]: any }
  readonly _isMounted: boolean
}

// ─── QueryInput ──────────────────────────────────────────────────────────────

export interface QueryInputProps {
  authentication?: Authentication
  autoQLConfig?: AutoQLConfig
  dataFormatting?: DataFormatting
  onSubmit?: (query: string) => void
  onResponseCallback?: (response: any) => void
  placeholder?: string
  inputValue?: string
  clearQueryOnSubmit?: boolean
  enableVoiceRecord?: boolean
  isDisabled?: boolean
  enableQuerySuggestions?: boolean
  enableQueryInputTopics?: boolean
  dataPageSize?: number
  shouldRender?: boolean
  source?: string | string[]
  [key: string]: any
}

export declare class QueryInput extends React.Component<QueryInputProps> {}

// ─── DataExplorer ────────────────────────────────────────────────────────────

export interface DataExplorerProps {
  authentication?: Authentication
  autoQLConfig?: AutoQLConfig
  dataFormatting?: DataFormatting
  inputPlaceholder?: string
  introMessage?: string | React.ReactElement
  enableQuerySuggestions?: boolean
  disableColumnSelection?: boolean
  source?: string | string[]
  [key: string]: any
}

export declare class DataExplorer extends React.Component<DataExplorerProps> {}

// ─── ReportBuilder ───────────────────────────────────────────────────────────

// A report is a template: plain, versioned JSON that says what to show, never the data itself. The
// builder keeps blocks and fields it doesn't know (from a newer version) through a save.

export type ReportBlockWidth = 'full' | 'half'
export type ReportHeadingLevel = 1 | 2 | 3
export type ReportTableRows = 10 | 25 | 50 | 100
export type ReportTypeface = 'theme' | 'archivo' | 'newsreader' | 'plex-mono'

export interface ReportTextStyle {
  font?: Exclude<ReportTypeface, 'theme'>
  size?: 'small' | 'normal' | 'large' | 'xlarge' | 'huge'
  weight?: 'regular' | 'medium' | 'semibold' | 'bold'
  color?: string
  background?: string
  align?: 'center' | 'right'
}

export interface ReportHeadingBlock {
  id: string
  type: 'heading'
  text: string
  level: ReportHeadingLevel
  width?: ReportBlockWidth
  style?: ReportTextStyle
}

export interface ReportTextBlock {
  id: string
  type: 'text'
  text: string
  width?: ReportBlockWidth
  style?: ReportTextStyle
}

export interface ReportTileSource {
  type: 'tile'
  dashboardId: string
  tileKey: string
  // Labels for when the tile can't be found; never executed.
  snapshot?: { dashboardName?: string; tileTitle?: string; query?: string; displayType?: string }
}

export interface ReportQuestionSource {
  type: 'query'
  query: string
}

// What an answer showed when it was added to a report ("Add to Report…"): its data and the settings that
// shaped it, shaped like a dashboard tile's saved view. Made by QueryOutput.captureForReport.
export interface ReportCapture {
  version: number
  capturedAt: string
  displayType: string
  data: {
    columns: Array<Record<string, any>>
    rows: any[][]
    count_rows: number
    text?: string
    query_id?: string
    interpretation?: string
    parsed_interpretation?: any
  }
  // Tables only: the columns shown, in display order (indices into `columns`), the sort shown, and the
  // header filters as typed (optional: older captures have none).
  table?: {
    columnIndices?: number[]
    sort: Array<{ name: string; sort: string }>
    filters?: Array<{ name: string; value: string }>
    filtered: boolean
  }
  config: Record<string, any>
}

export type ReportCaptureResult =
  | { ok: true; capture: ReportCapture }
  | { ok: false; reason: 'no-data' | 'unsupported' | 'too-large'; rowCount?: number }

export interface ReportDataBlock {
  id: string
  type: 'data'
  source: ReportTileSource | ReportQuestionSource | null
  // Table rows to print; a chart shows its tile as the dashboard does.
  rows: ReportTableRows
  width?: ReportBlockWidth
  // What the block shows until a run replaces it (always, while enableRunReport is off).
  capture?: ReportCapture
  // How it's shown, when not as captured: 'table' or a chart type its data supports ('bar', 'line', …).
  // Chosen in the properties panel; a choice the data can't be drawn as is ignored.
  displayType?: string
  // A question asked in the builder (enableDataBlocks), which its Rerun button can ask again.
  askedHere?: boolean
  // Its chart's axes and aggregation, when chosen in the builder with the chart's own axis selectors: what
  // QueryOutput reports (onTableConfigChange, onAggConfigChange). Kept across Rerun; set right when drawn if the
  // data no longer fits.
  dataConfig?: {
    tableConfig?: Record<string, unknown>
    pivotTableConfig?: Record<string, unknown>
    columnOverrides?: Record<string, unknown>
  }
  aggConfig?: Record<string, string>
}

export interface ReportPageBreakBlock {
  id: string
  type: 'pagebreak'
}

// Auto Analyze's wording about one Data block (`target`), as written — Markdown — and edited since.
export interface ReportAnalysisBlock {
  id: string
  type: 'analysis'
  target: string | null
  // Asked for next time it's written (Analyze again).
  focus?: string
  text: string
  width?: ReportBlockWidth
  style?: ReportTextStyle
  // What it was written from: when, the target's capturedAt then, its title, the focus used, the rows read.
  writtenAt?: string
  targetAsOf?: string
  targetTitle?: string
  focusUsed?: string
  rowsAnalyzed?: number
}

export type ReportBlock =
  | ReportHeadingBlock
  | ReportTextBlock
  | ReportDataBlock
  | ReportAnalysisBlock
  | ReportPageBreakBlock

// Paper is always US Letter.
export interface ReportPageSetup {
  orientation: 'portrait' | 'landscape'
  margins: 'narrow' | 'normal' | 'wide'
  typeface: ReportTypeface
  header: boolean
  footer: boolean
  pageNumbers: boolean
  repeatTableHeaders: boolean
  showInterpretation: boolean
  coverPage: boolean
  tableOfContents: boolean
}

export interface Report {
  schemaVersion: number
  title: string
  page: ReportPageSetup
  blocks: ReportBlock[]
}

export interface ReportDashboard {
  id: string | number
  name?: string
  // 'PROJECT' for a dashboard the whole project shares, as AutoQL lists it.
  type?: string
  tiles?: DashboardTile[]
  slicers?: Array<{ type?: string; data: any }>
}

// A font the organisation uploaded: its name as shown, and the file as a data: URL.
export interface ReportBrandFont {
  name?: string
  url: string
}

export interface ReportBranding {
  name?: string
  // The organisation's mark (it takes the place of the initials badge) and its name set as an image (it takes
  // the place of the name); URLs, or data: URLs as uploaded.
  logoUrl?: string
  wordmarkUrl?: string
  // Where the logo and wordmark sit, in each page's header and on the cover. Left by default.
  position?: 'left' | 'center' | 'right'
  // Brand colours, '#rrggbb', up to 6: offered in the colour pickers; the first fills the initials badge.
  colors?: string[]
  // The initials badge's colour where there are no brand colours.
  color?: string
  // Set in by reports on the theme's typeface, on screen and in print.
  headingFont?: ReportBrandFont
  bodyFont?: ReportBrandFont
}

export interface ReportRunSummary {
  status: 'success' | 'partial' | 'error' | 'cancelled'
  // One timestamp for the whole run (ISO 8601).
  runAt: string
  blocks: Array<{
    blockId: string
    status: 'success' | 'error' | 'cancelled' | 'skipped'
    rowCount?: number
    countRows?: number | null
    error?: { message: string; referenceId?: string }
  }>
}

export interface ReportBuilderProps {
  authentication?: Authentication
  autoQLConfig?: AutoQLConfig
  dataFormatting?: DataFormatting
  // Fetched by the host; data blocks read their tiles from these.
  dashboards?: ReportDashboard[]
  // Controlled: the builder stores nothing itself.
  report?: Report
  onChange?: (report: Report) => void
  // The branding the pages are drawn with. With enableBranding, what the organisation set in AutoQL wins and this
  // fills in the rest (the organisation's name, say).
  branding?: ReportBranding
  // The organisation's branding is kept by AutoQL (/autoql/api/v1/reports/branding): the builder loads it and
  // draws it over `branding`. Off by default.
  enableBranding?: boolean
  // With enableBranding: adds "Branding…" to the report options menu (⋮) once AutoQL has answered, to change the
  // organisation's branding. Saving takes AutoQL's organisation-admin grant, so say who may.
  canEditBranding?: boolean
  onRunComplete?: (summary: ReportRunSummary) => void
  onErrorCallback?: (error: any) => void
  getAuthenticationForProject?: (projectId: string | number) => Authentication | undefined
  // A stylesheet that loads the typefaces the report can use. None is loaded by default.
  fontStylesheetUrl?: string | null
  // Run report: the builder fetches every data block itself. Off by default: blocks show what was
  // captured when they were added, and runReport() resolves null.
  enableRunReport?: boolean
  // Data blocks can be made in the builder, not only arrive with "Add to Report…". Off by default.
  enableDataBlocks?: boolean
  // With enableDataBlocks: an empty Data block offers "Pick dashboard tiles…", which calls this. Show your own
  // picker and resolve with the blocks to put in the empty block's place, in order, or null to leave it.
  pickDashboardTiles?: () => Promise<ReportBlock[] | null | undefined> | ReportBlock[] | null | undefined
  // Analysis blocks can be made and written: Auto Analyze's wording about one result, one Auto Analyze credit
  // per run. Off by default; analyses already in a report always show and print.
  enableAnalysis?: boolean
  // Adds "New report · Get started…" to the palette, which calls this. The host starts the report.
  onGetStarted?: () => void
  // Your own element for the toolbar, shown just before Preview (and in the preview): whether the report is
  // saved, say. None by default.
  toolbarStatus?: React.ReactNode
  className?: string
}

export declare class ReportBuilder extends React.Component<ReportBuilderProps> {
  // Runs every data block as one run with one timestamp; null if superseded, or if enableRunReport is off.
  runReport(): Promise<ReportRunSummary | null>
  openPrintPreview(): Promise<void>
  closePrintPreview(): Promise<void>
  // Waits for the preview's pages and charts, then opens the browser's print dialog; true once it has.
  print(): Promise<boolean>
}

export declare const REPORT_SCHEMA_VERSION: number
export declare function createEmptyReport(
  overrides?: Partial<Omit<Report, 'page'>> & { page?: Partial<ReportPageSetup> },
): Report

// A question asked once, its answer kept as a Data block's capture (shown the way AutoQL shows it by default),
// with the table rows the block should print. Never rejects.
export type CaptureQuestionResult =
  | { ok: true; capture: ReportCapture; rows: ReportTableRows }
  | {
      ok: false
      reason: 'cancelled' | 'error' | 'no-data' | 'unsupported'
      // For 'error': why the question didn't run or didn't answer with data.
      error?: { message: string; referenceId?: string }
    }

export declare function captureQuestion(options: {
  query: string
  authentication?: Authentication
  autoQLConfig?: AutoQLConfig
  // Stops the request; the result is then { ok: false, reason: 'cancelled' }.
  signal?: AbortSignal
  cancelToken?: any
}): Promise<CaptureQuestionResult>

// How many table rows a new block for this capture prints: all of a table that 10, 25, 50 or 100 holds,
// else 25.
export declare function rowsForCapture(capture: ReportCapture | null | undefined): ReportTableRows

// ─── Reports, kept by AutoQL ─────────────────────────────────────────────────
// A user's own reports on the token's data source, through AutoQL's report service
// (/autoql/api/v1/reports), with their folders and tags.

// The service's message ids (the number its reference_id ends with) by name.
export declare const REPORT_ERROR_CODES: Record<number, string>

export declare class ReportsApiError extends Error {
  // 0 when the service couldn't be reached.
  status: number
  // The message id's name, e.g. 'REPORT_VERSION_CONFLICT', when the service sent one.
  code?: string
  messageId?: number
  referenceId?: string
  // The answer's data in camelCase: { version, updatedAt } on a version conflict, { reason } on an invalid
  // report or block, { id } of the folder or tag that holds a name.
  details?: Record<string, any>
}

export interface StoredReportSummary {
  id: string
  title: string
  sizeBytes: number
  version: number
  folderId: string | null
  tagIds: string[]
  createdAt: string
  updatedAt: string
}

export interface StoredReport extends StoredReportSummary {
  projectId: string
  report: Report
}

export interface StoredReportStamp {
  id: string
  version: number
  updatedAt: string
}

export interface ReportFolder {
  id: string
  name: string
  reportCount: number
  createdAt: string
  updatedAt: string
}

export interface ReportTag extends ReportFolder {
  color: string
}

export interface ReportPlacement {
  id: string
  folderId: string | null
  tagIds: string[]
}

interface ReportsCall {
  authentication: Authentication
}

export declare function fetchReports(
  options: ReportsCall & {
    page?: number
    pageSize?: number
    q?: string
    folderId?: string
    tagIds?: string[]
    orderBy?: 'updated_at' | 'created_at' | 'title'
    order?: 'asc' | 'desc'
    signal?: AbortSignal
  },
): Promise<{ reports: StoredReportSummary[]; page: number; pageSize: number; totalPages: number; totalItems: number }>
export declare function fetchReport(options: ReportsCall & { id: string; signal?: AbortSignal }): Promise<StoredReport>
export declare function createReport(
  options: ReportsCall & { id: string; report: Report; folderId?: string; tagIds?: string[]; keepalive?: boolean },
): Promise<StoredReport & { created: boolean }>
export declare function saveReport(
  options: ReportsCall & { id: string; report: Report; version: number; keepalive?: boolean },
): Promise<StoredReportStamp>
export declare function deleteReport(options: ReportsCall & { id: string }): Promise<void>
export declare function deleteReports(
  options: ReportsCall & { ids: string[] },
): Promise<{ deleted: string[]; notFound: string[] }>
export declare function appendReportBlock(
  options: ReportsCall & { id: string; block: ReportBlock },
): Promise<StoredReportStamp & { appended: boolean }>
export declare function organizeReports(
  options: ReportsCall & {
    reportIds: string[]
    // null unfiles; leaving it out leaves the reports' folders as they are.
    folderId?: string | null
    addTagIds?: string[]
    removeTagIds?: string[]
  },
): Promise<ReportPlacement[]>

export declare function fetchReportFolders(options: ReportsCall & { signal?: AbortSignal }): Promise<ReportFolder[]>
export declare function createReportFolder(
  options: ReportsCall & { id: string; name: string },
): Promise<ReportFolder & { created: boolean }>
export declare function renameReportFolder(options: ReportsCall & { id: string; name: string }): Promise<ReportFolder>
export declare function deleteReportFolder(options: ReportsCall & { id: string }): Promise<void>

export declare function fetchReportTags(options: ReportsCall & { signal?: AbortSignal }): Promise<ReportTag[]>
export declare function createReportTag(
  options: ReportsCall & { id: string; name: string; color: string },
): Promise<ReportTag & { created: boolean }>
export declare function updateReportTag(
  options: ReportsCall & { id: string; name?: string; color?: string },
): Promise<ReportTag>
export declare function deleteReportTag(options: ReportsCall & { id: string }): Promise<void>

// ─── Reports workspace ───────────────────────────────────────────────────────
// A user's reports on the token's data source, each open in a tab with its own ReportBuilder and saved to AutoQL
// as it's edited: the tab strip, New report (from a question, a dashboard or a blank page), autosave with its
// save control, and the dashboard-tiles picker. The host draws the home page.

export interface ReportsNotice {
  tone: 'error' | 'info'
  text: string
}

// What renderHome draws the home page from.
export interface ReportsHomeProps {
  // The user's reports on the data source, most recently saved first; null while they load.
  reports: StoredReportSummary[] | null
  // Why they couldn't be listed.
  listError: string | null
  retryList: () => void
  // Shows the report in its tab (opening one if it isn't open).
  openReport: (id: string) => void
  // Deletes the report for good (ask first); its tab closes. Resolves with whether it was deleted — why not is in
  // notices.
  deleteReport: (id: string) => Promise<boolean>
  // Deletes several, one after another as deleteReport does each. Resolves with whether every one was deleted.
  deleteReports: (ids: string[]) => Promise<boolean>
  deletingId: string | null
  // What happened meanwhile: a report deleted in another tab, a delete that failed.
  notices: ReportsNotice[]
  // Opens New report.
  newReport: () => void

  // The user's folders and tags on the data source, A to Z; null while they load. Each report in `reports` says its
  // folder (folderId, null for none) and its tags (tagIds).
  folders: ReportFolder[] | null
  tags: ReportTag[] | null
  // Why they couldn't be loaded.
  organizersError: string | null
  retryOrganizers: () => void
  // The changes below resolve once AutoQL has them, the lists following, and reject with an Error whose message is
  // the line to show (`code` and `status` are the service's).
  // A new folder or tag, or the one with that name already, whatever its case. Names are 1 to 80 characters.
  createFolder: (name: string) => Promise<ReportFolder>
  renameFolder: (id: string, name: string) => Promise<ReportFolder>
  // Its reports become unfiled; none is deleted.
  deleteFolder: (id: string) => Promise<void>
  // `color` is a short key the host picks (`blue`, `amber`…), kept as it's sent.
  createTag: (name: string, color: string) => Promise<ReportTag>
  updateTag: (id: string, change: { name?: string; color?: string }) => Promise<ReportTag>
  // Taken off every report that had it; none is deleted.
  deleteTag: (id: string) => Promise<void>
  // Files reports in a folder (null: none; left out: as they are) and adds or takes off tags, all at once or not at
  // all. Resolves with where each report now is.
  organizeReports: (change: {
    reportIds: string[]
    folderId?: string | null
    addTagIds?: string[]
    removeTagIds?: string[]
  }) => Promise<ReportPlacement[]>
}

export interface ReportsProps {
  authentication?: Authentication
  autoQLConfig?: AutoQLConfig
  dataFormatting?: DataFormatting
  // Which data source the reports are on. The token's project by default.
  dataSourceId?: string | number
  // The dashboards a report can take tiles from (New report from a dashboard, an empty Data block's "Pick
  // dashboard tiles…"). Null while they load; leave it out where there are none. Tiles may carry their answers.
  dashboards?: ReportDashboard[] | null
  // Why the dashboards couldn't be loaded, said over the open report.
  dashboardsError?: string | null
  // A dashboard's tiles as the tiles picker answered them, for a host that keeps answers between views.
  onDashboardTilesChange?: (dashboardId: string, tiles: DashboardTile[]) => void
  // The report shown (null: the home page), for a host that keeps it in its address: when it changes, that report
  // shows (once the list is in, and if it's there). onShowReport hears every change made in the workspace.
  shownReportId?: string | null
  onShowReport?: (id: string | null) => void
  // Draws the home page. A plain list of the reports by default.
  renderHome?: (home: ReportsHomeProps) => React.ReactNode
  // Where the open tabs are remembered in this browser (localStorage keys start with it); null remembers nothing.
  // 'react-autoql.' by default.
  storageKeyPrefix?: string | null
  // AutoQL turned the token away (401): pass in a new authentication, and what failed is tried again with it.
  onUnauthorized?: () => void
  // How long a pause in editing is before a report saves (ms). 2000 by default.
  saveDelay?: number
  // The folder New report makes reports in, while it's one of the user's: the one the host's home page shows, say.
  newReportFolderId?: string | null
  // Passed on to each report's ReportBuilder.
  branding?: ReportBranding
  enableBranding?: boolean
  canEditBranding?: boolean
  enableDataBlocks?: boolean
  enableAnalysis?: boolean
  enableRunReport?: boolean
  fontStylesheetUrl?: string | null
  getAuthenticationForProject?: (projectId: string | number) => Authentication | undefined
  onRunComplete?: (summary: ReportRunSummary) => void
  onErrorCallback?: (error: any) => void
  className?: string
}

export declare class Reports extends React.Component<ReportsProps> {
  // Saves everything waiting, now (before signing out, say); keepalive when the page is going away. Resolves with
  // whether each report reached the server.
  flushAll(options?: { keepalive?: boolean }): Promise<boolean[]>
  // Whether any report has edits AutoQL doesn't have yet.
  hasUnsavedChanges(): boolean
  // Saves the report shown, now.
  saveNow(): void
  // Lists the reports again.
  reload(): void
}

// What a toolbar's custom option hands its callback: the answer's payload, and from react-autoql's toolbars a
// capture of what it shows now.
export interface ReportToolbarOptionData {
  query?: string
  tileKey?: string | number
  dashboardId?: string | number
  [key: string]: unknown
}

export interface ReportToolbarOptionExtra {
  captureForReport?: (options?: { maxTableRows?: number; maxChartRows?: number }) => ReportCaptureResult
}

// The Data block "Add to Report…" adds: the answer or tile as it's shown now, and where it came from (the tile,
// when there is one, else the question). A message to show when it can't be kept.
export declare function captureReportBlock(options: {
  data: ReportToolbarOptionData | null | undefined
  extra: ReportToolbarOptionExtra | null | undefined
  dashboard?: { id: string; name?: string; tiles?: DashboardTile[] } | null
}): { ok: true; block: ReportDataBlock } | { ok: false; message: string }

export interface AddToReportDialogProps {
  authentication?: Authentication
  // The block to add at the end of the chosen report (captureReportBlock).
  block: ReportBlock
  onClose: () => void
  // After it's added (before onClose): which report, and whether it was made for this.
  onAdded?: (added: { id: string; title: string; created: boolean }) => void
}

// "Add to Report…": adds a block to the end of one of the user's reports, or to a new one.
export declare class AddToReportDialog extends React.Component<AddToReportDialogProps> {}

// ─── Miscellaneous components ─────────────────────────────────────────────────

export declare const Icon: React.FC<{ type: string; className?: string; [key: string]: any }>
export declare const LoadingDots: React.FC<{ [key: string]: any }>

export declare const DataAlerts: React.ComponentType<any>
export declare const DataAlertsTabbed: React.ComponentType<any>
export declare const DataAlertsList: React.ComponentType<any>
export declare const DataAlertRow: React.ComponentType<any>
export declare const DataAlertModal: React.ComponentType<any>
export declare const DataAlertDeleteDialog: React.ComponentType<any>
export declare const DataAlertListItem: React.ComponentType<any>
export declare const CustomFilteredAlertModal: React.ComponentType<any>
export declare const ScheduleBuilder: React.ComponentType<any>
export declare const ConditionBuilder: React.ComponentType<any>
export declare const NotificationIcon: React.ComponentType<any>
export declare const NotificationFeed: React.ComponentType<any>
export declare const NotificationItem: React.ComponentType<any>
export declare const JoinColumnSelectionTable: React.ComponentType<any>
export declare const SelectableTable: React.ComponentType<any>
export declare const ExpressionBuilder: React.ComponentType<any>
export declare const ChatContent: React.ComponentType<any>
export declare const AppearanceSection: React.ComponentType<any>
export declare const SlicerChip: React.ComponentType<any>
export declare const FilterLockPopover: React.ComponentType<any>
export declare const ReverseTranslation: React.ComponentType<any>
export declare const SpeechToTextButton: React.ComponentType<any>
export declare const ExploreQueries: React.ComponentType<any>
export declare const VizToolbar: React.ComponentType<any>
export declare const OptionsToolbar: React.ComponentType<any>
