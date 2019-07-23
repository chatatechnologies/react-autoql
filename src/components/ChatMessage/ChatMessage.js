import React, { Fragment } from 'react'
import PropTypes from 'prop-types'
import { MdContentCopy, MdFileDownload } from 'react-icons/md'
import { FaChartBar, FaTable } from 'react-icons/fa'
import ReactTooltip from 'react-tooltip'
import uuid from 'uuid'

import { ResponseRenderer } from '../ResponseRenderer'

import barChartIconSVG from '../../images/icon-bar-chart.svg'
import columnChartIconSVG from '../../images/icon-column-chart.svg'
import lineChartIconSVG from '../../images/icon-line-chart.svg'

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
      this.supportedDisplayTypes = ['bar', 'column', 'pie', 'line', 'table']
    } else if (
      columns.length === 3
      // && !this.hasMultipleValuesPerLabel()
    ) {
      // Is contrast query (ie. Total sales and gross profit per month)
      this.supportedDisplayTypes = [
        'contrast_line',
        'contrast_bar',
        'contrast_column',
        'table'
      ]
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
        chartHeight = 0.88 * chatContainer.clientHeight - 20 // 88% of chat height minus message margins
      }

      return (
        <ResponseRenderer
          ref={ref => (this.responseRef = ref)}
          key={uuid.v4()}
          supportedDisplayTypes={this.supportedDisplayTypes}
          processDrilldown={this.props.processDrilldown}
          response={response}
          displayType={this.state.displayType}
          isDrilldownDisabled={!!response.isDrilldownDisabled}
          onSuggestionClick={this.props.onSuggestionClick}
          isQueryRunning={this.props.isChataThinking}
          tableBorderColor={this.props.tableBorderColor}
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
          {this.showDisplayTypeButton('table') && (
            <button
              onClick={() => this.switchView('table')}
              className="chata-toolbar-btn"
              data-tip="Table"
              data-for="chata-toolbar-btn-tooltip"
            >
              <svg
                x="0px"
                y="0px"
                width="16px"
                height="16px"
                viewBox="0 0 16 16"
              >
                <path
                  className="chart-icon-svg-0"
                  d="M8,0.8c2.3,0,4.6,0,6.9,0c0.8,0,1.1,0.3,1.1,1.1c0,4,0,7.9,0,11.9c0,0.8-0.3,1.1-1.1,1.1c-4.6,0-9.3,0-13.9,0
c-0.7,0-1-0.3-1-1c0-4,0-8,0-12c0-0.7,0.3-1,1-1C3.4,0.8,5.7,0.8,8,0.8L8,0.8z M5,11.1H1v2.7h4V11.1L5,11.1z M10,13.8v-2.7H6v2.7
L10,13.8L10,13.8z M11,13.8h4v-2.7h-4V13.8L11,13.8z M1.1,7.5v2.7h4V7.5H1.1L1.1,7.5z M11,10.2c1.3,0,2.5,0,3.8,0
c0.1,0,0.2-0.1,0.2-0.2c0-0.8,0-1.7,0-2.5h-4C11,8.4,11,9.3,11,10.2L11,10.2z M6,10.1h4V7.5H6V10.1L6,10.1z M5,6.6V3.9H1
c0,0.8,0,1.6,0,2.4c0,0.1,0.2,0.2,0.3,0.2C2.5,6.6,3.7,6.6,5,6.6L5,6.6z M6,6.5h4V3.9H6V6.5L6,6.5z M14.9,6.5V3.9h-4v2.7L14.9,6.5
L14.9,6.5z"
                />
              </svg>
            </button>
          )}
          {this.showDisplayTypeButton('column') && (
            <button
              onClick={() => this.switchView('column')}
              className="chata-toolbar-btn"
              data-tip="Column Chart"
              data-for="chata-toolbar-btn-tooltip"
            >
              {
                // import from file
                <svg
                  x="0px"
                  y="0px"
                  width="16px"
                  height="16px"
                  viewBox="0 0 16 16"
                >
                  <path
                    // fill="currentColor"
                    className="chart-icon-svg-0"
                    d="M12.6,0h-2.4C9.4,0,8.8,0.6,8.8,1.4v2.7c0,0,0,0,0,0H6.3c-0.8,0-1.4,0.6-1.4,1.4v3.2c0,0-0.1,0-0.1,0H2.4
                    C1.6,8.7,1,9.4,1,10.1v4.5C1,15.4,1.6,16,2.4,16h2.4c0,0,0.1,0,0.1,0h1.3c0,0,0.1,0,0.1,0h2.4c0,0,0.1,0,0.1,0H10c0,0,0.1,0,0.1,0
                    h2.4c0.8,0,1.4-0.6,1.4-1.4V1.4C14,0.6,13.3,0,12.6,0z M6.3,5.5h2.4v9.1H6.3V5.5z M2.4,10.1h2.4v4.5H2.4V10.1z M12.6,14.6h-2.4V1.4
                    h2.4V14.6z"
                  />
                </svg>
              }
            </button>
          )}
          {this.showDisplayTypeButton('bar') && (
            <button
              onClick={() => this.switchView('bar')}
              className="chata-toolbar-btn"
              data-tip="Bar Chart"
              data-for="chata-toolbar-btn-tooltip"
            >
              <svg
                x="0px"
                y="0px"
                width="16px"
                height="16px"
                viewBox="0 0 16 16"
              >
                <path
                  // fill="currentColor"
                  className="chart-icon-svg-0"
                  d="M14.6,1.6H1.4C0.6,1.6,0,2.2,0,3v2.4v0.1v1.2v0.1v2.4v0.1v1.3v0.1v2.4c0,0.8,0.6,1.4,1.4,1.4h4.5
                  c0.7,0,1.4-0.6,1.4-1.4v-2.4v-0.1h3.2c0.8,0,1.4-0.6,1.4-1.4V6.7l0,0h2.7c0.8,0,1.4-0.6,1.4-1.4V2.9C16,2.2,15.4,1.5,14.6,1.6z
                   M1.4,9.2V6.8h9.1v2.4H1.4z M1.4,13.1v-2.4h4.5v2.4H1.4z M14.6,2.9v2.4H1.4V2.9H14.6z"
                />
              </svg>
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
