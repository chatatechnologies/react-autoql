import React, { Fragment } from 'react'
import PropTypes from 'prop-types'
import { MdContentCopy, MdFileDownload } from 'react-icons/md'
import { FaChartBar, FaTable } from 'react-icons/fa'
import ReactTooltip from 'react-tooltip'

import { ResponseRenderer } from '../ResponseRenderer'

export default class ChatMessage extends React.Component {
  static propTypes = {
    isResponse: PropTypes.bool.isRequired,
    setActiveMessage: PropTypes.func,
    isActive: PropTypes.bool,
    type: PropTypes.string,
    text: PropTypes.string,
    id: PropTypes.string.isRequired,
    displayType: PropTypes.string,
    tableBorderColor: PropTypes.string.isRequired,
    onSuggestionClick: PropTypes.func.isRequired,
    supportedDisplayTypes: PropTypes.arrayOf(PropTypes.string),
    response: PropTypes.shape({}),
    content: PropTypes.string,
    tableOptions: PropTypes.shape({})
  }

  static defaultProps = {
    setActiveMessage: () => {},
    supportedDisplayTypes: [],
    displayType: undefined,
    response: undefined,
    content: undefined,
    isActive: false,
    type: 'text',
    text: null,
    tableOptions: undefined
  }

  state = {
    displayType: this.props.displayType
  }

  componentDidMount = () => {
    this.getSupportedDisplayTypes()
  }

  getSupportedDisplayTypes = () => {
    // Eventually we will have to calculate this on the FE
    const { response } = this.props
    if (response && response.data && response.data.supported_display_types) {
      this.supportedDisplayTypes = response.data.supported_display_types
    }
  }

  switchView = displayType => {
    this.setState({ displayType })
    // If its the last message, scroll to bottom.
    // There is some bug that makes it jumpy if its the only message
    // this.props.scrollToBottom()
  }

  renderContent = () => {
    const { response, content } = this.props
    if (content) {
      return content
    } else if (response) {
      return (
        <ResponseRenderer
          ref={ref => (this.responseRef = ref)}
          supportedDisplayTypes={this.supportedDisplayTypes}
          processDrilldown={this.props.processDrilldown}
          response={response}
          displayType={this.state.displayType}
          isDrilldownDisabled={!!response.isDrilldownDisabled}
          onSuggestionClick={suggestion =>
            this.props.onSuggestionClick(suggestion)
          }
          isQueryRunning={this.props.isChataThinking}
          tableBorderColor={this.props.tableBorderColor}
          copyToClipboard={this.copyToClipboard}
          tableOptions={this.props.tableOptions}
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
    if (
      this.props.isResponse &&
      this.props.type !== 'text' &&
      this.props.displayType !== 'help' &&
      this.props.displayType !== 'suggestion'
    ) {
      return (
        <div className="chat-message-toolbar right">
          <button
            onClick={this.copyTableToClipboard}
            className="chata-toolbar-btn"
            data-tip="Copy to Clipboard"
            data-for="chata-toolbar-btn-tooltip"
          >
            <MdContentCopy />
          </button>
          <button
            onClick={this.saveTableAsCSV}
            className="chata-toolbar-btn"
            data-tip="Download as CSV"
            data-for="chata-toolbar-btn-tooltip"
          >
            <MdFileDownload />
          </button>
          <ReactTooltip
            className="chata-drawer-tooltip"
            id="chata-toolbar-btn-tooltip"
            effect="solid"
            delayShow={800}
          />
        </div>
      )
    }
    return null
  }

  renderLeftToolbar = () => {
    if (
      this.props.isResponse &&
      this.props.type !== 'text' &&
      this.props.displayType !== 'help' &&
      this.props.displayType !== 'suggestion'
    ) {
      return (
        <div className="chat-message-toolbar left">
          <button
            onClick={() => this.switchView('table')}
            className="chata-toolbar-btn"
            data-tip="Table"
            data-for="chata-toolbar-btn-tooltip"
          >
            <FaTable />
          </button>
          <button
            onClick={() => this.switchView('column')}
            className="chata-toolbar-btn"
            data-tip="Chart"
            data-for="chata-toolbar-btn-tooltip"
          >
            <FaChartBar />
          </button>
          <ReactTooltip
            className="chata-drawer-tooltip"
            id="chata-toolbar-btn-tooltip"
            effect="solid"
            delayShow={800}
          />
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
        </div>
      </Fragment>
    )
  }
}
