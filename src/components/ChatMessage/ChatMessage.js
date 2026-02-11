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
  fetchLLMSummary,
  MAX_DATA_PAGE_SIZE,
} from 'autoql-fe-utils'

import ReactMarkdown from 'react-markdown'
import remarkBreaks from 'remark-breaks'

import { QueryOutput } from '../QueryOutput'
import { VizToolbar } from '../VizToolbar'
import { OptionsToolbar } from '../OptionsToolbar'
import { ReverseTranslation } from '../ReverseTranslation'
import { Spinner } from '../Spinner'
import { Button } from '../Button'
import { Icon } from '../Icon'
import { Tooltip } from '../Tooltip'
import ErrorBoundary from '../../containers/ErrorHOC/ErrorHOC'

import { authenticationType, autoQLConfigType, dataFormattingType } from '../../props/types'

import './ChatMessage.scss'

// Custom components for markdown rendering
const MARKDOWN_COMPONENTS = {
  ul: ({ children }) => <ul>{children}</ul>,
  li: ({ children }) => <li>{children}</li>,
  strong: ({ children }) => <strong>{children}</strong>,
  em: ({ children }) => <em>{children}</em>,
  br: () => <br />,
}

export default class ChatMessage extends React.Component {
  constructor(props) {
    super(props)
    this.markdownContentRef = React.createRef()

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
      isGeneratingSummary: false,
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
    response: PropTypes.shape({
      status: PropTypes.number,
      data: PropTypes.shape({
        data: PropTypes.shape({
          rows: PropTypes.array,
          columns: PropTypes.array,
          text: PropTypes.string,
          interpretation: PropTypes.string,
          query_id: PropTypes.string,
          isDataPreview: PropTypes.bool,
        }),
      }),
    }),
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
    drilldownFilters: PropTypes.arrayOf(PropTypes.shape({})),
    setGeneratingSummary: PropTypes.func,
    enableMagicWand: PropTypes.bool,
    isChataThinking: PropTypes.bool,
    enableCyclicalDates: PropTypes.bool,
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
    drilldownFilters: undefined,
    onSuggestionClick: () => {},
    onErrorCallback: () => {},
    onSuccessAlert: () => {},
    onConditionClickCallback: () => {},
    scrollToBottom: () => {},
    onNoneOfTheseClick: () => {},
    onMessageResize: () => {},
    enableMagicWand: false,
    isChataThinking: false,
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
    if (this._isMounted) {
      this.setState({ localRTFilterResponse })
    }
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

  onPNGDownloadFinish = () => {
    const queryText = this.props.response?.data?.data?.text

    this.props.addMessageToDM({
      content: (
        <>
          Your PNG file has successfully been downloaded for the query{' '}
          <b>
            <i>{queryText}</i>
          </b>
          .
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

  isValidConfig = (config) => {
    return config && typeof config === 'object' && !Array.isArray(config)
  }

  updateDataConfig = (config) => {
    if (this.isValidConfig(config)) {
      this.setState({ dataConfig: config })
    }
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

  renderMarkdown = (content) => {
    if (!content) {return null}

    // Convert content to string if it's not already
    let contentStr = typeof content === 'string' ? content : String(content)

    // Replace literal "\\n" strings with actual newlines if they exist
    // (in case the API returns escaped newlines)
    contentStr = contentStr.replaceAll('\\n', '\n')

    // Pass content directly to react-markdown without any manipulation
    return (
      <ReactMarkdown remarkPlugins={[remarkBreaks]} components={MARKDOWN_COMPONENTS}>
        {contentStr}
      </ReactMarkdown>
    )
  }

  handleGenerateSummary = async () => {
    if (!this.props.response?.data?.data?.rows || !this.props.response?.data?.data?.columns) {
      return
    }

    const auth = getAuthentication(this.props.authentication, this.props.autoQLConfig)
    if (!auth.apiKey || !auth.domain) {
      this.props.onErrorCallback?.('Missing authentication credentials for summary generation')
      return
    }

    // Set loading state for this specific message
    this.setState({ isGeneratingSummary: true })
    // Also set loading state in parent ChatContent to show loading dots at bottom
    this.props.setGeneratingSummary?.(true)

    try {
      // Get filtered data from QueryOutput's tableData (already filtered)
      const filteredRows = this.responseRef?.tableData || this.props.response.data.data.rows

      const response = await fetchLLMSummary({
        data: {
          additional_context: {
            text: this.props.response.data.data.text,
            interpretation: this.props.response.data.data.interpretation,
            focus_prompt: '',
          },
          rows: filteredRows,
          columns: this.props.response.data.data.columns,
        },
        queryID: this.props.response.data.data.query_id,
        apiKey: auth.apiKey,
        token: auth.token,
        domain: auth.domain,
      })

      const summary = response?.data?.data?.summary

      if (summary) {
        // Add summary as a new message bubble
        this.props.addMessageToDM?.({
          content: summary,
          type: 'markdown',
          isResponse: true,
        })
      } else {
        // No summary returned - check for error message in response
        const errorMessage = response?.data?.data?.message || response?.data?.message || response?.message
        const displayMessage = errorMessage || 'Failed to generate summary. Please try again.'

        // Add error message as a new message bubble
        this.props.addMessageToDM?.({
          content: displayMessage,
          type: 'text',
          isResponse: true,
        })
      }
    } catch (error) {
      // Handle API errors - check if error response has a message
      const errorMessage =
        error?.response?.data?.data?.message ||
        error?.response?.data?.message ||
        error?.message ||
        'Failed to generate summary. Please try again.'

      // Add error message as a new message bubble
      this.props.addMessageToDM?.({
        content: errorMessage,
        type: 'text',
        isResponse: true,
      })
    } finally {
      // Clear loading state for this specific message
      this.setState({ isGeneratingSummary: false })
      // Clear loading state in parent
      this.props.setGeneratingSummary?.(false)
    }
  }

  copyMarkdownAsPlainText = async () => {
    if (!this.props.content || (this.props.type !== 'markdown' && this.props.type !== 'md')) {
      return
    }

    try {
      // Extract plain text from the rendered markdown content
      if (!this.markdownContentRef.current) {
        return
      }

      const text = this.markdownContentRef.current.innerText

      // Copy as plain text using Clipboard API
      // Try modern Clipboard API first
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(text)
          this.props.onSuccessAlert?.('Successfully copied summary to clipboard!')
          return
        }
      } catch (err) {
        // swallow and fall back
      }

      // Fallback for older browsers: use a temporary textarea + execCommand
      try {
        const textarea = document.createElement('textarea')
        textarea.value = text
        textarea.style.position = 'fixed'
        textarea.style.left = '-9999px'
        textarea.style.top = '0'
        document.body.appendChild(textarea)
        textarea.focus()
        textarea.select()
        const successful = document.execCommand('copy')
        document.body.removeChild(textarea)
        if (successful) {
          this.props.onSuccessAlert?.('Successfully copied summary to clipboard!')
        } else {
          throw new Error('Copy command was unsuccessful')
        }
      } catch (fallbackError) {
        console.error('Failed to copy summary to clipboard:', fallbackError)
        this.props.onErrorCallback?.(fallbackError)
      }
    } catch (error) {
      console.error('Failed to copy markdown:', error)
      this.props.onErrorCallback?.(error)
    }
  }

  renderSummaryFooter = () => {
    // Only show footer for response messages with data
    if (
      !this.props.enableMagicWand ||
      !this.props.isResponse ||
      !this.props.response?.data?.data?.rows ||
      !this.props.response?.data?.data?.columns ||
      this.props.type === 'text' ||
      this.props.isCSVProgressMessage
    ) {
      return null
    }

    const rows = this.props.response?.data?.data?.rows || []
    const rowCount = rows.length
    const isDatasetTooLarge = rowCount > MAX_DATA_PAGE_SIZE
    // Only show loading for this specific message, not when any query is running
    const isGenerating = this.state.isGeneratingSummary
    // Disable button if dataset is too large, or if this specific message is generating
    // Also disable if Chata is thinking (query/drilldown running) to prevent conflicts
    const isDisabled = isDatasetTooLarge || isGenerating || Boolean(this.props.isChataThinking)

    const tooltipId = 'chat-message-summary-button-tooltip'
    const tooltipContent = isDatasetTooLarge
      ? `The dataset is too large to generate a summary. Please refine your dataset to generate a summary.`
      : undefined

    return (
      <div className='chat-message-summary-footer'>
        <div
          data-tooltip-html={tooltipContent}
          data-tooltip-id={tooltipContent ? tooltipId : undefined}
          style={{ display: 'inline-block' }}
        >
          <Button
            type='default'
            size='large'
            icon='magic-wand'
            onClick={this.handleGenerateSummary}
            disabled={isDisabled}
            loading={isGenerating}
            border={false}
          >
            Generate Summary
          </Button>
        </div>
        {tooltipContent && <Tooltip tooltipId={tooltipId} delayShow={500} />}
      </div>
    )
  }
  renderContent = () => {
    if (this.props.isCSVProgressMessage || typeof this.state.csvDownloadProgress !== 'undefined') {
      return <div className='chat-message-bubble-content-container'>{this.renderCSVProgressMessage()}</div>
    } else if (this.props.content) {
      if (this.props.type === 'markdown' || this.props.type === 'md') {
        return (
          <div className='chat-message-bubble-content-container chat-message-markdown'>
            <div className='chat-message-summary-title'>
              <Icon type='magic-wand' />
              <strong>Summary:</strong>
            </div>
            <div ref={this.markdownContentRef}>{this.renderMarkdown(this.props.content)}</div>
          </div>
        )
      }
      return <div className='chat-message-bubble-content-container'>{this.props.content}</div>
    } else if (this.props.response?.status === 401) {
      return <div className='chat-message-bubble-content-container'>{UNAUTHENTICATED_ERROR}</div>
    } else if (this.props.response) {
      const isDataPreview = this.props.response?.data?.data?.isDataPreview

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
          initialTableConfigs={this.isValidConfig(this.state.dataConfig) ? this.state.dataConfig : undefined}
          onTableConfigChange={this.updateDataConfig}
          onNoneOfTheseClick={this.props.onNoneOfTheseClick}
          autoChartAggregations={this.props.autoChartAggregations}
          showQueryInterpretation={false}
          onRTValueLabelClick={this.props.onRTValueLabelClick}
          source={this.props.source}
          scope={this.props.scope}
          drilldownFilters={this.props.drilldownFilters}
          onRowChange={this.scrollIntoView}
          onDisplayTypeChange={this.scrollIntoView}
          mutable={false}
          tooltipID={this.props.tooltipID}
          chartTooltipID={this.props.chartTooltipID}
          showSuggestionPrefix={false}
          dataPageSize={this.props.dataPageSize}
          popoverParentElement={this.props.popoverParentElement}
          allowColumnAddition={!isDataPreview}
          onNewData={this.onNewDataCallback}
          enableCyclicalDates={this.props.enableCyclicalDates}
          isUserResizing={this.state.isUserResizing}
          reportProblemCallback={() => {
            if (this.optionsToolbarRef?._isMounted) {
              this.optionsToolbarRef?.openReportProblemModal()
            }
          }}
          subjects={this.props.subjects}
          onUpdateFilterResponse={this.onUpdateFilterResponse}
          enableCustomColumns={isDataPreview ? false : this.props.enableCustomColumns}
          disableAggregationMenu={this.props.disableAggregationMenu}
          allowCustomColumnsOnDrilldown={this.props.allowCustomColumnsOnDrilldown}
          preferRegularTableInitialDisplayType={this.props.preferRegularTableInitialDisplayType}
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
    // For data preview responses, only show delete button
    const isDataPreview = this.props.response?.data?.data?.isDataPreview
    const isMarkdownMessage = this.props.type === 'markdown' || this.props.type === 'md'
    const customAutoQLConfig = isDataPreview
      ? {
        ...this.props.autoQLConfig,
        enableCSVDownload: false,
        enableReportProblem: false,
        enableColumnVisibilityManager: false,
        enableNotifications: false,
        translation: 'exclude',
      }
      : this.props.autoQLConfig

    return (
      <div className='chat-message-toolbar chat-message-toolbar-right'>
        {this.props.isResponse || isMarkdownMessage ? (
          <OptionsToolbar
            ref={(r) => (this.optionsToolbarRef = r)}
            responseRef={this.responseRef}
            className='chat-message-toolbar right'
            dataFormatting={this.props.dataFormatting}
            shouldRender={!this.props.isResizing && this.props.shouldRender}
            authentication={this.props.authentication}
            autoQLConfig={customAutoQLConfig}
            onCSVDownloadStart={this.onCSVDownloadStart}
            onCSVDownloadFinish={this.onCSVDownloadFinish}
            onCSVDownloadProgress={this.props.onCSVDownloadProgress}
            onPNGDownloadFinish={this.onPNGDownloadFinish}
            onSuccessAlert={this.props.onSuccessAlert}
            onErrorCallback={this.props.onErrorCallback}
            enableDeleteBtn={!this.props.isIntroMessage}
            enableFilterBtn={!isDataPreview}
            enableCopyBtn={!isDataPreview}
            isMarkdownMessage={isMarkdownMessage}
            markdownContent={isMarkdownMessage ? this.props.content : undefined}
            onCopyMarkdown={this.copyMarkdownAsPlainText}
            popoverParentElement={this.props.popoverParentElement}
            deleteMessageCallback={this.onDeleteMessage}
            tooltipID={this.props.tooltipID}
            createDataAlertCallback={this.props.createDataAlertCallback}
            customOptions={isDataPreview ? [] : this.props.customToolbarOptions}
            popoverAlign='end'
            onExpandClick={this.toggleQueryOutputModal}
          />
        ) : null}
      </div>
    )
  }

  renderLeftToolbar = () => {
    // Don't show charting options for data preview responses
    const isDataPreview = this.props.response?.data?.data?.isDataPreview

    return (
      <div className='chat-message-toolbar chat-message-toolbar-left'>
        {this.props.isResponse && this.props.type !== 'text' && !isDataPreview ? (
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
        ${this.state.isUserResizing ? 'user-resizing' : ''}
        ${this.props.type === 'markdown' || this.props.type === 'md' ? 'markdown-message' : ''}`}
            >
              {this.renderContent()}
              {this.renderSummaryFooter()}
            </div>
          </div>
          {!!this.responseRef && (
            <div className='chat-message-rt-container'>
              <ReverseTranslation
                key={this.responseRef?.queryResponse?.data?.data?.query_id}
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
          )}
        </div>
      </ErrorBoundary>
    )
  }
}
