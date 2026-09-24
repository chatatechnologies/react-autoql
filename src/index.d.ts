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

export declare class Dashboard extends React.Component<DashboardProps> {}

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
}

export interface ReportPageBreakBlock {
  id: string
  type: 'pagebreak'
}

export type ReportBlock = ReportHeadingBlock | ReportTextBlock | ReportDataBlock | ReportPageBreakBlock

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
  tiles?: DashboardTile[]
  slicers?: Array<{ type?: string; data: any }>
}

export interface ReportBranding {
  name?: string
  logoUrl?: string
  color?: string
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
  // Organisation-level; there is no editor for it in the builder.
  branding?: ReportBranding
  onRunComplete?: (summary: ReportRunSummary) => void
  onErrorCallback?: (error: any) => void
  getAuthenticationForProject?: (projectId: string | number) => Authentication | undefined
  // A stylesheet that loads the typefaces the report can use. None is loaded by default.
  fontStylesheetUrl?: string | null
  // Run report: the builder fetches every data block itself. Off by default: blocks show what was
  // captured when they were added, and runReport() resolves null.
  enableRunReport?: boolean
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
