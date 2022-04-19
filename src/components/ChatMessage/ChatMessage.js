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

export default class ChatMessage extends React.Component {
  supportedDisplayTypes = []
  filtering = false

  PIE_CHART_HEIGHT = 330
  MESSAGE_HEIGHT_MARGINS = 40
  MESSAGE_WIDTH_MARGINS = 40
  ORIGINAL_TABLE_MESSAGE_HEIGHT = undefined

  constructor(props) {
    super(props)

    const displayType = getDefaultDisplayType(
      props.response,
      props.autoChartAggregations
    )

    this.state = {
      supportedDisplayTypes: getSupportedDisplayTypes(props.response),
      chartHeight: this.getChartHeight(displayType),
      chartWidth: this.getChartWidth(),
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
    onRTValueLabelClick: PropTypes.func,
    messageContainerHeight: PropTypes.number,
    messageContainerWidth: PropTypes.number,
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
    messageContainerHeight: undefined,
    messageContainerWidth: undefined,
    scrollToBottom: () => {},
    onNoneOfTheseClick: () => {},
    onRTValueLabelClick: () => {},
  }

  componentDidMount = () => {
    this.setTableMessageHeightsTimeout = setTimeout(() => {
      this.props.scrollToBottom()
    }, 100)

    // Wait until message bubble animation finishes to show query output content
    this.animationTimeout = setTimeout(() => {
      this.setState({ isAnimatingMessageBubble: false })
      this.props.scrollToBottom()
    }, 600)

    this.calculatedQueryOutputStyle = _get(this.responseRef, 'style')
    this.calculatedQueryOutputHeight = _get(this.responseRef, 'offsetHeight')
  }

  componentDidUpdate = (prevProps, prevState) => {
    if (
      prevProps.messageContainerHeight !== this.props.messageContainerHeight ||
      prevProps.messageContainerWidth !== this.props.messageContainerWidth ||
      this.state.displayType !== prevState.displayType
    ) {
      this.setState({
        chartHeight: this.getChartHeight(this.state.displayType),
        chartWidth: this.getChartWidth(),
      })
    }
    ReactTooltip.hide()
  }

  componentWillUnmount = () => {
    clearTimeout(this.scrollIntoViewTimeout)
    clearTimeout(this.animationTimeout)

    removeFromDOM(this.messageElement)
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

  renderContent = () => {
    if (this.props.content) {
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
            onDataClick={this.props.processDrilldown}
            queryResponse={this.props.response}
            displayType={this.state.displayType}
            onSuggestionClick={this.props.onSuggestionClick}
            isQueryRunning={this.props.isChataThinking}
            themeConfig={getThemeConfig(this.props.themeConfig)}
            copyToClipboard={this.copyToClipboard}
            tableOptions={this.props.tableOptions}
            dataFormatting={getDataFormatting(this.props.dataFormatting)}
            hideColumnCallback={this.hideColumnCallback}
            onTableFilterCallback={this.onTableFilter}
            appliedFilters={this.props.appliedFilters}
            height={
              isChartType(this.state.displayType)
                ? this.state.chartHeight
                : undefined
            }
            width={
              isChartType(this.state.displayType)
                ? this.state.chartWidth
                : undefined
            }
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
            isAnimatingContainer={this.state.isAnimatingMessageBubble}
            enableDynamicCharting={this.props.enableDynamicCharting}
            dataConfig={this.state.dataConfig}
            onDataConfigChange={this.updateDataConfig}
            optionsToolbarRef={this.optionsToolbarRef}
            onNoneOfTheseClick={this.props.onNoneOfTheseClick}
            autoChartAggregations={this.props.autoChartAggregations}
            enableQueryInterpretation={this.props.enableQueryInterpretation}
            showQueryInterpretation
            onRecommendedDisplayType={this.switchView}
            enableFilterLocking={this.props.enableFilterLocking}
            onRTValueLabelClick={this.props.onRTValueLabelClick}
            reportProblemCallback={() => {
              if (this.optionsToolbarRef) {
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

  // TODO(Nikki): handle this in chatachart not here
  getChartWidth = () => {
    return this.props.messageContainerWidth - 70
  }

  // TODO(Nikki): handle this in chatachart not here
  getChartHeight = (displayType) => {
    if (displayType === 'pie') {
      return this.PIE_CHART_HEIGHT
    }

    return 0.85 * this.props.messageContainerHeight - 40 // 85% of chat height minus message margins
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
