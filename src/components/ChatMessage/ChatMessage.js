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
} from '../../props/types'

import {
  authenticationDefault,
  autoQLConfigDefault,
  dataFormattingDefault,
  getAuthentication,
  getDataFormatting,
  getAutoQLConfig,
} from '../../props/defaults'

import { QueryOutput } from '../QueryOutput'
import { VizToolbar } from '../VizToolbar'
import { OptionsToolbar } from '../OptionsToolbar'
import { Spinner } from '../Spinner'
import ErrorBoundary from '../../containers/ErrorHOC/ErrorHOC'

import { isChartType } from '../../js/Util'
import errorMessages from '../../js/errorMessages'

import './ChatMessage.scss'
import { LoadMoreToolbar } from '../LoadMoreToolbar'

export default class ChatMessage extends React.Component {
  constructor(props) {
    super(props)

    this.filtering = false
    this.PIE_CHART_HEIGHT = 330
    this.MESSAGE_HEIGHT_MARGINS = 40
    this.MESSAGE_WIDTH_MARGINS = 40
    this.ORIGINAL_TABLE_MESSAGE_HEIGHT = undefined

    this.state = {
      csvDownloadProgress: this.props.initialCSVDownloadProgress,
      isAnimatingMessageBubble: true,
      isSettingColumnVisibility: false,
      activeMenu: undefined,
    }
  }

  static propTypes = {
    authentication: authenticationType,
    autoQLConfig: autoQLConfigType,
    dataFormatting: dataFormattingType,
    isResponse: PropTypes.bool.isRequired,
    isIntroMessage: PropTypes.bool,
    isActive: PropTypes.bool,
    type: PropTypes.string,
    text: PropTypes.string,
    id: PropTypes.string.isRequired,
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

    enableAjaxTableData: false,
    isIntroMessage: false,
    source: [],
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

  updateDataConfig = (config) => {
    this.setState({ dataConfig: config })
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
          optionsToolbarRef={this.optionsToolbarRef}
          vizToolbarRef={this.vizToolbarRef}
          loadMoreToolbarRef={this.loadMoreToolbarRef}
          authentication={getAuthentication(this.props.authentication)}
          autoQLConfig={getAutoQLConfig(this.props.autoQLConfig)}
          queryResponse={this.props.response}
          onSuggestionClick={this.props.onSuggestionClick}
          isQueryRunning={this.props.isChataThinking}
          copyToClipboard={this.copyToClipboard}
          tableOptions={this.props.tableOptions}
          dataFormatting={getDataFormatting(this.props.dataFormatting)}
          appliedFilters={this.props.appliedFilters}
          onDrilldownStart={this.props.onDrilldownStart}
          onDrilldownEnd={this.props.onDrilldownEnd}
          demo={getAuthentication(this.props.authentication).demo}
          enableAjaxTableData={this.props.enableAjaxTableData}
          originalQueryID={this.props.originalQueryID}
          backgroundColor={document.documentElement.style.getPropertyValue(
            '--react-autoql-background-color-secondary'
          )}
          onErrorCallback={this.props.onErrorCallback}
          enableColumnHeaderContextMenu={true}
          isResizing={
            this.props.isResizing || this.state.isAnimatingMessageBubble
          }
          enableDynamicCharting={this.props.enableDynamicCharting}
          initialTableConfigs={this.state.dataConfig}
          onTableConfigChange={this.updateDataConfig}
          onNoneOfTheseClick={this.props.onNoneOfTheseClick}
          autoChartAggregations={this.props.autoChartAggregations}
          showQueryInterpretation
          enableFilterLocking={this.props.enableFilterLocking}
          onRTValueLabelClick={this.props.onRTValueLabelClick}
          rebuildTooltips={this.props.rebuildTooltips}
          source={this.props.source}
          onRowChange={this.scrollIntoView}
          onDisplayTypeChange={this.scrollIntoView}
          mutable={false}
          showSuggestionPrefix={false}
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

  renderRightToolbar = () => {
    return (
      <div className="chat-message-toolbar right">
        {this.props.isResponse &&
        this.responseRef?.state?.displayType !== 'help' &&
        this.responseRef?.state?.displayType !== 'suggestion' ? (
          <OptionsToolbar
            ref={(r) => (this.optionsToolbarRef = r)}
            responseRef={this.responseRef}
            className={`chat-message-toolbar right`}
            authentication={this.props.authentication}
            autoQLConfig={this.props.autoQLConfig}
            onCSVDownloadStart={this.onCSVDownloadStart}
            onCSVDownloadFinish={this.onCSVDownloadFinish}
            onCSVDownloadProgress={this.props.onCSVDownloadProgress}
            onSuccessAlert={this.props.onSuccessAlert}
            onErrorCallback={this.props.onErrorCallback}
            enableDeleteBtn={!this.props.isIntroMessage}
            rebuildTooltips={this.props.rebuildTooltips}
            onFilterClick={this.toggleTableFilter}
            popoverParentElement={this.props.popoverParentElement}
            deleteMessageCallback={() =>
              this.props.deleteMessageCallback(this.props.id)
            }
          />
        ) : null}
      </div>
    )
  }

  renderLeftToolbar = () => {
    return (
      <div className="chat-message-toolbar left">
        {this.props.isResponse && this.props.type !== 'text' ? (
          <VizToolbar
            ref={(r) => (this.vizToolbarRef = r)}
            responseRef={this.responseRef}
            className="chat-message-toolbar left"
          />
        ) : null}
      </div>
    )
  }
  renderCentreToolbar = () => {
    return (
      <div className="chat-message-toolbar center">
        {this.props.isResponse && this.props.type !== 'text' ? (
          <LoadMoreToolbar
            authentication={this.props.authentication}
            ref={(r) => (this.loadMoreToolbarRef = r)}
            responseRef={this.responseRef}
            className="chat-message-toolbar center"
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
          {console.log(isChartType(this.responseRef?.state?.displayType))}
          <div
            ref={(r) => (this.ref = r)}
            className={`chat-message-bubble
              ${
                isChartType(this.responseRef?.state?.displayType)
                  ? ' full-width'
                  : ''
              }
              ${this.props.type === 'text' ? ' text' : ''}
              ${this.responseRef?.state?.displayType}
              ${this.props.isActive ? ' active' : ''}`}
          >
            {this.renderContent()}
            {!this.props.isResizing && (
              <div className="chat-message-toolbars-container">
                {this.renderLeftToolbar()}
                {this.renderCentreToolbar()}
                {this.renderRightToolbar()}
              </div>
            )}
          </div>
        </div>
      </ErrorBoundary>
    )
  }
}
