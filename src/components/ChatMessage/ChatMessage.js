import React from 'react'
import PropTypes from 'prop-types'
import { isMobile } from 'react-device-detect'
import {
  deepEqual,
  UNAUTHENTICATED_ERROR,
  GENERAL_QUERY_ERROR,
  authenticationDefault,
  autoQLConfigDefault,
  dataFormattingDefault,
  getAuthentication,
  isDrilldown,
  isTableType,
  isChartType,
} from 'autoql-fe-utils'

import { QueryOutput } from '../QueryOutput'
import { VizToolbar } from '../VizToolbar'
import { OptionsToolbar } from '../OptionsToolbar'
import { ReverseTranslation } from '../ReverseTranslation'
import { Spinner } from '../Spinner'
import ErrorBoundary from '../../containers/ErrorHOC/ErrorHOC'

import { authenticationType, autoQLConfigType, dataFormattingType } from '../../props/types'

import './ChatMessage.scss'

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
      localRTFilterResponse: null,
      isQueryOutputModalVisible: false,
      isResizing: false,
      messageHeight: 'auto',
      resizeStartY: 0,
      resizeStartHeight: 0,
      isResizable: false,
      isUserResizing: false,
      currentHeight: 400,
    }

    // Minimum height for the message container
    this.minMessageHeight = 300
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
    source: PropTypes.oneOfType([PropTypes.array, PropTypes.string]),
    scope: PropTypes.string,
    isVisibleInDOM: PropTypes.bool,
    subjects: PropTypes.arrayOf(PropTypes.shape({})),
    onMessageResize: PropTypes.func,
  }

  static defaultProps = {
    authentication: authenticationDefault,
    autoQLConfig: autoQLConfigDefault,
    dataFormatting: dataFormattingDefault,

    isIntroMessage: false,
    source: null,
    scope: undefined,
    response: undefined,
    content: undefined,
    isActive: false,
    type: 'text',
    text: null,
    enableColumnVisibilityManager: false,
    isResizing: false,
    enableDynamicCharting: true,
    autoChartAggregations: true,
    csvDownloadProgress: undefined,
    onRTValueLabelClick: undefined,
    isVisibleInDOM: true,
    subjects: [],
    onSuggestionClick: () => {},
    onErrorCallback: () => {},
    onSuccessAlert: () => {},
    onConditionClickCallback: () => {},
    scrollToBottom: () => {},
    onNoneOfTheseClick: () => {},
    onMessageResize: () => {},
  }

  componentDidMount = () => {
    this._isMounted = true
    this.props.scrollToBottom()
    this.scrollToBottomTimeout = setTimeout(() => {
      this.props.scrollToBottom()
    }, 100)

    // Wait until message bubble animation finishes to show query output content
    this.setIsAnimating()
  }

  shouldComponentUpdate = (nextProps, nextState) => {
    if (this.props.isResizing && nextProps.isResizing) {
      return false
    }

    return !deepEqual(this.props, nextProps) || !deepEqual(this.state, nextState)
  }

  getSnapshotBeforeUpdate = (nextProps, nextState) => {
    let messageWidth
    let shouldUpdateWidth = false
    if (this.ref) {
      if (!this.props.isResizing && nextProps.isResizing) {
        shouldUpdateWidth = true
        messageWidth = this.ref.clientWidth
      }

      if (this.props.isResizing && !nextProps.isResizing) {
        shouldUpdateWidth = true
        messageWidth = ''
      }
    }

    return { messageWidth, shouldUpdateWidth }
  }

  onUpdateFilterResponse = (localRTFilterResponse) => {
    this.setState({ localRTFilterResponse })
  }

  componentDidUpdate = (prevProps, prevState, { messageWidth, shouldUpdateWidth }) => {
    if (shouldUpdateWidth && this.ref?.style) {
      this.ref.style.width = messageWidth
    }
  }

  componentWillUnmount = () => {
    this._isMounted = false
    clearTimeout(this.scrollToBottomTimeout)
    clearTimeout(this.animationTimeout)
  }
  toggleQueryOutputModal = () => {
    this.setState((prevState) => ({
      isQueryOutputModalVisible: !prevState.isQueryOutputModalVisible,
    }))
  }

  setIsAnimating = () => {
    if (!this.state.isAnimatingMessageBubble) {
      return this.setState({ isAnimatingMessageBubble: true }, () => {
        this.clearIsAnimatingIn500ms()
      })
    }
    this.clearIsAnimatingIn500ms()
  }

  clearIsAnimatingIn500ms = () => {
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
                MB. This exceeds the maximum download size and you will only receive partial data.
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
      const scrollBottom = scrollTop + this.props.scrollContainerRef.getClientHeight()

      const elemTop = elem.offsetTop
      const elemBottom = elemTop + elem.offsetHeight

      return elemBottom <= scrollBottom && elemTop >= scrollTop
    }

    return false
  }

  scrollIntoView = ({ delay = 0, block = 'end', inline = 'nearest', behavior = 'smooth' } = {}) => {
    setTimeout(() => {
      if (this.messageAndRTContainerRef && !this.isScrolledIntoView(this.messageAndRTContainerRef)) {
        this.messageAndRTContainerRef.scrollIntoView({ block, inline })
      }
    }, delay)
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

  onNewDataCallback = () => {
    // To update the reverse translation:
    this.forceUpdate()
  }
  onDisplayTypeChange = (displayType) => {
    // Reset resizable state when changing display types
    this.setState({
      isResizable: false,
      isUserResizing: false,
      currentHeight: 400,
    })

    // Clear the CSS custom property
    if (this.ref) {
      this.ref.style.removeProperty('--message-height')
    }

    this.scrollIntoView()
  }
  renderContent = () => {
    if (this.props.isCSVProgressMessage || typeof this.state.csvDownloadProgress !== 'undefined') {
      return <div className='chat-message-bubble-content-container'>{this.renderCSVProgressMessage()}</div>
    } else if (this.props.content) {
      return <div className='chat-message-bubble-content-container'>{this.props.content}</div>
    } else if (this.props.response?.status === 401) {
      return <div className='chat-message-bubble-content-container'>{UNAUTHENTICATED_ERROR}</div>
    } else if (this.props.response) {
      return (
        <QueryOutput
          enableResizing={true}
          onResize={this.onQueryOutputResize}
          ref={(ref) => (this.responseRef = ref)}
          optionsToolbarRef={this.optionsToolbarRef}
          vizToolbarRef={this.vizToolbarRef}
          rtRef={this.rtRef}
          authentication={this.props.authentication}
          autoQLConfig={this.props.autoQLConfig}
          queryResponse={this.props.response}
          onSuggestionClick={this.props.onSuggestionClick}
          tableOptions={this.props.tableOptions}
          dataFormatting={this.props.dataFormatting}
          appliedFilters={this.props.appliedFilters}
          onDrilldownStart={this.props.onDrilldownStart}
          onDrilldownEnd={this.props.onDrilldownEnd}
          originalQueryID={this.props.originalQueryID}
          onErrorCallback={this.props.onErrorCallback}
          isAnimating={this.state.isAnimatingMessageBubble}
          isResizing={this.props.isResizing}
          enableDynamicCharting={this.props.enableDynamicCharting}
          initialTableConfigs={this.state.dataConfig}
          onTableConfigChange={this.updateDataConfig}
          onNoneOfTheseClick={this.props.onNoneOfTheseClick}
          autoChartAggregations={this.props.autoChartAggregations}
          showQueryInterpretation={false}
          onRTValueLabelClick={this.props.onRTValueLabelClick}
          source={this.props.source}
          scope={this.props.scope}
          onRowChange={this.scrollIntoView}
          onDisplayTypeChange={this.scrollIntoView}
          mutable={false}
          tooltipID={this.props.tooltipID}
          chartTooltipID={this.props.chartTooltipID}
          showSuggestionPrefix={false}
          dataPageSize={this.props.dataPageSize}
          popoverParentElement={this.props.popoverParentElement}
          allowColumnAddition={true}
          onNewData={this.onNewDataCallback}
          reportProblemCallback={() => {
            if (this.optionsToolbarRef?._isMounted) {
              this.optionsToolbarRef?.openReportProblemModal()
            }
          }}
          subjects={this.props.subjects}
          onUpdateFilterResponse={this.onUpdateFilterResponse}
        />
      )
    }
    return <div className='chat-message-bubble-content-container'>{GENERAL_QUERY_ERROR}</div>
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

  onDeleteMessage = () => this.props.deleteMessageCallback(this.props.id)

  renderRightToolbar = () => {
    return (
      <div className='chat-message-toolbar chat-message-toolbar-right'>
        {this.props.isResponse ? (
          <OptionsToolbar
            ref={(r) => (this.optionsToolbarRef = r)}
            responseRef={this.responseRef}
            className='chat-message-toolbar right'
            dataFormatting={this.props.dataFormatting}
            shouldRender={!this.props.isResizing && this.props.shouldRender}
            authentication={this.props.authentication}
            autoQLConfig={this.props.autoQLConfig}
            onCSVDownloadStart={this.onCSVDownloadStart}
            onCSVDownloadFinish={this.onCSVDownloadFinish}
            onCSVDownloadProgress={this.props.onCSVDownloadProgress}
            onSuccessAlert={this.props.onSuccessAlert}
            onErrorCallback={this.props.onErrorCallback}
            enableDeleteBtn={!this.props.isIntroMessage}
            popoverParentElement={this.props.popoverParentElement}
            deleteMessageCallback={this.onDeleteMessage}
            tooltipID={this.props.tooltipID}
            createDataAlertCallback={this.props.createDataAlertCallback}
            customOptions={this.props.customToolbarOptions}
            popoverAlign='end'
            showFilterBadge={this.responseRef?.tableRef?.getTabulatorHeaderFilters()?.length > 0}
            onExpandClick={this.toggleQueryOutputModal}
          />
        ) : null}
      </div>
    )
  }

  renderLeftToolbar = () => {
    return (
      <div className='chat-message-toolbar chat-message-toolbar-left'>
        {this.props.isResponse && this.props.type !== 'text' ? (
          <VizToolbar
            ref={(r) => (this.vizToolbarRef = r)}
            responseRef={this.responseRef}
            className='chat-message-toolbar left'
            tooltipID={this.props.tooltipID}
            shouldRender={!this.props.isResizing && this.props.shouldRender}
            onDisplayTypeChange={this.onDisplayTypeChange}
          />
        ) : null}
      </div>
    )
  }
  onQueryOutputResize = (dimensions) => {
    this.setState({
      isResizable: true,
      isUserResizing: true,
      currentHeight: dimensions.height,
    })
    if (this.props.onMessageResize) {
      this.props.onMessageResize(this.props.id)
    }
  }
  render = () => {
    const hasRT = !!this.responseRef?.queryResponse?.data?.data?.parsed_interpretation
    const isResizable =
      this.props.response && !this.props.isCSVProgressMessage && !this.props.content && this.state.isResizable

    return (
      <ErrorBoundary>
        <div
          className={`chat-message-and-rt-container
			${this.props.isResponse ? 'response' : 'request'}
			${isMobile ? 'pwa' : ''}
			${this.props.type === 'text' ? 'text' : ''}
			${this.props.isActive ? 'active' : ''}
			${this.props.disableMaxHeight || this.props.isIntroMessage ? ' no-max-height' : ''}`}
          ref={(r) => (this.messageAndRTContainerRef = r)}
        >
          <div
            id={`message-${this.props.id}`}
            ref={(r) => (this.messageContainerRef = r)}
            data-test='chat-message'
            className='chat-single-message-container'
          >
            <div className='chat-message-toolbars-container'>
              {this.renderLeftToolbar()}
              {this.renderRightToolbar()}
            </div>
            <div
              className={`chat-message-bubble 
        ${isResizable ? 'resizable' : ''} 
        ${this.state.isUserResizing ? 'user-resizing' : ''}`}
            >
              {this.renderContent()}
            </div>
          </div>
          {hasRT ? (
            <div className='chat-message-rt-container'>
              <ReverseTranslation
                key={this.responseRef.queryResponse?.data?.data?.query_id}
                authentication={this.props.authentication}
                onValueLabelClick={this.props.onRTValueLabelClick}
                queryResponse={this.responseRef.queryResponse}
                isResizing={this.props.isResizing}
                tooltipID={this.props.tooltipID}
                subjects={this.props.subjects}
                queryResponseRef={this.responseRef}
                allowColumnAddition={this.props.isResponse && this.props.type !== 'text'}
                enableEditReverseTranslation={
                  this.props.autoQLConfig.enableEditReverseTranslation && !isDrilldown(this.responseRef.queryResponse)
                }
                localRTFilterResponse={this.state.localRTFilterResponse}
              />
            </div>
          ) : null}
        </div>
      </ErrorBoundary>
    )
  }
}
