import React, { Fragment } from 'react'
import PropTypes from 'prop-types'
import _get from 'lodash.get'
import _cloneDeep from 'lodash.clonedeep'
import ReactTooltip from 'react-tooltip'
import Popover from 'react-tiny-popover'
import uuid from 'uuid'

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
import { Modal } from '../Modal'

import { TABLE_TYPES, CHART_TYPES, MAX_ROW_LIMIT } from '../../js/Constants.js'
import {
  getDefaultDisplayType,
  isTableType,
  isChartType,
  getSupportedDisplayTypes
} from '../../js/Util'
import { setColumnVisibility, reportProblem } from '../../js/queryService'
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
    enableColumnVisibilityManager: PropTypes.bool,
    dataFormatting: dataFormattingType,
    onErrorCallback: PropTypes.func,
    onSuccessAlert: PropTypes.func
  }

  static defaultProps = {
    authentication: authenticationDefault,
    autoQLConfig: autoQLConfigDefault,
    dataFormatting: dataFormattingDefault,
    themeConfig: themeConfigDefault,

    setActiveMessage: () => {},
    onErrorCallback: () => {},
    onSuccessAlert: () => {},
    displayType: undefined,
    response: undefined,
    content: undefined,
    isActive: false,
    type: 'text',
    text: null,
    tableOptions: undefined,
    enableColumnVisibilityManager: true
  }

  state = {
    displayType: getDefaultDisplayType(this.props.response),
    isSettingColumnVisibility: false,
    activeMenu: undefined
  }

  componentDidMount = () => {
    setTimeout(() => {
      this.setTableMessageHeights()
      this.forceUpdate()
    }, 0)
  }

  componentDidUpdate = (prevProps, prevState) => {
    ReactTooltip.hide()
  }

  setTableMessageHeights = () => {
    // We must explicitly set the height for tables, to avoid scroll jumping due to dynamic resizing
    this.TABLE_CONTAINER_HEIGHT = this.getHeightOfTableFromRows(
      _get(this.responseRef, 'numberOfTableRows')
    )
    this.PIVOT_TABLE_CONTAINER_HEIGHT = this.getHeightOfTableFromRows(
      _get(this.responseRef, 'numberOfPivotTableRows')
    )
  }

  getHeightOfTableFromRows = rows => {
    // This is hacky but it eliminates the jumpy bug
    // 39px per row, 81px leftover for padding and headers
    return rows * 39 + 81
  }

  isScrolledIntoView = elem => {
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
    setTimeout(() => {
      const element = document.getElementById(`message-${this.props.id}`)

      if (!this.isScrolledIntoView(element)) {
        element.scrollIntoView({
          block: 'end',
          inline: 'nearest',
          behavior: 'smooth'
        })
        // If it didnt work the first time, it probably needs slightly more time
        setTimeout(() => {
          element.scrollIntoView({
            block: 'end',
            inline: 'nearest',
            behavior: 'smooth'
          })
        }, 300)
      }
    }, 0)
  }

  switchView = displayType => {
    this.filtering = false
    this.setState({ displayType }, this.scrollIntoView)
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
    const { response, content, type } = this.props
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
        messageElement.style.height = `${messageElement.offsetHeight + 35}px`
        filterHeaderElements.forEach(element => {
          element.style.display = 'inline-block'
        })

        colHeaderElements.forEach(element => {
          element.style.height = '72px !important'
        })
        this.setFilterTags({ isFilteringTable: true })
        this.scrollIntoView()
      } else {
        messageElement.style.maxHeight = '85%'
        messageElement.style.height = `${messageElement.offsetHeight - 35}px`
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
      this.props.onSuccessAlert('Successfully copied table to clipboard!')
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

  isTableResponse = () => {
    return (
      this.props.isResponse &&
      !this.isSingleValueResponse() &&
      this.props.type !== 'text' &&
      _get(this.props.response, 'data.data.rows.length', 0) > 0 &&
      isTableType(this.state.displayType)
    )
  }

  renderInterpretationTip = () => {
    const interpretation = `<span>
        <strong>Interpretation: </strong>
        ${_get(this.props.response, 'data.data.interpretation')}
      </span>`

    return `<div>
        ${interpretation}
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

  showHideColumnsModal = () => {
    this.setState({ isHideColumnsModalVisible: true })
  }

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
          columnComponents.forEach((component, index) => {
            const id = component.getDefinition().id
            const isVisible = columns.find(col => col.id === id).visible
            if (isVisible) {
              component.show()
            } else {
              component.hide()
            }

            if (_get(this.responseRef, `tableColumns[${index}]`)) {
              this.responseRef.tableColumns[index].visible = isVisible
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
    this.props.onSuccessAlert(
      'Successfully copied generated query to clipboard!'
    )
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

    let columns = []
    if (tableRef) {
      columns = tableRef.getColumns().map(col => {
        return {
          ...col.getDefinition(),
          visible: col.getVisibility() // for some reason this doesn't get updated when .hide() or .show() are called, so we are manually updating it here
        }
      })
    }

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

  renderReportProblemModal = () => {
    return (
      <Modal
        isVisible={this.state.activeMenu === 'other-problem'}
        onClose={() => {
          this.setState({ activeMenu: undefined })
        }}
        onConfirm={() => this.reportQueryProblem()}
        confirmLoading={this.state.isReportingProblem}
        title="Report a Problem"
        enableBodyScroll={true}
        width={600}
        confirmText="Report"
      >
        Please tell us more about the problem you are experiencing:
        <textarea className="report-problem-text-area" />
      </Modal>
    )
  }

  reportQueryProblem = reason => {
    const queryId = _get(this.props, 'response.data.data.query_id')
    this.setState({ isReportingProblem: true })
    reportProblem({ queryId, ...this.props.authentication })
      .then(() => {
        this.props.onSuccessAlert('Thank you for your feedback.')
        this.setState({ activeMenu: undefined, isReportingProblem: false })
      })
      .catch(error => {
        this.props.onErrorCallback(error)
        this.setState({ isReportingProblem: false })
      })
  }

  renderReportProblemMenu = () => {
    return (
      <div className="report-problem-menu">
        <ul className="context-menu-list">
          <li
            onClick={() => {
              this.setState({ activeMenu: undefined })
              this.reportQueryProblem('The data is incorrect')
            }}
          >
            The data is incorrect
          </li>
          <li
            onClick={() => {
              this.setState({ activeMenu: undefined })
              this.reportQueryProblem('The data is incomplete')
            }}
          >
            The data is incomplete
          </li>
          <li onClick={() => this.setState({ activeMenu: 'other-problem' })}>
            Other...
          </li>
        </ul>
      </div>
    )
  }

  renderMoreOptionsMenu = (props, shouldShowButton) => {
    return (
      <div className="more-options-menu">
        <ul className="context-menu-list">
          {shouldShowButton.showSaveAsCSVButton && (
            <li
              onClick={() => {
                this.setState({ activeMenu: undefined })
                this.saveTableAsCSV()
              }}
            >
              <Icon type="download" /> Download as CSV
            </li>
          )}
          {shouldShowButton.showSaveAsPNGButton && (
            <li
              onClick={() => {
                this.setState({ activeMenu: undefined })
                this.saveChartAsPNG()
              }}
            >
              <Icon type="download" /> Download as PNG
            </li>
          )}
          {shouldShowButton.showCopyButton && (
            <li
              onClick={() => {
                this.setState({ activeMenu: undefined })
                this.copyTableToClipboard()
              }}
              // className={`chata-toolbar-btn${
              //   this.state.copiedTable === true ? ' green' : ''
              // }${this.state.copiedTable === false ? ' red' : ''}`}
              // data-tip="Copy table to clipboard"
              // data-for={`chata-toolbar-btn-copy-tooltip-${this.props.id}`}
            >
              <Icon type="copy" /> Copy table to clipboard
            </li>
          )}
          {shouldShowButton.showSQLButton && (
            <li
              onClick={() => {
                this.setState({ activeMenu: undefined })
                this.copySQL()
              }}
              // className={`chata-toolbar-btn${
              //   this.state.copiedSQL === true ? ' green' : ''
              // }${this.state.copiedSQL === false ? ' red' : ''}`}
              // data-tip="Copy generated query to clipboard"
              // data-for={`chata-toolbar-btn-copy-sql-tooltip-${this.props.id}`}
            >
              <Icon type="copy" /> Copy generated query to clipboard
            </li>
          )}
        </ul>
      </div>
    )
  }

  renderRightToolbar = () => {
    const shouldShowButton = {
      showFilterButton:
        this.isTableResponse() &&
        _get(this.props, 'response.data.data.rows.length') > 1,
      showCopyButton:
        this.isTableResponse() &&
        !!_get(this.props, 'response.data.data.rows.length'),
      showSaveAsCSVButton:
        this.isTableResponse() &&
        !!_get(this.props, 'response.data.data.rows.length'),
      showSaveAsPNGButton: CHART_TYPES.includes(this.state.displayType),
      showHideColumnsButton:
        this.props.autoQLConfig.enableColumnVisibilityManager &&
        this.isTableResponse() &&
        this.state.displayType !== 'pivot_table' &&
        !this.props.authentication.demo &&
        _get(this.props, 'response.data.data.columns.length') > 0,
      showSQLButton:
        this.props.autoQLConfig.debug &&
        _get(this.props, 'response.data.data.display_type') === 'data',
      showDeleteButton: true,
      showMoreOptionsButton: true,
      showReportProblemButton:
        _get(this.props, 'response.data.data.display_type') === 'data'
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
        <div
          className={`chat-message-toolbar right ${
            this.state.activeMenu ? 'active' : ''
          }`}
        >
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
          {shouldShowButton.showReportProblemButton && (
            <Popover
              key={uuid.v4()}
              isOpen={this.state.activeMenu === 'report-problem'}
              padding={8}
              onClickOutside={() => {
                this.setState({ activeMenu: undefined })
              }}
              position="bottom" // preferred position
              content={props => this.renderReportProblemMenu(props)}
            >
              <button
                onClick={() => {
                  this.setState({ activeMenu: 'report-problem' })
                }}
                className="chata-toolbar-btn"
                data-tip="Report a problem"
                data-for="chata-toolbar-btn-tooltip"
              >
                <Icon type="warning-triangle" />
              </button>
            </Popover>
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
          {shouldShowButton.showMoreOptionsButton && (
            <Popover
              key={uuid.v4()}
              isOpen={this.state.activeMenu === 'more-options'}
              position="bottom"
              padding={8}
              onClickOutside={() => {
                this.setState({ activeMenu: undefined })
              }}
              content={props =>
                this.renderMoreOptionsMenu(props, shouldShowButton)
              }
            >
              <button
                onClick={() => {
                  ReactTooltip.hide()
                  this.setState({ activeMenu: 'more-options' })
                }}
                className="chata-toolbar-btn"
                data-tip="More options"
                data-for="chata-toolbar-btn-tooltip"
              >
                <Icon type="more" />
              </button>
            </Popover>
          )}
        </div>
      )
    }
    return null
  }

  renderLeftToolbar = () => {
    // Use QueryOutputs supported display types if possible,
    // they may have been updated because of certain errors
    let supportedDisplayTypes = getSupportedDisplayTypes(this.props.response)
    if (_get(this.responseRef, 'supportedDisplayTypes.length')) {
      supportedDisplayTypes = _get(this.responseRef, 'supportedDisplayTypes')
    }

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

    if (
      this.state.displayType === 'table' &&
      this.isTableResponse() &&
      this.TABLE_CONTAINER_HEIGHT
    ) {
      messageHeight = this.TABLE_CONTAINER_HEIGHT
    } else if (
      this.state.displayType === 'pivot_table' &&
      this.isTableResponse() &&
      this.PIVOT_TABLE_CONTAINER_HEIGHT
    ) {
      messageHeight = this.PIVOT_TABLE_CONTAINER_HEIGHT
    }

    return messageHeight
  }

  renderDataLimitWarning = () => {
    if (_get(this.props, 'response.data.data.rows.length') === MAX_ROW_LIMIT) {
      return (
        <Icon
          type="warning"
          className="data-limit-warning-icon"
          data-tip="The display limit for your data has been reached. Try querying a smaller time-frame to ensure all your data is displayed."
          data-for="chart-element-tooltip"
        />
      )
    }
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
            style={{
              minWidth: this.isTableResponse() ? '300px' : undefined
            }}
          >
            {this.renderContent(chartWidth, chartHeight)}
            {this.renderRightToolbar()}
            {this.renderLeftToolbar()}
            {this.renderHideColumnsModal()}
            {this.renderReportProblemModal()}
            {this.renderDataLimitWarning()}
          </div>
        </div>
      </Fragment>
    )
  }
}
