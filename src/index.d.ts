import * as React from 'react'

export * from 'autoql-fe-utils'

// ─── Shared config interfaces ────────────────────────────────────────────────

export interface Authentication {
  token?: string
  apiKey?: string
  domain?: string
}

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
  enableCustomColumns?: boolean
  preferRegularTableInitialDisplayType?: boolean
  source?: string | string[]
  scope?: string
  offline?: boolean
  projectSelectList?: Array<{ projectId: string; displayName: string }>
  getAuthenticationForProject?: (projectId: string | number) => Authentication | undefined
  showProjectIndicator?: boolean
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
