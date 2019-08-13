import React, { Fragment } from 'react'
import PropTypes from 'prop-types'
import { MdContentCopy, MdFileDownload } from 'react-icons/md'
import ReactTooltip from 'react-tooltip'
import uuid from 'uuid'

import { ResponseRenderer } from '../ResponseRenderer'

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
    displayType: undefined
  }

  componentWillMount = () => {
    this.getSupportedDisplayTypes()
  }

  getSupportedDisplayTypes = () => {
    const { response } = this.props

    if (
      response &&
      response.data &&
      (response.data.display_type === 'suggestion' ||
        response.data.display_type === 'unknown_words' ||
        response.data.display_type === 'help')
    ) {
      this.setState({ displayType: response.data.display_type })
      return
    }
    const columns = response && response.data && response.data.columns

    if (!columns) {
      return
    }

    if (columns.length === 2) {
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
    } else if (
      columns.length === 3
      // && this.hasMultipleValuesPerLabel()
    ) {
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
    this.setState({ displayType: 'table' })
  }

  switchView = displayType => {
    this.setState({ displayType })
    // If its the last message, scroll to bottom.
    // There is a bug that makes it jump to the top if its the only message
    if (this.props.lastMessageId === this.props.id) {
      this.props.scrollToBottom()
    }
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
          width={chartWidth}
          height={chartHeight}
        />
      )
    }
    return 'Something went wrong.. this should never happen. Why did this happen?'
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

  renderRightToolbar = () => {
    const shouldShowButton = {
      showCopyButton: this.state.displayType === 'table',
      showSaveAsCSVButton: this.state.displayType === 'table'
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

  createDisplayTypeButton = (displayType, name, icon) => {
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
          {this.createDisplayTypeButton('table', 'Table', tableIcon)}
          {this.showDisplayTypeButton('pivot_table') && (
            <button
              onClick={() => this.switchView('pivot_table')}
              className="chata-toolbar-btn"
              data-tip="Pivot Table"
              data-for="chata-toolbar-btn-tooltip"
            >
              {pivotTableIcon}
            </button>
          )}
          {this.showDisplayTypeButton('column') && (
            <button
              onClick={() => this.switchView('column')}
              className="chata-toolbar-btn"
              data-tip="Column Chart"
              data-for="chata-toolbar-btn-tooltip"
            >
              {columnChartIcon}
            </button>
          )}
          {this.showDisplayTypeButton('bar') && (
            <button
              onClick={() => this.switchView('bar')}
              className="chata-toolbar-btn"
              data-tip="Bar Chart"
              data-for="chata-toolbar-btn-tooltip"
            >
              {barChartIcon}
            </button>
          )}
          {this.showDisplayTypeButton('line') && (
            <button
              onClick={() => this.switchView('line')}
              className="chata-toolbar-btn"
              data-tip="Line Chart"
              data-for="chata-toolbar-btn-tooltip"
            >
              {lineChartIcon}
            </button>
          )}
          {this.showDisplayTypeButton('pie') && (
            <button
              onClick={() => this.switchView('pie')}
              className="chata-toolbar-btn"
              data-tip="Pie Chart"
              data-for="chata-toolbar-btn-tooltip"
            >
              {pieChartIcon}
            </button>
          )}
          {this.showDisplayTypeButton('heatmap') && (
            <button
              onClick={() => this.switchView('heatmap')}
              className="chata-toolbar-btn"
              data-tip="Heatmap"
              data-for="chata-toolbar-btn-tooltip"
            >
              {heatmapIcon}
            </button>
          )}
          {this.showDisplayTypeButton('bubble') && (
            <button
              onClick={() => this.switchView('bubble')}
              className="chata-toolbar-btn"
              data-tip="Bubble Chart"
              data-for="chata-toolbar-btn-tooltip"
            >
              {bubbleChartIcon}
            </button>
          )}
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
          ${this.props.isResponse ? ' response' : ' request'}`}
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
          <ReactTooltip
            className="chata-drawer-tooltip"
            id="chata-toolbar-btn-tooltip"
            effect="solid"
            delayShow={800}
            html
          />
        </div>
      </Fragment>
    )
  }
}
