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

import {
  getDefaultDisplayType,
  isChartType,
  getSupportedDisplayTypes,
  areAllColumnsHidden,
  isTableType,
} from '../../js/Util'
import errorMessages from '../../js/errorMessages'

import './ChatMessage.scss'

export default class ChatMessage extends React.Component {
  supportedDisplayTypes = []
  filtering = false

  PIE_CHART_HEIGHT = 330
  MESSAGE_HEIGHT_MARGINS = 40
  MESSAGE_WIDTH_MARGINS = 40
  ORIGINAL_TABLE_MESSAGE_HEIGHT = undefined

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
  }

  componentDidUpdate = (prevProps, prevState) => {
    ReactTooltip.hide()
  }

  componentWillUnmount = () => {
    clearTimeout(this.scrollIntoViewTimeout)
    clearTimeout(this.setTableMessageHeightsTimeout)
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

  renderContent = (chartWidth, chartHeight) => {
    const { response, content } = this.props
    if (content) {
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
            hideColumnCallback={this.hideColumnCallback}
            onTableFilterCallback={this.onTableFilter}
            height={isChartType(this.state.displayType) && chartHeight}
            width={isChartType(this.state.displayType) && chartWidth}
            demo={getAuthentication(this.props.authentication).demo}
            onColumnsUpdate={this.props.onQueryResponseColumnsChange}
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

  toggleTableFilter = ({ isFilteringTable }) => {
    if (this.responseRef) {
      this.responseRef.toggleTableFilter({ isFilteringTable })
    }
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
          onSuccessAlert={this.props.onSuccessAlert}
          onErrorCallback={this.props.onErrorCallback}
          enableDeleteBtn={!this.props.isIntroMessage}
          deleteMessageCallback={() =>
            this.props.deleteMessageCallback(this.props.id)
          }
          onFilterClick={this.toggleTableFilter}
          onColumnVisibilitySave={() => {
            this.setState({
              displayType: getDefaultDisplayType(this.props.response),
            })
          }}
        />
      )
    }

    return null
  }

  onDisplayTypeChange = (displayType) => {
    // Reset table filters when display type is changed
    this.toggleTableFilter({ isFilteringTable: false })
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
    let chartWidth = undefined
    let chartHeight = undefined
    const chatContainer = document.querySelector('.chat-message-container')

    if (chatContainer) {
      chartWidth = chatContainer.clientWidth - 70 // 100% of chat width minus message margins minus chat container margins
      chartHeight = 0.85 * chatContainer.clientHeight - 40 // 85% of chat height minus message margins
    }
    if (
      this.state.displayType === 'pie' &&
      chartHeight > this.PIE_CHART_HEIGHT
    ) {
      chartHeight = this.PIE_CHART_HEIGHT
    }

    return { chartWidth, chartHeight }
  }

  getMessageHeight = () => {
    let messageHeight = 'unset'

    if (this.state.displayType === 'table' && this.TABLE_CONTAINER_HEIGHT) {
      messageHeight = this.TABLE_CONTAINER_HEIGHT + this.MESSAGE_HEIGHT_MARGINS
    } else if (
      this.state.displayType === 'pivot_table' &&
      this.PIVOT_TABLE_CONTAINER_HEIGHT
    ) {
      messageHeight = this.PIVOT_TABLE_CONTAINER_HEIGHT
    }

    return messageHeight
  }

  getMaxMessageheight = () => {
    if (
      this.props.type === 'text' ||
      ['text', 'html'].includes(this.state.displayType)
    ) {
      return undefined
    }

    // const chartHeight = _get(this.getChartDimensions(), 'chartHeight')
    // if (chartHeight) {
    //   return chartHeight + 120
    // }

    return '85%'
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
    const { chartWidth, chartHeight } = this.getChartDimensions()
    const messageHeight = this.getMessageHeight()
    const maxMessageHeight = this.getMaxMessageheight()

    return (
      <ErrorBoundary>
        <div
          id={`message-${this.props.id}`}
          className={`chat-single-message-container
            ${this.props.isResponse ? ' response' : ' request'}
`}
          style={{
            maxHeight: maxMessageHeight,
            height: messageHeight,
          }}
          data-test="chat-message"
        >
          <div
            className={`chat-message-bubble
              ${isChartType(this.state.displayType) ? ' full-width' : ''}
              ${this.props.type === 'text' ? ' text' : ''}
              ${this.state.displayType}
              ${this.props.isActive ? ' active' : ''}`}
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
