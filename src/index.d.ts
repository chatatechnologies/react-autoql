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

export interface BillingCustomerKeyResponse {
  billing_customer_key: string
  scope?: BillingCustomerScope | null
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

export declare function formatMicrosAsCurrency(micros?: number | null, emptyLabel?: string): string
export declare function microsFromCurrencyInput(value: string): number | null
export declare function currencyInputFromMicros(micros?: number | null): string
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
  enableCustomColumns?: boolean
  preferRegularTableInitialDisplayType?: boolean
  source?: string | string[]
  scope?: string
  offline?: boolean
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
  introMessage?: string
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
