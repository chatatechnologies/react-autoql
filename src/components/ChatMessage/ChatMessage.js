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
} from '../../props/defaults'

import { QueryOutput } from '../QueryOutput'
import { VizToolbar } from '../VizToolbar'
import { OptionsToolbar } from '../OptionsToolbar'
import { Spinner } from '../Spinner'
import ErrorBoundary from '../../containers/ErrorHOC/ErrorHOC'

import {
  getDefaultDisplayType,
  isChartType,
  getSupportedDisplayTypes,
} from '../../js/Util'
import errorMessages from '../../js/errorMessages'

import './ChatMessage.scss'

export default class ChatMessage extends React.Component {
  constructor(props) {
    super(props)

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
    isActive: PropTypes.bool,
    type: PropTypes.string,
    text: PropTypes.string,
    id: PropTypes.string.isRequired,
    displayType: PropTypes.string,
    onSuggestionClick: PropTypes.func,
    response: PropTypes.shape({}),
    content: PropTypes.oneOfType([PropTypes.string, PropTypes.shape({})]),
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
    addMessageToDM: PropTypes.func,
    csvDownloadProgress: PropTypes.number,
    onRTValueLabelClick: PropTypes.func,
    enableAjaxTableData: PropTypes.bool,
    source: PropTypes.arrayOf(PropTypes.string),
    isVisibleInDOM: PropTypes.bool,
  }

  static defaultProps = {
    authentication: authenticationDefault,
    autoQLConfig: autoQLConfigDefault,
    dataFormatting: dataFormattingDefault,
    themeConfig: themeConfigDefault,

    enableAjaxTableData: false,
    isIntroMessage: false,
    source: [],
    displayType: undefined,
    response: undefined,
    content: undefined,
    isActive: false,
    type: 'text',
    text: null,
    enableColumnVisibilityManager: true,
    isResizing: false,
    enableDynamicCharting: true,
    autoChartAggregations: true,
    csvDownloadProgress: undefined,
    onRTValueLabelClick: undefined,
    isVisibleInDOM: true,
    onSuggestionClick: () => {},
    onErrorCallback: () => {},
    onSuccessAlert: () => {},
    onConditionClickCallback: () => {},
    scrollToBottom: () => {},
    onNoneOfTheseClick: () => {},
  }

  componentDidMount = () => {
    this._isMounted = true
    this.scrollToBottomTimeout = setTimeout(() => {
      this.props.scrollToBottom()
    }, 100)

    // Wait until message bubble animation finishes to show query output content
    this.setIsAnimating()
  }

  shouldComponentUpdate = (nextProps) => {
    if (this.props.isResizing && nextProps.isResizing) {
      return false
    }

    return true
  }

  componentDidUpdate = (prevProps, prevState) => {
    if (this.props.isVisibleInDOM && !prevProps.isVisibleInDOM) {
      this.setIsAnimating()
    }
    ReactTooltip.hide()
  }

  componentWillUnmount = () => {
    this._isMounted = false
    clearTimeout(this.scrollToBottomTimeout)
    clearTimeout(this.scrollIntoViewTimeout)
    clearTimeout(this.animationTimeout)
  }

  setIsAnimating = () => {
    if (!this.state.isAnimatingMessageBubble) {
      this.setState({ isAnimatingMessageBubble: true })
    }

    clearTimeout(this.animationTimeout)
    this.animationTimeout = setTimeout(() => {
      this.setState({ isAnimatingMessageBubble: false })
      this.props.scrollToBottom()
    }, 500)
  }

  onCSVDownloadFinish = ({ error, exportLimit, limitReached }) => {
    if (error) {
      return this.props.addMessageToDM({ response: error })
    }

    const queryText = this.props.response?.data?.data?.text

    this.props.addMessageToDM({
      content: (
        <>
          Your file has successfully been downloaded with the query{' '}
          <b>
            <i>{queryText}</i>
          </b>
          .
          {limitReached ? (
            <>
              <br />
              <p>
                <br />
                WARNING: The file you’ve requested is larger than {exportLimit}
                MB. This exceeds the maximum download size and you will only
                receive partial data.
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
    this.setState({ displayType }, this.scrollIntoView)
  }

  onSupportedDisplayTypesChange = (supportedDisplayTypes) => {
    this.setState({ supportedDisplayTypes })
  }

  renderFetchingFileMessage = () => {
    return (
      <div>
        Fetching your file <Spinner />
      </div>
    )
  }

  renderCSVProgressMessage = () => {
    if (isNaN(this.state.csvDownloadProgress)) {
      return this.renderFetchingFileMessage()
    }
    return `Downloading your file ... ${this.state.csvDownloadProgress}%`
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
        <QueryOutput
          ref={(ref) => (this.responseRef = ref)}
          authentication={getAuthentication(this.props.authentication)}
          autoQLConfig={getAutoQLConfig(this.props.autoQLConfig)}
          queryResponse={this.props.response}
          displayType={this.state.displayType}
          onSuggestionClick={this.props.onSuggestionClick}
          isQueryRunning={this.props.isChataThinking}
          themeConfig={this.props.themeConfig}
          copyToClipboard={this.copyToClipboard}
          dataFormatting={getDataFormatting(this.props.dataFormatting)}
          appliedFilters={this.props.appliedFilters}
          onDrilldownStart={this.props.onDrilldownStart}
          onDrilldownEnd={this.props.onDrilldownEnd}
          demo={getAuthentication(this.props.authentication).demo}
          enableAjaxTableData={this.props.enableAjaxTableData}
          originalQueryID={this.props.originalQueryID}
          onSupportedDisplayTypesChange={this.onSupportedDisplayTypesChange}
          backgroundColor={document.documentElement.style.getPropertyValue(
            '--react-autoql-background-color-primary'
          )}
          onErrorCallback={this.props.onErrorCallback}
          enableColumnHeaderContextMenu={true}
          isResizing={
            this.props.isResizing || this.state.isAnimatingMessageBubble
          }
          enableDynamicCharting={this.props.enableDynamicCharting}
          optionsToolbarRef={this.optionsToolbarRef}
          onNoneOfTheseClick={this.props.onNoneOfTheseClick}
          autoChartAggregations={this.props.autoChartAggregations}
          showQueryInterpretation
          onRecommendedDisplayType={this.switchView}
          enableFilterLocking={this.props.enableFilterLocking}
          onRTValueLabelClick={this.props.onRTValueLabelClick}
          rebuildTooltips={this.props.rebuildTooltips}
          source={this.props.source}
          onRowChange={this.scrollIntoView}
          mutable={false}
          popoverParentElement={this.props.popoverParentElement}
          reportProblemCallback={() => {
            if (this.optionsToolbarRef?._isMounted) {
              this.optionsToolbarRef.setState({ activeMenu: 'other-problem' })
            }
          }}
        />
      )
    }
    return errorMessages.GENERAL_QUERY
  }

  toggleTableFilter = ({ isFilteringTable }) => {
    if (this.responseRef) {
      this.responseRef.toggleTableFilter({ isFilteringTable })
    }
  }

  onCSVDownloadStart = ({ id, queryId, query }) => {
    this.props.addMessageToDM({
      id,
      query,
      queryId,
      content: this.renderFetchingFileMessage(),
      isCSVProgressMessage: true,
    })
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

  renderRightToolbar = () => {
    return (
      <div className="chat-message-toolbar right">
        {this.props.isResponse &&
        this.state.displayType !== 'help' &&
        this.state.displayType !== 'suggestion' ? (
          <OptionsToolbar
            ref={(r) => (this.optionsToolbarRef = r)}
            authentication={this.props.authentication}
            autoQLConfig={getAutoQLConfig(this.props.autoQLConfig)}
            themeConfig={this.props.themeConfig}
            responseRef={this.responseRef}
            displayType={this.state.displayType}
            onCSVDownloadStart={this.onCSVDownloadStart}
            onCSVDownloadFinish={this.onCSVDownloadFinish}
            onCSVDownloadProgress={this.props.onCSVDownloadProgress}
            onSuccessAlert={this.props.onSuccessAlert}
            onErrorCallback={this.props.onErrorCallback}
            enableDeleteBtn={!this.props.isIntroMessage}
            deleteMessageCallback={() =>
              this.props.deleteMessageCallback(this.props.id)
            }
            rebuildTooltips={this.props.rebuildTooltips}
            onFilterClick={this.toggleTableFilter}
          />
        ) : null}
      </div>
    )
  }

  renderLeftToolbar = () => {
    let displayType = this.state.displayType

    if (
      this.state.supportedDisplayTypes &&
      !this.state.supportedDisplayTypes.includes(this.state.displayType)
    ) {
      displayType = 'table'
    }

    return (
      <div className="chat-message-toolbar left">
        {this.props.isResponse && this.props.type !== 'text' ? (
          <VizToolbar
            themeConfig={this.props.themeConfig}
            supportedDisplayTypes={this.state.supportedDisplayTypes || []}
            displayType={displayType}
            onDisplayTypeChange={this.onDisplayTypeChange}
            disableCharts={this.state.disableChartingOptions}
          />
        ) : null}
      </div>
    )
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
            ${
              this.props.disableMaxHeight || this.props.isIntroMessage
                ? ' no-max-height'
                : ''
            }
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
            {!this.props.isResizing && (
              <div className="chat-message-toolbars-container">
                {this.renderLeftToolbar()}
                {this.renderRightToolbar()}
              </div>
            )}
          </div>
        </div>
      </ErrorBoundary>
    )
  }
}
