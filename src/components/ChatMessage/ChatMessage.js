import React, { Fragment } from 'react'
import PropTypes from 'prop-types'
import {
  MdContentCopy,
  MdFileDownload,
  MdFilterList,
  MdInfoOutline
} from 'react-icons/md'
import ReactTooltip from 'react-tooltip'

import { ResponseRenderer } from '../ResponseRenderer'

import { TABLE_TYPES, CHART_TYPES } from '../../js/Constants.js'

import {
  tableIcon,
  pivotTableIcon,
  columnChartIcon,
  barChartIcon,
  lineChartIcon,
  pieChartIcon,
  heatmapIcon,
  bubbleChartIcon
} from '../../svgIcons.js'

export default class ChatMessage extends React.Component {
  supportedDisplayTypes = []

  static propTypes = {
    isResponse: PropTypes.bool.isRequired,
    lastMessageId: PropTypes.string.isRequired,
    scrollToBottom: PropTypes.func.isRequired,
    setActiveMessage: PropTypes.func,
    isActive: PropTypes.bool,
    type: PropTypes.string,
    text: PropTypes.string,
    id: PropTypes.string.isRequired,
    displayType: PropTypes.string,
    tableBorderColor: PropTypes.string.isRequired,
    tableHoverColor: PropTypes.string.isRequired,
    onSuggestionClick: PropTypes.func.isRequired,
    response: PropTypes.shape({}),
    content: PropTypes.string,
    tableOptions: PropTypes.shape({}),
    debug: PropTypes.bool
  }

  static defaultProps = {
    setActiveMessage: () => {},
    displayType: undefined,
    response: undefined,
    content: undefined,
    isActive: false,
    type: 'text',
    text: null,
    tableOptions: undefined,
    debug: false
  }

  state = {
    displayType:
      this.props.response &&
      this.props.response.data &&
      this.props.response.data.data &&
      this.props.response.data.data.display_type,
    isFilteringTable: false
  }

  componentDidUpdate = () => {
    ReactTooltip.rebuild()
  }

  scrollToBottomIfLastMessage = () => {
    if (this.props.lastMessageId === this.props.id) {
      this.props.scrollToBottom()
    }
  }

  switchView = displayType => {
    this.setState({ displayType, isFilteringTable: false })
    // If its the last message, scroll to bottom.
    // There is a bug that makes it jump to the top if its the only message
    this.scrollToBottomIfLastMessage()
  }

  renderContent = () => {
    const { response, content } = this.props
    if (content) {
      return content
    } else if (response) {
      let chartWidth = 0
      let chartHeight = 0
      const chatContainer = document.querySelector('.chat-message-container')
      if (chatContainer) {
        chartWidth = chatContainer.clientWidth - 20 - 40 // 100% of chat width minus message margins minus chat container margins
        chartHeight = 0.85 * chatContainer.clientHeight - 20 // 88% of chat height minus message margins
      }

      return (
        <ResponseRenderer
          ref={ref => (this.responseRef = ref)}
          processDrilldown={this.props.processDrilldown}
          response={response}
          displayType={this.state.displayType}
          isDrilldownDisabled={!!response.isDrilldownDisabled}
          onSuggestionClick={this.props.onSuggestionClick}
          isQueryRunning={this.props.isChataThinking}
          tableBorderColor={this.props.tableBorderColor}
          tableHoverColor={this.props.tableHoverColor}
          copyToClipboard={this.copyToClipboard}
          tableOptions={this.props.tableOptions}
          isFilteringTable={this.state.isFilteringTable}
          // We want to render our own in the parent component
          // so the tooltip doesn't get clipped by the drawer
          renderTooltips={false}
        />
      )
    }
    return 'Oops... Something went wrong with this query. If the problem persists, please contact the customer success team'
  }

  toggleTableFilter = () => {
    this.setState({ isFilteringTable: !this.state.isFilteringTable })
    this.scrollToBottomIfLastMessage()
  }

  // todo: put all right toolbar functions into separate component
  copyTableToClipboard = () => {
    if (this.responseRef) {
      this.responseRef.copyTableToClipboard()
    }
  }

  saveTableAsCSV = () => {
    if (this.responseRef) {
      this.responseRef.saveTableAsCSV()
    }
  }

  saveChartAsPNG = () => {
    if (this.responseRef) {
      this.responseRef.saveChartAsPNG()
    }
  }

  isSingleValueResponse = () => {
    const { response } = this.props
    return (
      response &&
      response.data &&
      response.data.data &&
      response.data.data.rows &&
      response.data.data.rows.length === 1 &&
      response.data.data.rows[0].length === 1
    )
  }

  renderInterpretationTip = () => {
    const interpretation = `<span>
        <strong>Interpretation: </strong>
        ${this.props.response.data.data.interpretation}
      </span>`

    let sql = ''
    if (this.props.debug) {
      sql = `
        <br />
        <br />
        <span>
          <strong>SQL: </strong>
          ${this.props.response.data.data.sql}
        </span>`
    }
    return `<div>
        ${interpretation}
        ${sql}
      </div>`
  }

  renderRightToolbar = () => {
    const shouldShowButton = {
      showFilterButton:
        TABLE_TYPES.includes(this.state.displayType) &&
        !this.isSingleValueResponse() &&
        this.props.response &&
        this.props.response.data &&
        this.props.response.data.data &&
        this.props.response.data.data.rows &&
        this.props.response.data.data.rows.length > 1,
      showCopyButton:
        TABLE_TYPES.includes(this.state.displayType) &&
        !this.isSingleValueResponse(),
      showSaveAsCSVButton:
        TABLE_TYPES.includes(this.state.displayType) &&
        !this.isSingleValueResponse(),
      showSaveAsPNGButton: CHART_TYPES.includes(this.state.displayType),
      showInterpretationButton:
        this.props.response &&
        this.props.response.data &&
        this.props.response.data.data &&
        !!this.props.response.data.data.interpretation
    }

    // If there is nothing to put in the toolbar, don't render it
    if (
      !Object.values(shouldShowButton).find(showButton => showButton === true)
    ) {
      return null
    }

    if (
      this.props.isResponse &&
      this.props.type !== 'text' &&
      this.state.displayType !== 'help' &&
      this.state.displayType !== 'suggestion'
    ) {
      return (
        <div className="chat-message-toolbar right">
          {shouldShowButton.showFilterButton && (
            <button
              onClick={this.toggleTableFilter}
              className="chata-toolbar-btn"
              data-tip={
                this.state.isFilteringTable ? 'Stop Filtering' : 'Filter Table'
              }
              data-for="chata-toolbar-btn-tooltip"
            >
              <MdFilterList />
            </button>
          )}
          {shouldShowButton.showCopyButton && (
            <button
              onClick={this.copyTableToClipboard}
              className="chata-toolbar-btn"
              data-tip="Copy to Clipboard"
              data-for="chata-toolbar-btn-tooltip"
            >
              <MdContentCopy />
            </button>
          )}
          {shouldShowButton.showSaveAsCSVButton && (
            <button
              onClick={this.saveTableAsCSV}
              className="chata-toolbar-btn"
              data-tip="Download as CSV"
              data-for="chata-toolbar-btn-tooltip"
            >
              <MdFileDownload />
            </button>
          )}
          {shouldShowButton.showSaveAsPNGButton && (
            <button
              onClick={this.saveChartAsPNG}
              className="chata-toolbar-btn"
              data-tip="Download as PNG"
              data-for="chata-toolbar-btn-tooltip"
            >
              <MdFileDownload />
            </button>
          )}
          {shouldShowButton.showInterpretationButton && (
            <MdInfoOutline
              className="interpretation-icon"
              data-tip={this.renderInterpretationTip()}
              data-for="interpretation-tooltip"
            />
          )}
        </div>
      )
    }
    return null
  }

  showDisplayTypeButton = displayType => {
    return (
      this.responseRef &&
      this.responseRef.supportedDisplayTypes &&
      this.responseRef.supportedDisplayTypes.includes(displayType) &&
      this.state.displayType !== displayType
    )
  }

  createVisButton = (displayType, name, icon) => {
    if (this.showDisplayTypeButton(displayType)) {
      return (
        <button
          onClick={() => this.switchView(displayType)}
          className="chata-toolbar-btn"
          data-tip={name}
          data-for="chata-toolbar-btn-tooltip"
        >
          {icon}
        </button>
      )
    }
    return null
  }

  shouldMessageBeFullWidth = () => {
    return !!this.renderLeftToolbar()
  }

  renderLeftToolbar = () => {
    if (
      !this.responseRef ||
      !this.responseRef.supportedDisplayTypes ||
      this.responseRef.supportedDisplayTypes.length <= 1
    ) {
      return null
    }
    if (
      this.props.isResponse &&
      this.props.type !== 'text' &&
      this.state.displayType !== 'help' &&
      this.state.displayType !== 'suggestion'
    ) {
      return (
        <div className="chat-message-toolbar left">
          {this.createVisButton('table', 'Table', tableIcon)}
          {this.createVisButton('pivot_table', 'Pivot Table', pivotTableIcon)}
          {this.createVisButton('column', 'Column Chart', columnChartIcon)}
          {this.createVisButton('bar', 'Bar Chart', barChartIcon)}
          {this.createVisButton('line', 'Line Chart', lineChartIcon)}
          {this.createVisButton('pie', 'Pie Chart', pieChartIcon)}
          {this.createVisButton('heatmap', 'Heatmap', heatmapIcon)}
          {this.createVisButton('bubble', 'Bubble Chart', bubbleChartIcon)}
        </div>
      )
    }
    return null
  }

  render = () => {
    return (
      <Fragment>
        <div
          className={`chat-single-message-container
          ${this.props.isResponse ? ' response' : ' request'}
          ${this.state.isFilteringTable ? ' filtering-table' : ''}`}
        >
          <div
            className={`chat-message-bubble
            ${this.shouldMessageBeFullWidth() ? ' full-width' : ''}
            ${this.props.isActive ? ' active' : ''}`}
          >
            {this.renderContent()}
            {this.renderRightToolbar()}
            {this.renderLeftToolbar()}
          </div>
        </div>
      </Fragment>
    )
  }
}
