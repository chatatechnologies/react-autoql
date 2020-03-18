import React, { Fragment } from 'react'
import PropTypes from 'prop-types'
import _get from 'lodash.get'
import _cloneDeep from 'lodash.clonedeep'
import ReactTooltip from 'react-tooltip'

import {
  authenticationType,
  autoQLConfigType,
  dataFormattingType,
  themeConfigType
} from '../../props/types'

import {
  authenticationDefault,
  autoQLConfigDefault,
  dataFormattingDefault,
  themeConfigDefault
} from '../../props/defaults'

import { QueryOutput } from '../QueryOutput'
import { ColumnVisibilityModal } from '../ColumnVisibilityModal'
import { VizToolbar } from '../VizToolbar'
import { Icon } from '../Icon'

import { TABLE_TYPES, CHART_TYPES } from '../../js/Constants.js'
import { getDefaultDisplayType, isTableType, isChartType } from '../../js/Util'
import { setColumnVisibility } from '../../js/queryService'
import errorMessages from '../../js/errorMessages'

import './ChatMessage.scss'

export default class ChatMessage extends React.Component {
  supportedDisplayTypes = []
  filtering = false

  static propTypes = {
    authentication: authenticationType,
    autoQLConfig: autoQLConfigType,
    dataFormatting: dataFormattingType,
    themeConfig: themeConfigType,

    isResponse: PropTypes.bool.isRequired,
    lastMessageId: PropTypes.string.isRequired,
    setActiveMessage: PropTypes.func,
    isActive: PropTypes.bool,
    type: PropTypes.string,
    text: PropTypes.string,
    id: PropTypes.string.isRequired,
    displayType: PropTypes.string,
    onSuggestionClick: PropTypes.func.isRequired,
    response: PropTypes.shape({}),
    content: PropTypes.string,
    tableOptions: PropTypes.shape({}),
    enableColumnEditor: PropTypes.bool,
    dataFormatting: dataFormattingType,
    onErrorCallback: PropTypes.func
  }

  static defaultProps = {
    authentication: authenticationDefault,
    autoQLConfig: autoQLConfigDefault,
    dataFormatting: dataFormattingDefault,
    themeConfig: themeConfigDefault,

    setActiveMessage: () => {},
    onErrorCallback: () => {},
    displayType: undefined,
    response: undefined,
    content: undefined,
    isActive: false,
    type: 'text',
    text: null,
    tableOptions: undefined,
    enableColumnEditor: true
  }

  state = {
    displayType: getDefaultDisplayType(this.props.response),
    isSettingColumnVisibility: false
  }

  componentDidUpdate = (prevProps, prevState) => {
    ReactTooltip.rebuild()

    // We must explicitly set the message height in order to avoid scroll jumping
    // when message bubbles resize due to their content
    this.setMessageHeightCss(prevState)
  }

  setMessageHeightCss = prevState => {
    if (
      isTableType(this.state.displayType) &&
      isTableType(prevState.displayType) &&
      this.props.type !== 'text' &&
      !this.TABLE_CONTAINER_HEIGHT
    ) {
      const messageContainer = document.getElementById(
        `message-${this.props.id}`
      )
      this.TABLE_CONTAINER_HEIGHT = _get(messageContainer, 'clientHeight')
      messageContainer.style.height = `${this.TABLE_CONTAINER_HEIGHT}px`
    } else if (
      this.state.displayType !== prevState.displayType &&
      isChartType(this.state.displayType)
    ) {
      const messageContainer = document.getElementById(
        `message-${this.props.id}`
      )
      if (messageContainer) {
        messageContainer.style.height = 'unset'
        this.TABLE_CONTAINER_HEIGHT = undefined
      }
      this.forceUpdate()
    }
  }

  switchView = displayType => {
    this.filtering = false
    this.setState({ displayType })
  }

  onTableFilter = newTableData => {
    if (this.state.displayType === 'table') {
      // this shouldn't be affected when editing a pivot table
      this.setState({
        disableChartingOptions: _get(newTableData, 'length') < 2
      })
    }
  }

  renderContent = (chartWidth, chartHeight) => {
    const { response, content } = this.props
    if (content) {
      return content
    } else if (response) {
      return (
        <QueryOutput
          ref={ref => (this.responseRef = ref)}
          autoQLConfig={this.props.autoQLConfig}
          onDataClick={this.props.processDrilldown}
          queryResponse={response}
          displayType={this.state.displayType}
          onSuggestionClick={this.props.onSuggestionClick}
          isQueryRunning={this.props.isChataThinking}
          themeConfig={this.props.themeConfig}
          copyToClipboard={this.copyToClipboard}
          tableOptions={this.props.tableOptions}
          dataFormatting={this.props.dataFormatting}
          setFilterTagsCallback={this.setFilterTags}
          hideColumnCallback={this.hideColumnCallback}
          onTableFilterCallback={this.onTableFilter}
          height={chartHeight}
          width={chartWidth}
          demo={this.props.authentication.demo}
          backgroundColor={document.documentElement.style.getPropertyValue(
            '--chata-messenger-background-color'
          )}
          // We want to render our own in the parent component
          // so the tooltip doesn't get clipped by the drawer
          renderTooltips={false}
          onErrorCallback={this.props.onErrorCallback}
          enableColumnHeaderContextMenu={true}
        />
      )
    }
    return errorMessages.GENERAL_ERROR_MESSAGE
  }

  setFilterTags = ({ isFilteringTable } = {}) => {
    const tableRef =
      this.state.displayType === 'pivot_table'
        ? _get(this.responseRef, 'pivotTableRef.ref.table')
        : _get(this.responseRef, 'tableRef.ref.table')

    if (!tableRef) {
      return
    }

    const filterValues = tableRef.getHeaderFilters()
    if (filterValues) {
      filterValues.forEach(filter => {
        try {
          if (!isFilteringTable) {
            const filterTagEl = document.createElement('span')
            filterTagEl.innerText = 'F'
            filterTagEl.setAttribute('class', 'filter-tag')

            const columnTitleEl = document.querySelector(
              `#message-${this.props.id} .tabulator-col[tabulator-field="${filter.field}"] .tabulator-col-title`
            )
            columnTitleEl.insertBefore(filterTagEl, columnTitleEl.firstChild)
          } else if (isFilteringTable) {
            var filterTagEl = document.querySelector(
              `#message-${this.props.id} .tabulator-col[tabulator-field="${filter.field}"] .filter-tag`
            )
            if (filterTagEl) {
              filterTagEl.parentNode.removeChild(filterTagEl)
            }
          }
        } catch (error) {
          console.error(error)
          this.props.onErrorCallback(error)
        }
      })
    }
  }

  toggleTableFilter = () => {
    // We want to do this without updating the component for performance reasons
    // and so the component doesnt re-render and reset scroll values
    this.filtering = !this.filtering

    try {
      const filterHeaderElements = document.querySelectorAll(
        `#message-${this.props.id} .chata-table .tabulator-header-filter`
      )
      const colHeaderElements = document.querySelectorAll(
        `#message-${this.props.id} .chata-table .tabulator-col`
      )
      const messageElement = document.querySelector(
        `#message-${this.props.id}.response`
      )

      if (this.filtering) {
        messageElement.style.maxHeight = 'calc(85% + 35px)'
        filterHeaderElements.forEach(element => {
          element.style.display = 'inline-block'
        })
        colHeaderElements.forEach(element => {
          element.style.height = '72px !important'
        })
        this.setFilterTags({ isFilteringTable: true })
      } else {
        messageElement.style.maxHeight = '85%'
        filterHeaderElements.forEach(element => {
          element.style.display = 'none'
        })
        colHeaderElements.forEach(element => {
          element.style.height = '37px !important'
        })
        this.setFilterTags({ isFilteringTable: false })
      }
    } catch (error) {
      console.error(error)
      this.props.onErrorCallback(error)
    }
  }

  setTemporaryState = (key, value, duration) => {
    this.setState({ [key]: value })
    setTimeout(() => {
      this.setState({ [key]: undefined })
    }, duration)
  }

  // todo: put all right toolbar functions into separate component
  copyTableToClipboard = () => {
    if (this.responseRef) {
      this.responseRef.copyTableToClipboard()
      this.setTemporaryState('copiedTable', true, 1000)
      ReactTooltip.hide()
      // changeTooltipText(
      //   `chata-toolbar-btn-copy-tooltip-${this.props.id}`,
      //   'Copied!',
      //   32,
      //   1000
      // )
    } else {
      this.setTemporaryState('copiedTable', false, 1000)
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
      _get(response, 'data.data.rows.length') === 1 &&
      _get(response, 'data.data.rows[0].length') === 1
    )
  }

  renderInterpretationTip = () => {
    const interpretation = `<span>
        <strong>Interpretation: </strong>
        ${_get(this.props.response, 'data.data.interpretation')}
      </span>`

    let sql = ''
    // if (this.props.debug) {
    //   sql = `
    //     <br />
    //     <br />
    //     <span>
    //       <strong>SQL: </strong>
    //       ${_get(this.props.response, 'data.data.sql')}
    //     </span>`
    // }
    return `<div>
        ${interpretation}
        ${sql}
      </div>`
  }

  hideColumnCallback = column => {
    if (!column) {
      return
    }

    const columnDefinition = column.getDefinition()
    setColumnVisibility({
      ...this.props.authentication,
      columns: [
        {
          name: columnDefinition.name,
          is_visible: false
        }
      ]
    })
      .then(() => {
        column.hide()
      })
      .catch(error => {
        console.error(error)
        this.props.onErrorCallback(error)
        this.setState({ isSettingColumnVisibility: false })
      })
  }

  showHideColumnsModal = () =>
    this.setState({ isHideColumnsModalVisible: true })

  onColumnVisibilitySave = columns => {
    const { authentication } = this.props
    const formattedColumns = columns.map(col => {
      return {
        name: col.name,
        is_visible: col.visible
      }
    })

    this.setState({ isSettingColumnVisibility: true })
    setColumnVisibility({ ...authentication, columns: formattedColumns })
      .then(() => {
        const tableRef = _get(this.responseRef, 'tableRef.ref.table')
        if (tableRef) {
          const columnComponents = tableRef.getColumns()
          columnComponents.forEach(component => {
            const id = component.getDefinition().id
            const isVisible = columns.find(col => col.id === id).visible
            if (isVisible) {
              component.show()
            } else {
              component.hide()
            }
          })
        }

        this.setState({
          isHideColumnsModalVisible: false,
          isSettingColumnVisibility: false
        })
      })
      .catch(error => {
        console.error(error)
        this.props.onErrorCallback(error)
        this.setState({ isSettingColumnVisibility: false })
      })
  }

  deleteMessage = () => {
    ReactTooltip.hide()
    this.props.deleteMessageCallback(this.props.id)
  }

  copySQL = () => {
    const sql = _get(this.props.response, 'data.data.sql')
    const el = document.createElement('textarea')
    el.value = sql
    document.body.appendChild(el)
    el.select()
    document.execCommand('copy')
    document.body.removeChild(el)
    this.setTemporaryState('copiedSQL', true, 1000)
    ReactTooltip.hide()
    // changeTooltipText(
    //   `chata-toolbar-btn-copy-sql-tooltip-${this.props.id}`,
    //   'Copied!',
    //   32,
    //   1000
    // )
  }

  renderHideColumnsModal = () => {
    const tableRef = _get(this.responseRef, 'tableRef.ref.table')

    if (!tableRef) {
      return
    }

    const columns = tableRef.getColumns().map(col => {
      return {
        ...col.getDefinition(),
        visible: col.getVisibility() // for some reason this doesn't get updated when .hide() or .show() are called, so we are manually updating it here
      }
    })

    return (
      <ColumnVisibilityModal
        columns={columns}
        isVisible={this.state.isHideColumnsModalVisible}
        onClose={() => this.setState({ isHideColumnsModalVisible: false })}
        isSettingColumns={this.state.isSettingColumnVisibility}
        onConfirm={this.onColumnVisibilitySave}
      />
    )
  }

  renderRightToolbar = () => {
    const shouldShowButton = {
      showFilterButton:
        TABLE_TYPES.includes(this.state.displayType) &&
        !this.isSingleValueResponse() &&
        _get(this.props, 'response.data.data.rows.length') > 1,
      showCopyButton:
        TABLE_TYPES.includes(this.state.displayType) &&
        !this.isSingleValueResponse() &&
        !!_get(this.props, 'response.data.data.rows.length'),
      showSaveAsCSVButton:
        TABLE_TYPES.includes(this.state.displayType) &&
        !this.isSingleValueResponse() &&
        !!_get(this.props, 'response.data.data.rows.length'),
      showSaveAsPNGButton: CHART_TYPES.includes(this.state.displayType),
      showInterpretationButton: !!_get(
        this.props,
        'response.data.data.interpretation'
      ),
      showHideColumnsButton:
        this.props.autoQLConfig.enableColumnEditor &&
        // getNumberOfGroupables(
        //   _get(this.props, 'response.data.data.columns')
        // ) === 0 &&
        this.state.displayType === 'table' &&
        !this.props.authentication.demo &&
        _get(this.props, 'response.data.data.columns.length') > 1,
      showSQLButton:
        this.props.autoQLConfig.debug &&
        _get(this.props, 'response.data.data.display_type') === 'data',
      showDeleteButton: true
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
              data-tip="Filter table"
              data-for="chata-toolbar-btn-tooltip"
            >
              <Icon type="filter" />
            </button>
          )}
          {shouldShowButton.showHideColumnsButton && (
            <button
              onClick={this.showHideColumnsModal}
              className="chata-toolbar-btn"
              data-tip="Show/hide columns"
              data-for="chata-toolbar-btn-tooltip"
            >
              <Icon type="eye" />
            </button>
          )}
          {shouldShowButton.showCopyButton && (
            <button
              onClick={this.copyTableToClipboard}
              className={`chata-toolbar-btn${
                this.state.copiedTable === true ? ' green' : ''
              }${this.state.copiedTable === false ? ' red' : ''}`}
              data-tip="Copy table to clipboard"
              data-for={`chata-toolbar-btn-copy-tooltip-${this.props.id}`}
            >
              <Icon type="copy" />
            </button>
          )}
          {shouldShowButton.showSaveAsCSVButton && (
            <button
              onClick={this.saveTableAsCSV}
              className="chata-toolbar-btn"
              data-tip="Download as CSV"
              data-for="chata-toolbar-btn-tooltip"
            >
              <Icon type="download" />
            </button>
          )}
          {shouldShowButton.showSaveAsPNGButton && (
            <button
              onClick={this.saveChartAsPNG}
              className="chata-toolbar-btn"
              data-tip="Download as PNG"
              data-for="chata-toolbar-btn-tooltip"
            >
              <Icon type="download" />
            </button>
          )}
          {shouldShowButton.showInterpretationButton && (
            <Icon
              type="info"
              className="interpretation-icon"
              data-tip={this.renderInterpretationTip()}
              data-for="interpretation-tooltip"
            />
          )}
          {shouldShowButton.showSQLButton && (
            <button
              onClick={this.copySQL}
              className={`chata-toolbar-btn${
                this.state.copiedSQL === true ? ' green' : ''
              }${this.state.copiedSQL === false ? ' red' : ''}`}
              data-tip="Copy generated query to clipboard"
              data-for={`chata-toolbar-btn-copy-sql-tooltip-${this.props.id}`}
            >
              <Icon type="database" />
            </button>
          )}
          {shouldShowButton.showDeleteButton && (
            <button
              onClick={this.deleteMessage}
              className="chata-toolbar-btn"
              data-tip="Delete data response"
              data-for="chata-toolbar-btn-tooltip"
            >
              <Icon type="trash" />
            </button>
          )}
        </div>
      )
    }
    return null
  }

  renderLeftToolbar = () => {
    const supportedDisplayTypes =
      this.responseRef && this.responseRef.supportedDisplayTypes

    let displayType = this.state.displayType
    if (
      supportedDisplayTypes &&
      !supportedDisplayTypes.includes(this.state.displayType)
    ) {
      displayType = 'table'
    }

    if (this.props.isResponse && this.props.type !== 'text') {
      return (
        <VizToolbar
          className="chat-message-toolbar left"
          supportedDisplayTypes={supportedDisplayTypes || []}
          displayType={displayType}
          onDisplayTypeChange={this.switchView}
          disableCharts={this.state.disableChartingOptions}
        />
      )
    }
    return null
  }

  getChartDimensions = () => {
    let chartWidth = 0
    let chartHeight = 0
    const chatContainer = document.querySelector('.chat-message-container')

    if (chatContainer) {
      chartWidth = chatContainer.clientWidth - 70 // 100% of chat width minus message margins minus chat container margins
      chartHeight = 0.85 * chatContainer.clientHeight - 40 // 88% of chat height minus message margins
    }

    if (this.state.displayType === 'pie' && chartHeight > 330) {
      chartHeight = 330
    }

    return { chartWidth, chartHeight }
  }

  getMessageHeight = () => {
    let messageHeight = 'unset'
    if (isTableType(this.state.displayType) && this.props.type !== 'text') {
      messageHeight = this.TABLE_CONTAINER_HEIGHT || 'unset'
    }

    return messageHeight
  }

  render = () => {
    const { chartWidth, chartHeight } = this.getChartDimensions()
    const messageHeight = this.getMessageHeight()

    return (
      <Fragment>
        <div
          id={`message-${this.props.id}`}
          className={`chat-single-message-container
          ${this.props.isResponse ? ' response' : ' request'}`}
          style={{
            maxHeight: chartHeight ? chartHeight + 30 : '85%',
            height: messageHeight
          }}
          data-test="chat-message"
        >
          <div
            className={`chat-message-bubble
            ${CHART_TYPES.includes(this.state.displayType) ? ' full-width' : ''}
            ${this.props.type === 'text' ? ' text' : ''}
            ${this.props.isActive ? ' active' : ''}`}
          >
            {this.renderContent(chartWidth, chartHeight)}
            {this.renderRightToolbar()}
            {this.renderLeftToolbar()}
            {this.renderHideColumnsModal()}
            <ReactTooltip
              className="chata-drawer-tooltip"
              id={`chata-toolbar-btn-copy-tooltip-${this.props.id}`}
              effect="solid"
              delayShow={500}
              html
            />
            <ReactTooltip
              className="chata-drawer-tooltip"
              id={`chata-toolbar-btn-copy-sql-tooltip-${this.props.id}`}
              effect="solid"
              delayShow={500}
              html
            />
          </div>
        </div>
      </Fragment>
    )
  }
}
