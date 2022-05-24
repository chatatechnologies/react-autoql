import React from 'react'
import PropTypes from 'prop-types'
import Popover from 'react-tiny-popover'
import { v4 as uuid } from 'uuid'
import _get from 'lodash.get'
import _isEqual from 'lodash.isequal'
import ReactTooltip from 'react-tooltip'
import { format } from 'sql-formatter'
import { Icon } from '../Icon'
import { ColumnVisibilityModal } from '../ColumnVisibilityModal'
import { DataAlertModal } from '../Notifications'
import { QueryOutput } from '../QueryOutput'
import { Modal } from '../Modal'
import { SendToSlackModal } from '../SendToSlackModal'
import { SendToTeamsModal } from '../SendToTeamsModal'
import { Button } from '../Button'
import ErrorBoundary from '../../containers/ErrorHOC/ErrorHOC'

import {
  setColumnVisibility,
  reportProblem,
  exportCSV,
} from '../../js/queryService'

import {
  isTableType,
  setCSSVars,
  areAllColumnsHidden,
  areSomeColumnsHidden,
  isChartType,
} from '../../js/Util'

import {
  autoQLConfigType,
  authenticationType,
  themeConfigType,
} from '../../props/types'
import {
  autoQLConfigDefault,
  authenticationDefault,
  themeConfigDefault,
  getAuthentication,
  getAutoQLConfig,
  getThemeConfig,
} from '../../props/defaults'

import './OptionsToolbar.scss'

export default class OptionsToolbar extends React.Component {
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
    onResponseCallback: PropTypes.func,
    onCSVExportClick: PropTypes.func,
    onFilterClick: PropTypes.func,
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
    onFilterClick: () => {},
    onColumnVisibilitySave: () => {},
    onResponseCallback: () => {},
  }

  state = {
    isHideColumnsModalVisible: false,
    isSettingColumnVisibility: false,
    reportProblemMessage: undefined,
    isCSVDownloading: false,
  }

  componentDidMount = () => {
    this._isMounted = true
    setCSSVars(getThemeConfig(this.props.themeConfig))
  }

  componentDidUpdate = (prevProps, prevState) => {
    if (prevState.activeMenu === 'sql' && this.state.activeMenu !== 'sql') {
      this.setState({ sqlCopySuccess: false })
    }

    if (
      !_isEqual(
        getThemeConfig(this.props.themeConfig),
        getThemeConfig(prevProps.themeConfig)
      )
    ) {
      setCSSVars(getThemeConfig(this.props.themeConfig))
    }
  }

  componentWillUnmount = () => {
    this._isMounted = false
    clearTimeout(this.temporaryStateTimeout)
  }

  onTableFilter = (newTableData) => {
    const displayType = _get(this.props.responseRef, 'props.displayType')
    if (displayType === 'table') {
      // this shouldn't be affected when editing a pivot table
      this.setState({
        disableChartingOptions: _get(newTableData, 'length') < 2,
      })
    }
  }

  toggleTableFilter = () => {
    this.filtering = !this.filtering
    this.props.onFilterClick({ isFilteringTable: this.filtering })
  }

  setTemporaryState = (key, value, duration) => {
    this.setState({ [key]: value })
    this.temporaryStateTimeout = setTimeout(() => {
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

  fetchCSVAndExport = () => {
    const queryId = _get(
      this.props.responseRef,
      'queryResponse.data.data.query_id'
    )

    exportCSV({
      queryId,
      ...getAuthentication(this.props.authentication),
    })
      .then((response) => {
        const url = window.URL.createObjectURL(new Blob([response.data]))
        const link = document.createElement('a')
        link.href = url
        link.setAttribute('download', 'export.csv')
        document.body.appendChild(link)
        link.click()
      })
      .catch((error) => {
        console.error(error)
      })
  }

  onCSVMenuButtonClick = () => {
    this.setState({ activeMenu: undefined })
    const displayType = _get(this.props.responseRef, 'props.displayType')
    const isPivotTable = displayType === 'pivot_table'

    if (this.props.onCSVExportClick) {
      // Only use this different behaviour for Data Messenger
      // Export directly from here if using this component
      // outside of Data Messenger
      const queryId = _get(
        this.props.responseRef,
        'queryResponse.data.data.query_id'
      )
      const queryText = _get(
        this.props.responseRef,
        'queryResponse.data.data.text'
      )
      this.props.onCSVExportClick(queryId, queryText, isPivotTable)
    } else if (isPivotTable) {
      if (_get(this.props, 'responseRef.pivotTableRef._isMounted')) {
        this.props.responseRef.pivotTableRef.saveAsCSV()
      }
    } else {
      this.fetchCSVAndExport()
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
    const sql = _get(this.props.responseRef, 'queryResponse.data.data.sql')
    const el = document.createElement('textarea')
    el.value = sql
    document.body.appendChild(el)
    el.select()
    document.execCommand('copy')
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

  onColumnVisibilitySave = (columns) => {
    const { authentication } = this.props
    const formattedColumns = columns.map((col) => {
      const formattedCol = {
        ...col,
        is_visible: col.checked,
      }

      delete formattedCol.content
      delete formattedCol.checked

      return formattedCol
    })

    this.setState({ isSettingColumnVisibility: true })
    setColumnVisibility({ ...authentication, columns: formattedColumns })
      .then(() => {
        if (this._isMounted) {
          this.setState({
            isHideColumnsModalVisible: false,
            isSettingColumnVisibility: false,
          })
        }

        if (this.props.responseRef) {
          this.props.responseRef.updateColumns(formattedColumns)
        }

        this.props.onColumnVisibilitySave(formattedColumns)
      })
      .catch((error) => {
        console.error(error)
        this.props.onErrorCallback(error)

        if (this._isMounted) {
          this.setState({ isSettingColumnVisibility: false })
        }
      })
  }

  renderHideColumnsModal = () => {
    const cols = _get(this.props.responseRef, 'queryResponse.data.data.columns')
    if (!cols || !cols.length) {
      return null
    }

    const columns = cols.map((col) => {
      return {
        ...col,
        content: col.display_name,
        checked: col.is_visible,
      }
    })

    return (
      <ErrorBoundary>
        <ColumnVisibilityModal
          themeConfig={getThemeConfig(this.props.themeConfig)}
          columns={columns}
          isVisible={this.state.isHideColumnsModalVisible}
          onClose={() => this.setState({ isHideColumnsModalVisible: false })}
          isSettingColumns={this.state.isSettingColumnVisibility}
          onConfirm={this.onColumnVisibilitySave}
        />
      </ErrorBoundary>
    )
  }

  renderDataAlertModal = () => {
    const initialQuery = _get(
      this.props.responseRef,
      'queryResponse.data.data.text'
    )

    return (
      <ErrorBoundary>
        <DataAlertModal
          authentication={getAuthentication(this.props.authentication)}
          themeConfig={getThemeConfig(this.props.themeConfig)}
          isVisible={this.state.activeMenu === 'notification'}
          initialQuery={initialQuery}
          onClose={() => this.setState({ activeMenu: undefined })}
          onErrorCallback={this.props.onErrorCallback}
          onSave={() => {
            this.props.onSuccessAlert('Successfully created a notification')
            this.setState({ activeMenu: undefined })
          }}
        />
      </ErrorBoundary>
    )
  }

  renderReportProblemModal = () => {
    return (
      <ErrorBoundary>
        <Modal
          themeConfig={getThemeConfig(this.props.themeConfig)}
          isVisible={this.state.activeMenu === 'other-problem'}
          onClose={() => {
            this.setState({
              activeMenu: undefined,
              reportProblemMessage: undefined,
            })
          }}
          onConfirm={() => {
            this.reportQueryProblem(this.state.reportProblemMessage)
            this.setState({
              reportProblemMessage: undefined,
            })
          }}
          confirmLoading={this.state.isReportingProblem}
          title="Report a Problem"
          enableBodyScroll={true}
          width="600px"
          confirmText="Report"
          confirmDisabled={this.state.reportProblemMessage ? false : true}
        >
          Please tell us more about the problem you are experiencing:
          <textarea
            className="report-problem-text-area"
            onChange={(e) =>
              this.setState({
                reportProblemMessage: e.target.value,
              })
            }
          />
        </Modal>
      </ErrorBoundary>
    )
  }

  reportQueryProblem = (reason) => {
    const queryId = _get(
      this.props.responseRef,
      'queryResponse.data.data.query_id'
    )
    this.setState({ isReportingProblem: true })
    reportProblem({
      message: reason,
      queryId,
      ...getAuthentication(this.props.authentication),
    })
      .then(() => {
        this.props.onSuccessAlert('Thank you for your feedback.')
        if (this._isMounted) {
          this.setState({ activeMenu: undefined, isReportingProblem: false })
        }
      })
      .catch((error) => {
        this.props.onErrorCallback(error)
        if (this._isMounted) {
          this.setState({ isReportingProblem: false })
        }
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
      <div
        className="more-options-menu"
        data-test="react-autoql-toolbar-more-options"
      >
        <ul className="context-menu-list">
          {shouldShowButton.showSaveAsCSVButton && (
            <li
              onClick={this.onCSVMenuButtonClick}
              style={
                this.state.isCSVDownloading
                  ? {
                      pointerEvents: 'none', //This makes it not clickable
                      opacity: 0.6, //This grays it out to look disabled
                    }
                  : null
              }
            >
              <Icon
                type="download"
                style={{
                  marginRight: '7px',
                }}
              />
              {this.state.isCSVDownloading
                ? 'CSV file downloading...'
                : 'Download as CSV'}
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

  isDrilldownResponse = () => {
    try {
      const queryText = _get(
        this.props.responseRef,
        'queryResponse.data.data.text'
      )
      if (queryText.split(' ')[0] === 'Drilldown:') {
        return true
      }
      return false
    } catch (error) {
      return false
    }
  }

  renderSendToSlackModal = () => {
    if (getAutoQLConfig(this.props.autoQLConfig).enableSlackSharing) {
      return (
        <SendToSlackModal
          themeConfig={getThemeConfig(this.props.themeConfig)}
          authentication={getAuthentication(this.props.authentication)}
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
    if (getAutoQLConfig(this.props.autoQLConfig).enableTeamsSharing) {
      return (
        <SendToTeamsModal
          authentication={getAuthentication(this.props.authentication)}
          themeConfig={getThemeConfig(this.props.themeConfig)}
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
    const sql = _get(this.props.responseRef, 'queryResponse.data.data.sql[0]')
    if (!sql) {
      return null
    }

    return (
      <ErrorBoundary>
        <Modal
          themeConfig={getThemeConfig(this.props.themeConfig)}
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
              value={`${format(sql)}`}
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
      </ErrorBoundary>
    )
  }

  renderToolbar = (shouldShowButton) => {
    return (
      <ErrorBoundary>
        <div
          className={`autoql-options-toolbar
        ${this.state.activeMenu ? 'active' : ''}
        ${this.props.className || ''}`}
          data-test="autoql-options-toolbar"
        >
          {shouldShowButton.showFilterButton && (
            <button
              onClick={this.toggleTableFilter}
              className="react-autoql-toolbar-btn"
              data-tip="Filter table"
              data-for="react-autoql-toolbar-btn-tooltip"
            >
              <Icon type="filter" />
            </button>
          )}
          {shouldShowButton.showHideColumnsButton && (
            <button
              onClick={this.showHideColumnsModal}
              className="react-autoql-toolbar-btn"
              data-tip="Show/hide columns"
              data-for="react-autoql-toolbar-btn-tooltip"
              data-test="options-toolbar-col-vis"
            >
              <Icon
                type="eye"
                showBadge={shouldShowButton.showHiddenColsBadge}
              />
            </button>
          )}
          {shouldShowButton.showReportProblemButton && (
            <Popover
              key={uuid()}
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
                className="react-autoql-toolbar-btn"
                data-tip="Report a problem"
                data-for="react-autoql-toolbar-btn-tooltip"
              >
                <Icon type="warning-triangle" />
              </button>
            </Popover>
          )}
          {shouldShowButton.showDeleteButton && (
            <button
              onClick={this.deleteMessage}
              className="react-autoql-toolbar-btn"
              data-tip="Delete data response"
              data-for="react-autoql-toolbar-btn-tooltip"
              data-test="options-toolbar-trash-btn"
            >
              <Icon type="trash" />
            </button>
          )}
          {shouldShowButton.showMoreOptionsButton && (
            <Popover
              key={uuid()}
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
                className="react-autoql-toolbar-btn"
                data-tip="More options"
                data-for="react-autoql-toolbar-btn-tooltip"
                data-test="react-autoql-toolbar-more-options-btn"
              >
                <Icon type="more-vertical" />
              </button>
            </Popover>
          )}
        </div>
      </ErrorBoundary>
    )
  }

  getShouldShouldButtonObj = () => {
    let shouldShowButton = {}
    try {
      const displayType = _get(this.props.responseRef, 'props.displayType')
      const isTable = isTableType(displayType)
      const isChart = isChartType(displayType)
      const response = _get(this.props.responseRef, 'queryResponse')
      const isDataResponse = _get(response, 'data.data.display_type') === 'data'
      const allColumnsHidden = areAllColumnsHidden(response)
      const someColumnsHidden = areSomeColumnsHidden(response)
      const numRows = _get(response, 'data.data.rows.length')
      const hasData = numRows > 0
      const hasMoreThanOneRow = numRows > 1
      const autoQLConfig = getAutoQLConfig(this.props.autoQLConfig)

      shouldShowButton = {
        showFilterButton: isTable && !allColumnsHidden && hasMoreThanOneRow,
        showCopyButton: isTable && !allColumnsHidden,
        showSaveAsPNGButton: isChart,
        showHideColumnsButton:
          autoQLConfig.enableColumnVisibilityManager &&
          hasData &&
          (displayType === 'table' ||
            (displayType === 'text' && allColumnsHidden)),
        showHiddenColsBadge: someColumnsHidden,
        showSQLButton: isDataResponse && autoQLConfig.debug,
        showSaveAsCSVButton:
          isTable && hasMoreThanOneRow && autoQLConfig.enableCSVDownload,
        showDeleteButton: this.props.enableDeleteBtn,
        showReportProblemButton: !!_get(response, 'data.data.query_id'),

        showCreateNotificationIcon:
          isDataResponse &&
          autoQLConfig.enableNotifications &&
          !this.isDrilldownResponse(),
        showShareToSlackButton: false,
        // This feature is disabled indefinitely
        // isDataResponse &&
        // autoQLConfig.enableSlackSharing,
        showShareToTeamsButton: false,
        // This feature is disabled indefinitely
        // isDataResponse &&
        // autoQLConfig.enableTeamsSharing,
      }

      shouldShowButton.showMoreOptionsButton =
        shouldShowButton.showCopyButton ||
        shouldShowButton.showSQLButton ||
        shouldShowButton.showCreateNotificationIcon ||
        shouldShowButton.showSaveAsCSVButton ||
        shouldShowButton.showSaveAsPNGButton ||
        shouldShowButton.showShareToSlackButton ||
        shouldShowButton.showShareToTeamsButton
    } catch (error) {
      console.error(error)
    }

    return shouldShowButton
  }

  render = () => {
    const shouldShowButton = this.getShouldShouldButtonObj()

    // If there is nothing to put in the toolbar, don't render it
    if (
      !Object.values(shouldShowButton).find((showButton) => showButton === true)
    ) {
      return null
    }

    return (
      <ErrorBoundary>
        {this.renderToolbar(shouldShowButton)}
        {shouldShowButton.showHideColumnsButton &&
          this.renderHideColumnsModal()}
        {shouldShowButton.showReportProblemButton &&
          this.renderReportProblemModal()}
        {shouldShowButton.showMoreOptionsButton && this.renderDataAlertModal()}
        {shouldShowButton.showSQLButton && this.renderSQLModal()}
      </ErrorBoundary>
    )
  }
}
