import React, { Fragment } from 'react'
import PropTypes from 'prop-types'
import Popover from 'react-tiny-popover'
import uuid from 'uuid'
import _get from 'lodash.get'
import ReactTooltip from 'react-tooltip'
import sqlFormatter from 'sql-formatter'

import { Icon } from '../Icon'
import { ColumnVisibilityModal } from '../ColumnVisibilityModal'
import { NotificationModal } from '../Notifications'
import { QueryOutput } from '../QueryOutput'
import { Modal } from '../Modal'
import { SendToSlackModal } from '../SendToSlackModal'
import { SendToTeamsModal } from '../SendToTeamsModal'
import { Button } from '../Button'

import { setColumnVisibility, reportProblem } from '../../js/queryService'
import { CHART_TYPES } from '../../js/Constants.js'
import { isTableResponse, setCSSVars } from '../../js/Util'
import {
  autoQLConfigType,
  authenticationType,
  themeConfigType,
} from '../../props/types'
import {
  autoQLConfigDefault,
  authenticationDefault,
  themeConfigDefault,
} from '../../props/defaults'

import './OptionsToolbar.scss'

export default class Input extends React.Component {
  static propTypes = {
    authentication: authenticationType,
    autoQLConfig: autoQLConfigType,
    themeConfig: themeConfigType,

    responseRef: PropTypes.instanceOf(QueryOutput),
    enableDeleteBtn: PropTypes.bool,
    onSuccessAlert: PropTypes.func,
    onErrorCallback: PropTypes.func,
    onNewNotificationCallback: PropTypes.func,
    deleteMessageCallback: PropTypes.func,
    onFilterCallback: PropTypes.func,
  }

  static defaultProps = {
    authentication: authenticationDefault,
    autoQLConfig: autoQLConfigDefault,
    themeConfig: themeConfigDefault,

    responseRef: undefined,
    enableDeleteBtn: false,
    onSuccessAlert: () => {},
    onErrorCallback: () => {},
    onNewNotificationCallback: () => {},
    deleteMessageCallback: () => {},
    onFilterCallback: () => {},
    onColumnVisibilitySave: () => {},
  }

  state = { isHideColumnsModalVisible: false, isSettingColumnVisibility: false }

  componentDidMount = () => {
    const { themeConfig } = this.props
    const prefix = '--chata-options-toolbar-'
    setCSSVars({ themeConfig, prefix })
  }

  componentDidUpdate = (prevProps, prevState) => {
    ReactTooltip.rebuild()

    if (prevState.activeMenu === 'sql' && this.state.activeMenu !== 'sql') {
      this.setState({ sqlCopySuccess: false })
    }
  }

  onTableFilter = (newTableData) => {
    const displayType = _get(this.props.responseRef, 'state.displayType')
    if (displayType === 'table') {
      // this shouldn't be affected when editing a pivot table
      this.setState({
        disableChartingOptions: _get(newTableData, 'length') < 2,
      })
    }
  }

  setFilterTags = ({ isFilteringTable } = {}) => {
    const displayType = _get(this.props.responseRef, 'state.displayType')
    const tableRef =
      displayType === 'pivot_table'
        ? _get(this.props.responseRef, 'pivotTableRef.ref.table')
        : _get(this.props.responseRef, 'tableRef.ref.table')

    if (!tableRef) {
      return
    }

    const queryOutputId = this.props.responseRef.COMPONENT_KEY
    const filterValues = tableRef.getHeaderFilters()
    if (filterValues) {
      filterValues.forEach((filter) => {
        try {
          if (!isFilteringTable) {
            const filterTagEl = document.createElement('span')
            filterTagEl.innerText = 'F'
            filterTagEl.setAttribute('class', 'filter-tag')

            const columnTitleEl = document.querySelector(
              `#chata-response-content-container-${queryOutputId} .tabulator-col[tabulator-field="${filter.field}"] .tabulator-col-title`
            )
            columnTitleEl.insertBefore(filterTagEl, columnTitleEl.firstChild)
          } else if (isFilteringTable) {
            var filterTagEl = document.querySelector(
              `#chata-response-content-container-${queryOutputId} .tabulator-col[tabulator-field="${filter.field}"] .filter-tag`
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
    this.props.onFilterCallback()

    this.filtering = !this.filtering
    const queryOutputId = _get(this.props.responseRef, 'COMPONENT_KEY')

    try {
      const filterHeaderElements = document.querySelectorAll(
        `#chata-response-content-container-${queryOutputId} .chata-table .tabulator-header-filter`
      )
      const colHeaderElements = document.querySelectorAll(
        `#chata-response-content-container-${queryOutputId} .chata-table .tabulator-col`
      )

      if (this.filtering) {
        filterHeaderElements.forEach((element) => {
          element.style.display = 'inline-block'
        })

        colHeaderElements.forEach((element) => {
          element.style.height = '72px !important'
        })
        this.setFilterTags({ isFilteringTable: true })
      } else {
        filterHeaderElements.forEach((element) => {
          element.style.display = 'none'
        })

        colHeaderElements.forEach((element) => {
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

  copyTableToClipboard = () => {
    if (this.props.responseRef) {
      this.props.responseRef.copyTableToClipboard()
      this.props.onSuccessAlert('Successfully copied table to clipboard!')
      this.setTemporaryState('copiedTable', true, 1000)
      ReactTooltip.hide()
    } else {
      this.setTemporaryState('copiedTable', false, 1000)
    }
  }

  saveTableAsCSV = () => {
    if (this.props.responseRef) {
      this.props.responseRef.saveTableAsCSV()
    }
  }

  saveChartAsPNG = () => {
    if (this.props.responseRef) {
      this.props.responseRef.saveChartAsPNG()
    }
  }

  deleteMessage = () => {
    ReactTooltip.hide()
    this.props.deleteMessageCallback()
  }

  copySQL = () => {
    const sql = _get(
      this.props.responseRef,
      'props.queryResponse.data.data.sql'
    )
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

    this.setState({ sqlCopySuccess: true })
    ReactTooltip.hide()
  }

  showHideColumnsModal = () => {
    this.setState({ isHideColumnsModalVisible: true })
  }

  hideColumnCallback = (column) => {
    if (!column) {
      return
    }

    const columnDefinition = column.getDefinition()
    setColumnVisibility({
      ...this.props.authentication,
      columns: [
        {
          name: columnDefinition.name,
          is_visible: false,
        },
      ],
    })
      .then(() => {
        column.hide()
      })
      .catch((error) => {
        console.error(error)
        this.props.onErrorCallback(error)
        this.setState({ isSettingColumnVisibility: false })
      })
  }

  onColumnVisibilitySave = (columns) => {
    const { authentication } = this.props
    const formattedColumns = columns.map((col) => {
      return {
        name: col.name,
        is_visible: col.visible,
      }
    })

    this.setState({ isSettingColumnVisibility: true })
    setColumnVisibility({ ...authentication, columns: formattedColumns })
      .then(() => {
        const tableRef = _get(this.props.responseRef, 'tableRef.ref.table')
        if (tableRef) {
          const columnComponents = tableRef.getColumns()
          columnComponents.forEach((component, index) => {
            const id = component.getDefinition().id
            const isVisible = columns.find((col) => col.id === id).visible
            if (isVisible) {
              component.show()
            } else {
              component.hide()
            }

            if (_get(this.props.responseRef, `tableColumns[${index}]`)) {
              this.props.responseRef.tableColumns[index].visible = isVisible
            }
          })
        }

        this.setState({
          isHideColumnsModalVisible: false,
          isSettingColumnVisibility: false,
        })

        if (this.props.responseRef) {
          this.props.responseRef.updateColumns(
            columns.map((col) => {
              return {
                ...col,
                is_visible: col.visible,
              }
            })
          )
        }

        this.props.onColumnVisibilitySave(columns)
      })
      .catch((error) => {
        console.error(error)
        this.props.onErrorCallback(error)
        this.setState({ isSettingColumnVisibility: false })
      })
  }

  renderHideColumnsModal = () => {
    const tableRef = _get(this.props.responseRef, 'tableRef.ref.table')

    let columns = []
    if (tableRef) {
      columns = tableRef.getColumns().map((col) => {
        return {
          ...col.getDefinition(),
          visible: col.getVisibility(), // for some reason this doesn't get updated when .hide() or .show() are called, so we are manually updating it here
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

  renderNotificationModal = () => {
    const initialQuery = _get(
      this.props.responseRef,
      'props.queryResponse.data.data.text'
    )

    return (
      <NotificationModal
        authentication={this.props.authentication}
        isVisible={this.state.activeMenu === 'notification'}
        initialQuery={initialQuery}
        onClose={() => this.setState({ activeMenu: undefined })}
        onErrorCallback={this.props.onErrorCallback}
        onSave={() => {
          this.props.onSuccessAlert('Successfully created a notification')
          this.setState({ activeMenu: undefined })
        }}
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
        onConfirm={() => {
          this.reportQueryProblem(this.reportProblemMessage)
          this.reportProblemMessage = undefined
        }}
        confirmLoading={this.state.isReportingProblem}
        title="Report a Problem"
        enableBodyScroll={true}
        width="600px"
        confirmText="Report"
      >
        Please tell us more about the problem you are experiencing:
        <textarea
          className="report-problem-text-area"
          onChange={(e) => (this.reportProblemMessage = e.target.value)}
        />
      </Modal>
    )
  }

  reportQueryProblem = (reason) => {
    const queryId = _get(
      this.props.responseRef,
      'props.queryResponse.data.data.query_id'
    )
    this.setState({ isReportingProblem: true })
    reportProblem({
      message: reason,
      queryId,
      ...this.props.authentication,
    })
      .then(() => {
        this.props.onSuccessAlert('Thank you for your feedback.')
        this.setState({ activeMenu: undefined, isReportingProblem: false })
      })
      .catch((error) => {
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
      <div className="more-options-menu" data-test="chata-toolbar-more-options">
        <ul className="context-menu-list">
          {shouldShowButton.showSaveAsCSVButton && (
            <li
              onClick={() => {
                this.setState({ activeMenu: undefined })
                this.saveTableAsCSV()
              }}
            >
              <Icon
                type="download"
                style={{
                  marginRight: '7px',
                }}
              />
              Download as CSV
            </li>
          )}
          {shouldShowButton.showSaveAsPNGButton && (
            <li
              onClick={() => {
                this.setState({ activeMenu: undefined })
                this.saveChartAsPNG()
              }}
            >
              <Icon
                type="download"
                style={{
                  marginRight: '7px',
                }}
              />
              Download as PNG
            </li>
          )}
          {shouldShowButton.showCopyButton && (
            <li
              onClick={() => {
                this.setState({ activeMenu: undefined })
                this.copyTableToClipboard()
              }}
            >
              <Icon
                type="copy"
                style={{
                  marginRight: '7px',
                }}
              />
              Copy table to clipboard
            </li>
          )}
          {shouldShowButton.showSQLButton && (
            <li
              onClick={() => {
                this.setState({ activeMenu: 'sql' })
              }}
            >
              <Icon type="database" /> View generated SQL
            </li>
          )}
          {shouldShowButton.showCreateNotificationIcon && (
            <li
              onClick={() => {
                this.setState({ activeMenu: 'notification' })
              }}
            >
              <Icon
                style={{ verticalAlign: 'middle', marginRight: '7px' }}
                type="notification"
              />
              Create a Data Alert...
            </li>
          )}
          {shouldShowButton.showShareToSlackButton && (
            <li
              onClick={() => {
                this.setState({ activeMenu: 'slack' })
              }}
            >
              <Icon style={{ marginRight: '5px' }} type="slack" />
              Send to Slack...
            </li>
          )}
          {shouldShowButton.showShareToTeamsButton && (
            <li
              onClick={() => {
                this.setState({ activeMenu: 'teams' })
              }}
            >
              <Icon
                style={{
                  display: 'inline-block',
                  marginRight: '5px',
                  marginTop: '-2px',
                }}
                type="teams"
              />
              Send to Teams...
            </li>
          )}
        </ul>
      </div>
    )
  }

  areAllColumnsHidden = () => {
    const columns = _get(this.props.responseRef, 'tableColumns', [])
    return !columns.find((col) => col.visible)
  }

  renderSendToSlackModal = () => {
    if (this.props.autoQLConfig.enableSlackSharing) {
      return (
        <SendToSlackModal
          authentication={this.props.authentication}
          isVisible={this.state.activeMenu === 'slack'}
          responseRef={this.props.responseRef}
          onErrorCallback={this.props.onErrorCallback}
          onClose={() => {
            this.setState({ activeMenu: undefined })
          }}
        />
      )
    }
    return null
  }

  renderSendToTeamsModal = () => {
    if (this.props.autoQLConfig.enableTeamsSharing) {
      return (
        <SendToTeamsModal
          authentication={this.props.authentication}
          isVisible={this.state.activeMenu === 'teams'}
          responseRef={this.props.responseRef}
          onErrorCallback={this.props.onErrorCallback}
          onClose={() => {
            this.setState({ activeMenu: undefined })
          }}
        />
      )
    }
    return null
  }

  renderSQLModal = () => {
    const sql = _get(
      this.props.responseRef,
      'props.queryResponse.data.data.sql[0]'
    )
    if (!sql) {
      return null
    }

    return (
      <Modal
        isVisible={this.state.activeMenu === 'sql'}
        footer={
          <div>
            <Button
              type="primary"
              onClick={() => this.setState({ activeMenu: undefined })}
            >
              Ok
            </Button>
          </div>
        }
        onClose={() => this.setState({ activeMenu: undefined })}
        title="Generated SQL"
        enableBodyScroll={false}
        width="600px"
      >
        <div className="copy-sql-modal-content">
          <textarea
            className="copy-sql-formatted-text"
            value={`${sqlFormatter.format(sql)}`}
            disabled
          />
          <Button
            className={`copy-sql-btn ${
              this.state.sqlCopySuccess ? 'sql-copied' : ''
            }`}
            onClick={this.copySQL}
            tooltip="Copy to Clipboard"
          >
            <Icon type="copy" />
            {this.state.sqlCopySuccess && (
              <Icon type="check" className="sql-copied" />
            )}
          </Button>
        </div>
      </Modal>
    )
  }

  renderToolbar = () => {
    const displayType = _get(this.props.responseRef, 'state.displayType')
    const response = _get(this.props.responseRef, 'props.queryResponse')
    const isDataResponse = _get(response, 'data.data.display_type') === 'data'

    const shouldShowButton = {
      showFilterButton:
        isTableResponse(response, displayType) &&
        !this.areAllColumnsHidden() &&
        _get(response, 'data.data.rows.length') > 1,
      showCopyButton:
        isTableResponse(response, displayType) &&
        !this.areAllColumnsHidden() &&
        !!_get(response, 'data.data.rows.length'),
      showSaveAsCSVButton:
        isTableResponse(response, displayType) &&
        !this.areAllColumnsHidden() &&
        !!_get(response, 'data.data.rows.length'),
      showSaveAsPNGButton: CHART_TYPES.includes(displayType),
      showHideColumnsButton:
        this.props.autoQLConfig.enableColumnVisibilityManager &&
        // !isAggregation(response) &&
        isTableResponse(response, displayType) &&
        displayType !== 'pivot_table' &&
        _get(response, 'data.data.columns.length') > 0,
      showSQLButton: isDataResponse && this.props.autoQLConfig.debug,
      showDeleteButton: this.props.enableDeleteBtn,
      showReportProblemButton: !!_get(response, 'data.data.query_id'),
      showCreateNotificationIcon:
        isDataResponse && this.props.autoQLConfig.enableNotifications,
      showShareToSlackButton:
        isDataResponse && this.props.autoQLConfig.enableSlackSharing,
      showShareToTeamsButton:
        isDataResponse && this.props.autoQLConfig.enableTeamsSharing,
    }

    shouldShowButton.showMoreOptionsButton =
      shouldShowButton.showCopyButton ||
      shouldShowButton.showSQLButton ||
      shouldShowButton.showCreateNotificationIcon ||
      shouldShowButton.showSaveAsCSVButton ||
      shouldShowButton.showSaveAsPNGButton ||
      shouldShowButton.showShareToSlackButton ||
      shouldShowButton.showShareToTeamsButton

    // If there is nothing to put in the toolbar, don't render it
    if (
      !this.props.responseRef ||
      !Object.values(shouldShowButton).find((showButton) => showButton === true)
    ) {
      return null
    }

    return (
      <div
        className={`autoql-options-toolbar
        ${this.state.activeMenu ? 'active' : ''}
        ${this.props.className || ''}`}
        data-test="autoql-options-toolbar"
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
            data-test="options-toolbar-col-vis"
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
            content={(props) => this.renderReportProblemMenu(props)}
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
            data-test="options-toolbar-trash-btn"
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
            content={(props) =>
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
              data-test="chata-toolbar-more-options-btn"
            >
              <Icon type="more-vertical" />
            </button>
          </Popover>
        )}
      </div>
    )
  }

  render = () => {
    return (
      <Fragment>
        {this.renderToolbar()}
        {this.renderHideColumnsModal()}
        {this.renderReportProblemModal()}
        {this.renderNotificationModal()}
        {this.renderSendToSlackModal()}
        {this.renderSendToTeamsModal()}
        {this.renderSQLModal()}
      </Fragment>
    )
  }
}
