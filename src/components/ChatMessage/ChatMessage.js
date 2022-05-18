import React, { Fragment } from 'react'
import PropTypes from 'prop-types'
import _get from 'lodash.get'
import _cloneDeep from 'lodash.clonedeep'
import _isEqual from 'lodash.isequal'
import ReactTooltip from 'react-tooltip'

import {
  authenticationType,
  autoQLConfigType,
  dataFormattingType,
  themeConfigType,
} from '../../props/types'

import {
  authenticationDefault,
  autoQLConfigDefault,
  dataFormattingDefault,
  themeConfigDefault,
  getAuthentication,
  getDataFormatting,
  getAutoQLConfig,
  getThemeConfig,
} from '../../props/defaults'

import { QueryOutput } from '../QueryOutput'
import { VizToolbar } from '../VizToolbar'
import { Icon } from '../Icon'
import { OptionsToolbar } from '../OptionsToolbar'
import ErrorBoundary from '../../containers/ErrorHOC/ErrorHOC'

import {
  getDefaultDisplayType,
  isChartType,
  getSupportedDisplayTypes,
  areAllColumnsHidden,
  isTableType,
  removeFromDOM,
} from '../../js/Util'
import errorMessages from '../../js/errorMessages'

import './ChatMessage.scss'
import { exportCSV } from '../../js/queryService'

export default class ChatMessage extends React.Component {
  constructor(props) {
    super(props)

    this.supportedDisplayTypes = []
    this.filtering = false
    this.PIE_CHART_HEIGHT = 330
    this.MESSAGE_HEIGHT_MARGINS = 40
    this.MESSAGE_WIDTH_MARGINS = 40
    this.ORIGINAL_TABLE_MESSAGE_HEIGHT = undefined

    const displayType = getDefaultDisplayType(
      props.response,
      props.autoChartAggregations
    )

    this.state = {
      csvDownloadProgress: this.props.initialCSVDownloadProgress,
      displayType: getDefaultDisplayType(
        props.response,
        props.autoChartAggregations
      ),
      supportedDisplayTypes: getSupportedDisplayTypes({
        response: props.response,
      }),
      isAnimatingMessageBubble: true,
      isSettingColumnVisibility: false,
      activeMenu: undefined,
      displayType,
    }
  }

  static propTypes = {
    authentication: authenticationType,
    autoQLConfig: autoQLConfigType,
    dataFormatting: dataFormattingType,
    themeConfig: themeConfigType,
    isResponse: PropTypes.bool.isRequired,
    isIntroMessage: PropTypes.bool,
    isDataMessengerOpen: PropTypes.bool,
    setActiveMessage: PropTypes.func,
    isActive: PropTypes.bool,
    type: PropTypes.string,
    text: PropTypes.string,
    id: PropTypes.string.isRequired,
    displayType: PropTypes.string,
    onSuggestionClick: PropTypes.func,
    response: PropTypes.shape({}),
    content: PropTypes.oneOfType([PropTypes.string, PropTypes.shape({})]),
    tableOptions: PropTypes.shape({}),
    enableColumnVisibilityManager: PropTypes.bool,
    dataFormatting: dataFormattingType,
    onErrorCallback: PropTypes.func,
    onSuccessAlert: PropTypes.func,
    isResizing: PropTypes.bool,
    enableDynamicCharting: PropTypes.bool,
    scrollToBottom: PropTypes.func,
    onNoneOfTheseClick: PropTypes.func,
    autoChartAggregations: PropTypes.bool,
    onConditionClickCallback: PropTypes.func,
    onResponseCallback: PropTypes.func,
    addMessageToDM: PropTypes.func,
    onCSVExportClick: PropTypes.func,
    csvDownloadProgress: PropTypes.number,
    onRTValueLabelClick: PropTypes.func,
    messageContainerHeight: PropTypes.number,
    messageContainerWidth: PropTypes.number,
  }

  static defaultProps = {
    authentication: authenticationDefault,
    autoQLConfig: autoQLConfigDefault,
    dataFormatting: dataFormattingDefault,
    themeConfig: themeConfigDefault,

    isDataMessengerOpen: false,
    isIntroMessage: false,
    displayType: undefined,
    response: undefined,
    content: undefined,
    isActive: false,
    type: 'text',
    text: null,
    tableOptions: undefined,
    enableColumnVisibilityManager: true,
    isResizing: false,
    enableDynamicCharting: true,
    autoChartAggregations: true,
    csvDownloadProgress: undefined,
    messageContainerHeight: undefined,
    messageContainerWidth: undefined,
    onSuggestionClick: () => {},
    setActiveMessage: () => {},
    onErrorCallback: () => {},
    onSuccessAlert: () => {},
    onConditionClickCallback: () => {},
    onResponseCallback: () => {},
    scrollToBottom: () => {},
    onNoneOfTheseClick: () => {},
    onRTValueLabelClick: () => {},
  }

  componentDidMount = () => {
    this.scrollToBottomTimeout = setTimeout(() => {
      this.props.scrollToBottom()
    }, 100)

    if (
      this.props.isCSVProgressMessage &&
      typeof this.state.csvDownloadProgress === 'undefined'
    ) {
      this.props.setCSVDownloadProgress(this.props.id, 0)
      const linkedQueryResponseRef = this.props.linkedQueryResponseRef
      const queryDisplayType = _get(linkedQueryResponseRef, 'props.displayType')

      if (queryDisplayType === 'pivot_table') {
        if (_get(linkedQueryResponseRef, 'pivotTableRef')) {
          linkedQueryResponseRef.pivotTableRef.saveAsCSV().then(() => {
            this.props.setCSVDownloadProgress(this.props.id, 100)
            this.onCSVExportFinish(undefined, true)
          })
        }
      } else {
        exportCSV({
          queryId: this.props.queryId,
          ...getAuthentication(this.props.authentication),
          csvProgressCallback: (percentCompleted) =>
            this.props.setCSVDownloadProgress(this.props.id, percentCompleted),
        })
          .then((response) => {
            const url = window.URL.createObjectURL(new Blob([response.data]))
            const link = document.createElement('a')
            link.href = url
            link.setAttribute('download', 'export.csv')
            document.body.appendChild(link)
            link.click()
            this.onCSVExportFinish(response)
          })
          .catch((error) => {
            console.error(error)
          })
      }
    }

    // Wait until message bubble animation finishes to show query output content
    clearTimeout(this.animationTimeout)
    this.animationTimeout = setTimeout(() => {
      this.setState({ isAnimatingMessageBubble: false })
      this.props.scrollToBottom()
    }, 500)

    this.calculatedQueryOutputStyle = _get(this.responseRef, 'style')
    this.calculatedQueryOutputHeight = _get(this.responseRef, 'offsetHeight')
  }

  shouldComponentUpdate = (nextProps) => {
    if (this.props.isResizing && nextProps.isResizing) {
      return false
    }
    return true
  }

  componentDidUpdate = (prevProps, prevState) => {
    ReactTooltip.hide()
  }

  componentWillUnmount = () => {
    clearTimeout(this.scrollToBottomTimeout)
    clearTimeout(this.scrollIntoViewTimeout)
    clearTimeout(this.animationTimeout)
  }

  onCSVExportFinish = (response, isPivotTable) => {
    let CSVFileSizeMb = _get(response, 'headers.content-length') / 1000000
    const CSVtotal_rows = _get(response, 'headers.total_rows')
    const CSVreturned_rows = _get(response, 'headers.returned_rows')
    let CSVexportLimit = _get(response, 'headers.export_limit')
    if (!isPivotTable && CSVFileSizeMb && CSVexportLimit) {
      CSVFileSizeMb = parseInt(CSVFileSizeMb)
      CSVexportLimit = parseInt(CSVexportLimit)
    }

    this.props.addMessageToDM({
      content: (
        <>
          Your file has successfully been downloaded with the query{' '}
          <b>
            <i>{this.props.queryText}</i>
          </b>
          .
          {!isPivotTable && CSVFileSizeMb >= CSVexportLimit ? (
            <>
              <br />
              <p>
                WARNING: The file you’ve requested is larger than{' '}
                {CSVexportLimit}. This exceeds the maximum download size and you
                will only receive partial data.
              </p>
            </>
          ) : null}
        </>
      ),
    })
  }

  onCSVExportFinish = (response, isPivotTable) => {
    let CSVFileSizeMb = _get(response, 'headers.content-length') / 1000000
    const CSVtotal_rows = _get(response, 'headers.total_rows')
    const CSVreturned_rows = _get(response, 'headers.returned_rows')
    let CSVexportLimit = _get(response, 'headers.export_limit')
    if (!isPivotTable && CSVFileSizeMb && CSVexportLimit) {
      CSVFileSizeMb = parseInt(CSVFileSizeMb)
      CSVexportLimit = parseInt(CSVexportLimit)
    }

    this.props.addMessageToDM({
      content: (
        <>
          Your file has successfully been downloaded with the query{' '}
          <b>
            <i>{this.props.queryText}</i>
          </b>
          .
          {!isPivotTable && CSVFileSizeMb >= CSVexportLimit ? (
            <>
              <br />
              <p>
                WARNING: The file you’ve requested is larger than{' '}
                {CSVexportLimit}. This exceeds the maximum download size and you
                will only receive partial data.
              </p>
            </>
          ) : null}
        </>
      ),
    })
  }

  isScrolledIntoView = (elem) => {
    if (this.props.scrollContainerRef) {
      const scrollTop = this.props.scrollContainerRef.getScrollTop()
      const scrollBottom =
        scrollTop + this.props.scrollContainerRef.getClientHeight()

      const elemTop = elem.offsetTop
      const elemBottom = elemTop + elem.offsetHeight

      return elemBottom <= scrollBottom && elemTop >= scrollTop
    }

    return false
  }

  scrollIntoView = () => {
    clearTimeout(this.scrollIntoViewTimeout)
    this.scrollIntoViewTimeout = setTimeout(() => {
      if (
        this.messageContainerRef &&
        !this.isScrolledIntoView(this.messageContainerRef)
      ) {
        this.scrollIntoViewTimer = this.messageContainerRef.scrollIntoView({
          block: 'end',
          inline: 'nearest',
          behavior: 'smooth',
        })
      }
    }, 0)
  }

  switchView = (displayType) => {
    this.filtering = false
    this.setState({ displayType }, this.scrollIntoView)
  }

  updateDataConfig = (config) => {
    this.setState({ dataConfig: config })
  }

  onSupportedDisplayTypesChange = (supportedDisplayTypes) => {
    this.setState({ supportedDisplayTypes })
  }

  renderCSVProgressMessage = () => {
    return `Fetching your file ... ${this.state.csvDownloadProgress || 0}%`
  }

  renderContent = () => {
    if (
      this.props.isCSVProgressMessage ||
      typeof this.state.csvDownloadProgress !== 'undefined'
    ) {
      return this.renderCSVProgressMessage()
    } else if (this.props.content) {
      return this.props.content
    } else if (_get(this.props.response, 'status') === 401) {
      return errorMessages.UNAUTHENTICATED
    } else if (this.props.response) {
      return (
        <Fragment>
          <QueryOutput
            ref={(ref) => (this.responseRef = ref)}
            authentication={getAuthentication(this.props.authentication)}
            autoQLConfig={getAutoQLConfig(this.props.autoQLConfig)}
            onDataClick={this.props.onDataClick}
            queryResponse={this.props.response}
            displayType={this.state.displayType}
            onSuggestionClick={this.props.onSuggestionClick}
            isQueryRunning={this.props.isChataThinking}
            themeConfig={getThemeConfig(this.props.themeConfig)}
            copyToClipboard={this.copyToClipboard}
            tableOptions={this.props.tableOptions}
            dataFormatting={getDataFormatting(this.props.dataFormatting)}
            appliedFilters={this.props.appliedFilters}
            onUpdate={this.props.onQueryOutputUpdate}
            onDrilldownStart={this.props.onDrilldownStart}
            onDrilldownEnd={this.props.onDrilldownEnd}
            demo={getAuthentication(this.props.authentication).demo}
            onSupportedDisplayTypesChange={this.onSupportedDisplayTypesChange}
            backgroundColor={document.documentElement.style.getPropertyValue(
              '--react-autoql-background-color-primary'
            )}
            // We want to render our own in the parent component
            // so the tooltip doesn't get clipped by the drawer
            renderTooltips={false}
            onErrorCallback={this.props.onErrorCallback}
            enableColumnHeaderContextMenu={true}
            isResizing={
              this.props.isResizing || !this.props.isDataMessengerOpen
            }
            isAnimatingContainer={this.state.isAnimatingMessageBubble}
            enableDynamicCharting={this.props.enableDynamicCharting}
            tableConfig={this.state.dataConfig}
            onTableConfigChange={this.updateDataConfig}
            optionsToolbarRef={this.optionsToolbarRef}
            onNoneOfTheseClick={this.props.onNoneOfTheseClick}
            autoChartAggregations={this.props.autoChartAggregations}
            enableQueryInterpretation={this.props.enableQueryInterpretation}
            showQueryInterpretation
            onRecommendedDisplayType={this.switchView}
            enableFilterLocking={this.props.enableFilterLocking}
            onRTValueLabelClick={this.props.onRTValueLabelClick}
            reportProblemCallback={() => {
              if (this.optionsToolbarRef?._isMounted) {
                this.optionsToolbarRef.setState({ activeMenu: 'other-problem' })
              }
            }}
          />
        </Fragment>
      )
    }
    return errorMessages.GENERAL_QUERY
  }

  toggleTableFilter = ({ isFilteringTable }) => {
    if (this.responseRef) {
      this.responseRef.toggleTableFilter({ isFilteringTable })
    }
  }

  onCSVExportClick = (queryId, query) => {
    this.props.addMessageToDM({
      content: `Fetching your file ... 0%`,
      query,
      isCSVProgressMessage: true,
      queryId,
      linkedQueryResponseRef: this.responseRef,
    })
  }

  renderRightToolbar = () => {
    if (
      this.props.isResponse &&
      this.state.displayType !== 'help' &&
      this.state.displayType !== 'suggestion'
    ) {
      return (
        <OptionsToolbar
          ref={(r) => (this.optionsToolbarRef = r)}
          className={`chat-message-toolbar right`}
          authentication={getAuthentication(this.props.authentication)}
          autoQLConfig={getAutoQLConfig(this.props.autoQLConfig)}
          themeConfig={getThemeConfig(this.props.themeConfig)}
          responseRef={this.responseRef}
          displayType={this.state.displayType}
          onCSVExportClick={this.onCSVExportClick}
          onSuccessAlert={this.props.onSuccessAlert}
          onErrorCallback={this.props.onErrorCallback}
          enableDeleteBtn={!this.props.isIntroMessage}
          deleteMessageCallback={() =>
            this.props.deleteMessageCallback(this.props.id)
          }
          onFilterClick={this.toggleTableFilter}
          onResponseCallback={this.props.onResponseCallback}
        />
      )
    }

    return null
  }

  onDisplayTypeChange = (displayType) => {
    // Reset table filters when display type is changed
    this.toggleTableFilter({ isFilteringTable: false })
    if (this.optionsToolbarRef?._isMounted) {
      this.optionsToolbarRef.filtering = false
    }

    // Then switch to the appropriate view
    this.switchView(displayType)
  }

  renderLeftToolbar = () => {
    let displayType = this.state.displayType

    if (
      this.state.supportedDisplayTypes &&
      !this.state.supportedDisplayTypes.includes(this.state.displayType)
    ) {
      displayType = 'table'
    }

    if (this.props.isResponse && this.props.type !== 'text') {
      return (
        <VizToolbar
          themeConfig={getThemeConfig(this.props.themeConfig)}
          className="chat-message-toolbar left"
          supportedDisplayTypes={this.state.supportedDisplayTypes || []}
          displayType={displayType}
          onDisplayTypeChange={this.onDisplayTypeChange}
          disableCharts={this.state.disableChartingOptions}
        />
      )
    }
    return null
  }

  renderDataLimitWarning = () => {
    const numRows = _get(this.props, 'response.data.data.rows.length')
    const maxRowLimit = _get(this.props, 'response.data.data.row_limit')

    if (
      maxRowLimit &&
      numRows === maxRowLimit &&
      !areAllColumnsHidden(this.props.response)
    ) {
      return (
        <Icon
          type="warning"
          className="data-limit-warning-icon"
          data-tip={`The display limit of ${numRows} rows has been reached. Try querying a smaller time-frame to ensure all your data is displayed.`}
          data-for="chart-element-tooltip"
        />
      )
    }
  }

  render = () => {
    return (
      <ErrorBoundary>
        <div
          id={`message-${this.props.id}`}
          ref={(r) => (this.messageContainerRef = r)}
          data-test="chat-message"
          className={`chat-single-message-container
            ${this.props.isResponse ? ' response' : ' request'}
          `}
        >
          <div
            ref={(r) => (this.ref = r)}
            className={`chat-message-bubble
              ${isChartType(this.state.displayType) ? ' full-width' : ''}
              ${this.props.type === 'text' ? ' text' : ''}
              ${this.state.displayType}
              ${this.props.isActive ? ' active' : ''}`}
          >
            {this.renderContent()}
            {this.props.isDataMessengerOpen && !this.props.isResizing && (
              <Fragment>
                {this.renderRightToolbar()}
                {this.renderLeftToolbar()}
                {this.renderDataLimitWarning()}
              </Fragment>
            )}
          </div>
        </div>
      </ErrorBoundary>
    )
  }
}
