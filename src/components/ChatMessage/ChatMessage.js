import React, { Fragment } from 'react'
import PropTypes from 'prop-types'
import { MdContentCopy, MdFileDownload, MdFilterList } from 'react-icons/md'
import ReactTooltip from 'react-tooltip'
import uuid from 'uuid'

import { ResponseRenderer } from '../ResponseRenderer'

import { TABLE_TYPES, CHART_TYPES } from '../../js/Constants.js'
import { getNumberOfGroupables } from '../../js/Util.js'

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
    tableOptions: PropTypes.shape({})
  }

  static defaultProps = {
    setActiveMessage: () => {},
    displayType: undefined,
    response: undefined,
    content: undefined,
    isActive: false,
    type: 'text',
    text: null,
    tableOptions: undefined
  }

  state = {
    displayType: undefined,
    isFilteringTable: false
  }

  componentWillMount = () => {
    this.getSupportedDisplayTypes()
  }

  componentDidUpdate = () => {
    ReactTooltip.rebuild()
  }

  getSupportedDisplayTypes = () => {
    const { response } = this.props

    // These queries only have one display type option
    if (
      response &&
      response.data &&
      response.data.data &&
      (response.data.data.displayType === 'suggestion' ||
        response.data.data.displayType === 'unknown_words' ||
        response.data.data.displayType === 'help' ||
        response.data.data.displayType === 'forecasting')
    ) {
      this.setState({ displayType: response.data.data.displayType })
      return
    }

    const columns =
      response &&
      response.data &&
      response.data.data &&
      response.data.data.columns

    if (!columns) {
      return
    }

    if (getNumberOfGroupables(columns) === 1) {
      // Is direct key-value query (ie. Avg days to pay per customer)
      this.supportedDisplayTypes = [
        'bar',
        'column',
        // 'pie',
        'line',
        'table'
      ]

      // create pivot based on month and year
      if (columns[0].type === 'DATE') {
        this.supportedDisplayTypes.push('pivot_table')
      }
      // } else if (
      //   columns.length === 3
      //   // && !this.hasMultipleValuesPerLabel()
      // ) {
      //   // Is contrast query (ie. Total sales and gross profit per month)
      //   this.supportedDisplayTypes = [
      //     'contrast_line',
      //     'contrast_bar',
      //     'contrast_column',
      //     'table'
      //   ]
    } else if (getNumberOfGroupables(columns) === 2) {
      // Is pivot query (ie. Sale per customer per month)
      this.supportedDisplayTypes = [
        'multi_line',
        'stacked_bar',
        'stacked_column',
        'bubble',
        'heatmap',
        'table',
        'pivot_table'
      ]
    }

    // Default to table display type.
    this.setState({ displayType: 'table' })
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
          supportedDisplayTypes={this.supportedDisplayTypes}
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
          width={chartWidth}
          height={chartHeight}
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

  renderRightToolbar = () => {
    const shouldShowButton = {
      showFilterButton: TABLE_TYPES.includes(this.state.displayType),
      showCopyButton: TABLE_TYPES.includes(this.state.displayType),
      showSaveAsCSVButton: TABLE_TYPES.includes(this.state.displayType),
      showSaveAsPNGButton: CHART_TYPES.includes(this.state.displayType)
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
        </div>
      )
    }
    return null
  }

  showDisplayTypeButton = displayType => {
    return (
      this.supportedDisplayTypes.includes(displayType) &&
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

  renderLeftToolbar = () => {
    if (!this.supportedDisplayTypes || this.supportedDisplayTypes.length <= 1) {
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
            ${this.props.type !== 'text' ? ' full-width' : ''}
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
