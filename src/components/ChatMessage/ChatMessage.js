import React from 'react'
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

import { CHART_TYPES } from '../../js/Constants.js'
import {
  getDefaultDisplayType,
  isTableType,
  getSupportedDisplayTypes,
} from '../../js/Util'
import errorMessages from '../../js/errorMessages'

import './ChatMessage.scss'
import { exportCSV } from '../../js/queryService'

export default class ChatMessage extends React.Component {
  supportedDisplayTypes = []
  filtering = false

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
  }

  static defaultProps = {
    authentication: authenticationDefault,
    autoQLConfig: autoQLConfigDefault,
    dataFormatting: dataFormattingDefault,
    themeConfig: themeConfigDefault,

    onSuggestionClick: () => {},
    setActiveMessage: () => {},
    onErrorCallback: () => {},
    onSuccessAlert: () => {},
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
    scrollToBottom: () => {},
    onNoneOfTheseClick: () => {},
    onConditionClickCallback: () => {},
    onResponseCallback: () => {},
  }

  state = {
    displayType: getDefaultDisplayType(
      this.props.response,
      this.props.autoChartAggregations
    ),
    supportedDisplayTypes: getSupportedDisplayTypes(this.props.response),
    isSettingColumnVisibility: false,
    activeMenu: undefined,
  }

  componentDidMount = () => {
    this.setTableMessageHeightsTimeout = setTimeout(() => {
      this.setTableMessageHeights()
      // If we scroll to the bottom after the second update
      // it should be rendered enough so it scrolls all the
      // way to the bottom
      this.forceUpdate(this.props.scrollToBottom)
    }, 0)

    if (this.props.isCSVProgressMessage) {
      exportCSV({
        queryId: this.props.queryId,
        ...getAuthentication(this.props.authentication),
        csvProgressCallback: this.setCSVDownloadMessageContent,
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

  componentDidUpdate = (prevProps, prevState) => {
    ReactTooltip.hide()
    this.props.scrollToBottom()
  }

  componentWillUnmount = () => {
    clearTimeout(this.scrollIntoViewTimeout)
    clearTimeout(this.setTableMessageHeightsTimeout)
  }

  onCSVExportFinish = (response) => {
    let CSVFileSizeMb = _get(response, 'headers.content-length') / 1000000
    const CSVtotal_rows = _get(response, 'headers.total_rows')
    const CSVreturned_rows = _get(response, 'headers.returned_rows')
    let CSVexportLimit = _get(response, 'headers.export_limit')
    if (CSVFileSizeMb && CSVexportLimit) {
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
          {CSVFileSizeMb >= CSVexportLimit ? (
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

  setTableMessageHeights = () => {
    // We must explicitly set the height for tables, to avoid scroll jumping due to dynamic resizing
    this.TABLE_CONTAINER_HEIGHT = this.getHeightOfTableFromRows(
      _get(this.responseRef, 'numberOfTableRows')
    )
    this.PIVOT_TABLE_CONTAINER_HEIGHT = this.getHeightOfTableFromRows(
      _get(this.responseRef, 'numberOfPivotTableRows')
    )
  }

  getHeightOfTableFromRows = (rows) => {
    // This is hacky but it eliminates the jumpy bug
    // 39px per row, 81px leftover for padding and headers
    return rows * 39 + 81
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

  setCSVDownloadMessageContent = (percentCompleted) => {
    this.setState({
      content: `Fetching your file ... ${percentCompleted}%`,
    })
  }

  scrollIntoView = () => {
    this.scrollIntoViewTimeout = setTimeout(() => {
      const element = document.getElementById(`message-${this.props.id}`)

      if (!this.isScrolledIntoView(element)) {
        this.scrollIntoViewTimer = element.scrollIntoView({
          block: 'end',
          inline: 'nearest',
          behavior: 'smooth',
        })
        // If it didnt work the first time, it probably needs slightly more time
        this.scrollIntoViewTimer = setTimeout(() => {
          const newElement = document.getElementById(`message-${this.props.id}`)
          newElement.scrollIntoView({
            block: 'end',
            inline: 'nearest',
            behavior: 'smooth',
          })
        }, 300)
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

  setFilterTags = () => {
    if (this.optionsToolbarRef) {
      this.optionsToolbarRef.setFilterTags({ isFilteringTable: false })
    }
  }

  renderCSVProgressMessage = () => {
    if (this.state.content) {
      return this.state.content
    }
    return this.props.content
  }

  renderContent = (chartWidth, chartHeight) => {
    const { response, content, isCSVProgressMessage } = this.props
    if (isCSVProgressMessage) {
      return this.renderCSVProgressMessage()
    } else if (content) {
      return content
    } else if (_get(response, 'status') === 401) {
      return errorMessages.UNAUTHENTICATED
    } else if (response) {
      return (
        <React.Fragment>
          <QueryOutput
            ref={(ref) => (this.responseRef = ref)}
            authentication={getAuthentication(this.props.authentication)}
            autoQLConfig={getAutoQLConfig(this.props.autoQLConfig)}
            onDataClick={this.props.processDrilldown}
            queryResponse={response}
            displayType={this.state.displayType}
            onSuggestionClick={this.props.onSuggestionClick}
            isQueryRunning={this.props.isChataThinking}
            themeConfig={getThemeConfig(this.props.themeConfig)}
            copyToClipboard={this.copyToClipboard}
            tableOptions={this.props.tableOptions}
            dataFormatting={getDataFormatting(this.props.dataFormatting)}
            setFilterTagsCallback={this.setFilterTags}
            hideColumnCallback={this.hideColumnCallback}
            onTableFilterCallback={this.onTableFilter}
            height={chartHeight}
            width={chartWidth}
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
            isResizing={this.props.isResizing}
            enableDynamicCharting={this.props.enableDynamicCharting}
            dataConfig={this.state.dataConfig}
            onDataConfigChange={this.updateDataConfig}
            optionsToolbarRef={this.optionsToolbarRef}
            onNoneOfTheseClick={this.props.onNoneOfTheseClick}
            autoChartAggregations={this.props.autoChartAggregations}
            enableQueryInterpretation={this.props.enableQueryInterpretation}
            enableFilterLocking={this.props.enableFilterLocking}
            reportProblemCallback={() => {
              if (this.optionsToolbarRef) {
                this.optionsToolbarRef.setState({ activeMenu: 'other-problem' })
              }
            }}
            onConditionClickCallback={(e) => {
              this.props.onConditionClickCallback(e)
            }}
          />
        </React.Fragment>
      )
    }
    return errorMessages.GENERAL_QUERY
  }

  toggleTableFilter = (isFiltering) => {
    // We want to do this without updating the component for performance reasons
    // and so the component doesnt re-render and reset scroll values
    try {
      const messageElement = document.querySelector(
        `#message-${this.props.id}.response`
      )

      if (isFiltering) {
        messageElement.style.maxHeight = 'calc(85% + 35px)'
        messageElement.style.height = `${messageElement.offsetHeight + 35}px`
        this.scrollIntoView()
      } else {
        messageElement.style.maxHeight = '100%'
        messageElement.style.height = `${messageElement.offsetHeights}px`
      }
    } catch (error) {
      console.error(error)
      this.props.onErrorCallback(error)
    }
  }

  isSingleValueResponse = () => {
    const { response } = this.props
    return (
      _get(response, 'data.data.rows.length') === 1 &&
      _get(response, 'data.data.rows[0].length') === 1
    )
  }

  isTableResponse = () => {
    return (
      this.props.isResponse &&
      !this.isSingleValueResponse() &&
      this.props.type !== 'text' &&
      _get(this.props.response, 'data.data.rows.length', 0) > 0 &&
      isTableType(this.state.displayType)
    )
  }

  onCSVExportClick = (queryId, query) => {
    this.props.addMessageToDM({
      content: `Fetching your file ... 0%`,
      query,
      isCSVProgressMessage: true,
      queryId,
    })
  }

  renderRightToolbar = () => {
    if (
      this.props.isResponse &&
      this.props.displayType !== 'help' &&
      this.props.displayType !== 'suggestion'
    ) {
      return (
        <OptionsToolbar
          ref={(r) => (this.optionsToolbarRef = r)}
          className={`chat-message-toolbar right`}
          authentication={getAuthentication(this.props.authentication)}
          autoQLConfig={getAutoQLConfig(this.props.autoQLConfig)}
          themeConfig={getThemeConfig(this.props.themeConfig)}
          responseRef={this.responseRef}
          onCSVExportClick={this.onCSVExportClick}
          onSuccessAlert={this.props.onSuccessAlert}
          onErrorCallback={this.props.onErrorCallback}
          enableDeleteBtn={!this.props.isIntroMessage}
          deleteMessageCallback={() =>
            this.props.deleteMessageCallback(this.props.id)
          }
          onFilterCallback={this.toggleTableFilter}
          onColumnVisibilitySave={() => {
            this.forceUpdate()
          }}
          onResponseCallback={this.props.onResponseCallback}
        />
      )
    }

    return null
  }

  onDisplayTypeChange = (displayType) => {
    // Reset table filters when display type is changed
    this.toggleTableFilter(false)
    this.setFilterTags()
    if (this.optionsToolbarRef) {
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

  getChartDimensions = () => {
    let chartWidth = 0
    let chartHeight = 0
    const chatContainer = document.querySelector('.chat-message-container')

    if (chatContainer) {
      chartWidth = chatContainer.clientWidth - 70 // 100% of chat width minus message margins minus chat container margins
      chartHeight = 0.85 * chatContainer.clientHeight - 40 // 85% of chat height minus message margins
    }

    if (this.state.displayType === 'pie' && chartHeight > 330) {
      chartHeight = 330
    }

    return { chartWidth, chartHeight }
  }

  allColumnsAreHidden = () => {
    if (this.responseRef) {
      return this.responseRef.areAllColumnsHidden()
    }

    return false
  }

  getMessageHeight = () => {
    let messageHeight = 'unset'

    if (
      this.state.displayType === 'table' &&
      this.isTableResponse() &&
      this.TABLE_CONTAINER_HEIGHT
    ) {
      if (this.allColumnsAreHidden()) {
        // Allow space for the error message in case the table is small
        messageHeight = 210
      } else {
        messageHeight = this.TABLE_CONTAINER_HEIGHT + 40
      }
    } else if (
      this.state.displayType === 'pivot_table' &&
      this.isTableResponse() &&
      this.PIVOT_TABLE_CONTAINER_HEIGHT
    ) {
      messageHeight = this.PIVOT_TABLE_CONTAINER_HEIGHT
    }

    return messageHeight
  }

  getMaxMessageheight = () => {
    const { chartHeight } = this.getChartDimensions()

    if (this.props.type === 'text' || this.state.displayType === 'html') {
      return undefined
    } else if (chartHeight) {
      return chartHeight + 120
    }

    return '85%'
  }

  renderDataLimitWarning = () => {
    const numRows = _get(this.props, 'response.data.data.rows.length')
    const maxRowLimit = _get(this.props, 'response.data.data.row_limit')

    if (maxRowLimit && numRows === maxRowLimit && !this.allColumnsAreHidden()) {
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
    const { chartWidth, chartHeight } = this.getChartDimensions()
    const messageHeight = this.getMessageHeight()
    const maxMessageHeight = this.getMaxMessageheight()
    return (
      <ErrorBoundary>
        <div
          id={`message-${this.props.id}`}
          className={`chat-single-message-container
          ${this.props.isResponse ? ' response' : ' request'}`}
          style={{
            maxHeight: maxMessageHeight,
            height: messageHeight,
          }}
          data-test="chat-message"
        >
          <div
            className={`chat-message-bubble
            ${CHART_TYPES.includes(this.state.displayType) ? ' full-width' : ''}
          ${this.props.type === 'text' ? ' text' : ''}
            ${this.props.isActive ? ' active' : ''}`}
            style={{
              minWidth:
                (this.isTableResponse() &&
                  this.state.supportedDisplayTypes.length >= 4) ||
                (this.props.response &&
                  this.props.response.data &&
                  this.props.response.data.data &&
                  this.props.response.data.data.columns &&
                  _get(this.props.response, 'data.data.columns').every(
                    (col) => !col.visible
                  )) ||
                this.allColumnsAreHidden()
                  ? '400px'
                  : undefined,
            }}
          >
            {this.renderContent(chartWidth, chartHeight)}
            {this.props.isDataMessengerOpen && this.renderRightToolbar()}
            {this.props.isDataMessengerOpen && this.renderLeftToolbar()}
            {this.renderDataLimitWarning()}
          </div>
        </div>
      </ErrorBoundary>
    )
  }
}
