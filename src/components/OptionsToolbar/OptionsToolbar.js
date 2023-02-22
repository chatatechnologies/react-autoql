import React from 'react'
import PropTypes from 'prop-types'
import { Popover } from 'react-tiny-popover'
import { v4 as uuid } from 'uuid'
import _isEqual from 'lodash.isequal'
import ReactTooltip from 'react-tooltip'
import { format } from 'sql-formatter'
import { Icon } from '../Icon'
import { ColumnVisibilityModal } from '../ColumnVisibilityModal'
import { DataAlertModal } from '../Notifications'
import { Modal } from '../Modal'
import { Button } from '../Button'
import ReportProblemModal from './ReportProblemModal'
import ErrorBoundary from '../../containers/ErrorHOC/ErrorHOC'

import { setColumnVisibility, exportCSV } from '../../js/queryService'

import { isTableType, areAllColumnsHidden, areSomeColumnsHidden, isChartType, deepEqual } from '../../js/Util'

import { autoQLConfigType, authenticationType } from '../../props/types'
import { autoQLConfigDefault, authenticationDefault, getAuthentication, getAutoQLConfig } from '../../props/defaults'

import './OptionsToolbar.scss'

export class OptionsToolbar extends React.Component {
  COMPONENT_KEY = uuid()

  static propTypes = {
    authentication: authenticationType,
    autoQLConfig: autoQLConfigType,

    enableDeleteBtn: PropTypes.bool,
    shouldRender: PropTypes.bool,
    onSuccessAlert: PropTypes.func,
    onErrorCallback: PropTypes.func,
    onNewNotificationCallback: PropTypes.func,
    deleteMessageCallback: PropTypes.func,
    createDataAlertCallback: PropTypes.func,
    onCSVDownloadStart: PropTypes.func,
    onCSVDownloadFinish: PropTypes.func,
    onCSVDownloadProgress: PropTypes.func,
    rebuildTooltips: PropTypes.func,
  }

  static defaultProps = {
    authentication: authenticationDefault,
    autoQLConfig: autoQLConfigDefault,

    enableDeleteBtn: false,
    shouldRender: true,
    onSuccessAlert: () => {},
    onErrorCallback: () => {},
    onNewNotificationCallback: () => {},
    deleteMessageCallback: () => {},
    createDataAlertCallback: () => {},
    onColumnVisibilitySave: () => {},
    onCSVDownloadStart: () => {},
    onCSVDownloadFinish: () => {},
    onCSVDownloadProgress: () => {},
  }

  state = {
    isHideColumnsModalVisible: false,
    isSettingColumnVisibility: false,
    reportProblemMessage: undefined,
    isCSVDownloading: false,
  }

  componentDidMount = () => {
    this._isMounted = true
    this.rebuildTooltips()
  }

  shouldComponentUpdate = (nextProps, nextState) => {
    if (!nextProps.shouldRender) {
      return false
    }

    const propsEqual = deepEqual(this.props, nextProps)
    const stateEqual = deepEqual(this.state, nextState)

    return !propsEqual || !stateEqual
  }

  componentDidUpdate = (prevProps, prevState) => {
    if (prevState.activeMenu === 'sql' && this.state.activeMenu !== 'sql') {
      this.setState({ sqlCopySuccess: false })
    }

    if (prevProps.displayType !== this.props.displayType) {
      this.setState({ activeMenu: undefined })
      this.rebuildTooltips()
    }
  }

  componentWillUnmount = () => {
    this._isMounted = false
    clearTimeout(this.temporaryStateTimeout)
    clearTimeout(this.pivotTableCSVDownloadTimeout)
  }

  rebuildTooltips = () => {
    if (this.props.rebuildTooltips) {
      this.props.rebuildTooltips()
    } else {
      ReactTooltip.rebuild()
    }
  }

  onTableFilter = (newTableData) => {
    const displayType = this.props.responseRef?.state?.displayType
    if (displayType === 'table') {
      // this shouldn't be affected when editing a pivot table
      this.setState({
        disableChartingOptions: newTableData?.length < 2,
      })
    }
  }

  setTemporaryState = (key, value, duration) => {
    this.setState({ [key]: value })
    this.temporaryStateTimeout = setTimeout(() => {
      this.setState({ [key]: undefined })
    }, duration)
  }

  copyTableToClipboard = () => {
    if (this.props.responseRef) {
      this.props.responseRef?.copyTableToClipboard()
      this.props.onSuccessAlert('Successfully copied table to clipboard!')
      this.setTemporaryState('copiedTable', true, 1000)
      ReactTooltip.hide()
    } else {
      this.setTemporaryState('copiedTable', false, 1000)
    }
  }

  fetchCSVAndExport = () => {
    const queryId = this.props.responseRef?.queryResponse?.data?.data?.query_id
    const query = this.props.responseRef?.queryResponse?.data?.data?.text
    const uniqueId = uuid()

    this.props.onCSVDownloadStart({ id: uniqueId, queryId, query })
    exportCSV({
      queryId,
      ...getAuthentication(this.props.authentication),
      csvProgressCallback: (percentCompleted) =>
        this.props.onCSVDownloadProgress({
          id: uniqueId,
          progress: percentCompleted,
        }),
    })
      .then((response) => {
        const url = window.URL.createObjectURL(new Blob([response.data]))
        const link = document.createElement('a')
        link.href = url
        link.setAttribute('download', 'export.csv')
        document.body.appendChild(link)
        link.click()

        const exportLimit = parseInt(response?.headers?.export_limit)
        const limitReached = response?.headers?.limit_reached?.toLowerCase() == 'true' ? true : false

        this.props.onCSVDownloadFinish({
          id: uniqueId,
          exportLimit,
          limitReached,
        })
      })
      .catch((error) => {
        this.props.onCSVDownloadFinish({ id: uniqueId, error })
        console.error(error)
      })
  }

  onCSVMenuButtonClick = () => {
    this.setState({ activeMenu: undefined })
    const displayType = this.props.responseRef?.state?.displayType
    const isPivotTable = displayType === 'pivot_table'
    const uniqueId = uuid()

    if (isPivotTable) {
      if (this.props.responseRef?.pivotTableRef?._isMounted) {
        this.props.onCSVDownloadStart({ id: uniqueId })
        this.props.responseRef?.pivotTableRef
          ?.saveAsCSV(2000)
          .then(() => {
            this.props.onCSVDownloadProgress({ id: uniqueId, progress: 100 })
            this.props.onCSVDownloadFinish({ id: uniqueId })
          })
          .catch((error) => {
            console.error(error)
            this.props.onCSVDownloadFinish({ id: uniqueId })
          })
      }
    } else {
      this.fetchCSVAndExport()
    }
  }

  saveChartAsPNG = () => {
    this.props.responseRef?.saveChartAsPNG()
  }

  deleteMessage = () => {
    ReactTooltip.hide()
    this.props.deleteMessageCallback()
  }

  copySQL = () => {
    const sql = this.props.responseRef?.queryResponse?.data?.data?.sql
    const el = document.createElement('textarea')
    el.value = sql
    document.body.appendChild(el)
    el.select()
    document.execCommand('copy')
    this.setTemporaryState('copiedSQL', true, 1000)
    this.props.onSuccessAlert('Successfully copied generated query to clipboard!')

    this.setState({ sqlCopySuccess: true })
    ReactTooltip.hide()
  }

  showHideColumnsModal = () => this.setState({ isHideColumnsModalVisible: true })
  closeColumnVisibilityModal = () => this.setState({ isHideColumnsModalVisible: false })
  closeDataAlertModal = () => this.setState({ activeMenu: undefined })

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
          this.props.responseRef?.updateColumns(formattedColumns)
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
    const cols = this.props.responseRef?.getColumns()
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
          columns={columns}
          isVisible={this.state.isHideColumnsModalVisible}
          onClose={this.closeColumnVisibilityModal}
          isSettingColumns={this.state.isSettingColumnVisibility}
          onConfirm={this.onColumnVisibilitySave}
        />
      </ErrorBoundary>
    )
  }

  onDataAlertSave = () => {
    this.props.onSuccessAlert('Successfully created a notification')
    this.setState({ activeMenu: undefined })
  }

  renderDataAlertModal = () => {
    const initialQuery = this.props.responseRef?.queryResponse?.data?.data?.text

    return (
      <ErrorBoundary>
        <DataAlertModal
          authentication={this.props.authentication}
          isVisible={this.state.activeMenu === 'notification'}
          initialQuery={initialQuery}
          onClose={this.closeDataAlertModal}
          onErrorCallback={this.props.onErrorCallback}
          onSave={this.onDataAlertSave}
        />
      </ErrorBoundary>
    )
  }

  renderReportProblemModal = () => {
    return (
      <ReportProblemModal
        ref={(r) => (this.reportProblemRef = r)}
        authentication={this.props.authentication}
        onClose={() => {
          this.setState({
            activeMenu: undefined,
          })
        }}
        onReportProblem={({ successMessage, error }) => {
          if (successMessage) {
            this.props.onSuccessAlert(successMessage)
            if (this._isMounted) {
              this.setState({
                activeMenu: undefined,
              })
            }
          } else if (error) {
            this.props.onErrorCallback(error)
          }
        }}
        responseRef={this.props.responseRef}
        isVisible={this.state.activeMenu === 'report-problem'}
      />
    )
  }

  reportQueryProblem = (reason) => {
    if (this.reportProblemRef?._isMounted) {
      this.reportProblemRef.reportQueryProblem(reason)
    }
  }

  refreshData = () => {
    // todo: Refresh data inside QueryOutput
    return
  }

  getMenuItemClass = (className) => {
    return `react-autoql-toolbar-btn ${className ?? ''}`
  }

  renderMoreOptionsMenu = (props, shouldShowButton) => {
    return (
      <div className='more-options-menu' data-test='react-autoql-toolbar-more-options'>
        <ul className='context-menu-list'>
          {shouldShowButton.showSaveAsCSVButton && (
            <li
              onClick={this.onCSVMenuButtonClick}
              style={
                this.state.isCSVDownloading
                  ? {
                      pointerEvents: 'none', // This makes it not clickable
                      opacity: 0.6, // This grays it out to look disabled
                    }
                  : null
              }
            >
              <Icon
                type='download'
                style={{
                  marginRight: '7px',
                }}
              />
              {this.state.isCSVDownloading ? 'CSV file downloading...' : 'Download as CSV'}
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
                type='download'
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
                type='copy'
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
              <Icon type='database' /> View generated SQL
            </li>
          )}
          {shouldShowButton.showCreateNotificationIcon && (
            <li
              onClick={() => {
                this.setState({ activeMenu: 'notification' })
                this.props.createDataAlertCallback()
              }}
            >
              <Icon style={{ verticalAlign: 'middle', marginRight: '7px' }} type='notification' />
              Create a Data Alert...
            </li>
          )}
        </ul>
      </div>
    )
  }

  isDrilldownResponse = (props) => {
    try {
      const queryText = props.responseRef?.queryResponse?.data?.data?.text

      if (queryText.split(' ')[0] === 'Drilldown:') {
        return true
      }
      return false
    } catch (error) {
      return false
    }
  }

  openReportProblemModal = () => {
    this.setState({ activeMenu: 'report-problem' })
  }

  renderSQLModal = () => {
    const sql = this.props.responseRef?.queryResponse?.data?.data?.sql?.[0]
    if (!sql) {
      return null
    }

    return (
      <ErrorBoundary>
        <Modal
          isVisible={this.state.activeMenu === 'sql'}
          footer={
            <div>
              <Button type='primary' onClick={() => this.setState({ activeMenu: undefined })}>
                Ok
              </Button>
            </div>
          }
          onClose={() => this.setState({ activeMenu: undefined })}
          title='Generated SQL'
          enableBodyScroll={false}
          width='600px'
        >
          <div className='copy-sql-modal-content'>
            <textarea className='copy-sql-formatted-text' value={`${format(sql)}`} disabled />
            <Button
              className={`copy-sql-btn ${this.state.sqlCopySuccess ? 'sql-copied' : ''}`}
              onClick={this.copySQL}
              tooltip='Copy to Clipboard'
            >
              <Icon type='copy' />
              {this.state.sqlCopySuccess && <Icon type='check' className='sql-copied' />}
            </Button>
          </div>
        </Modal>
      </ErrorBoundary>
    )
  }

  renderToolbar = (shouldShowButton) => {
    const isFiltered = !!this.props.responseRef?.tableParams?.filters?.length

    return (
      <ErrorBoundary>
        <div
          className={`react-autoql-toolbar options-toolbar
        ${this.state.activeMenu ? 'active' : ''}
        ${this.props.className || ''}`}
          data-test='autoql-options-toolbar'
        >
          {shouldShowButton.showFilterButton && (
            <button
              onClick={() => {
                const isFiltering = this.props.responseRef?.toggleTableFilter()
                this.setState({ isFiltering })
              }}
              className={this.getMenuItemClass('filter-btn')}
              data-tip='Filter table'
              data-for={`react-autoql-options-toolbar-tooltip-${this.COMPONENT_KEY}`}
              data-test='react-autoql-filter-button'
            >
              <Icon
                // Add these back in the future when we want this feature
                // type={this.state.isFiltering ? 'filter-off' : 'filter'}
                // showBadge={isFiltered}
                type='filter'
                showBadge={false}
              />
            </button>
          )}
          {shouldShowButton.showHideColumnsButton && (
            <button
              onClick={this.showHideColumnsModal}
              className={this.getMenuItemClass(shouldShowButton.showHideColumnsButton)}
              data-tip='Show/hide columns'
              data-for={`react-autoql-options-toolbar-tooltip-${this.COMPONENT_KEY}`}
              data-test='options-toolbar-col-vis'
            >
              <Icon type='eye' showBadge={shouldShowButton.showHiddenColsBadge} />
            </button>
          )}
          {shouldShowButton.showReportProblemButton && (
            <button
              onClick={this.openReportProblemModal}
              className={this.getMenuItemClass(shouldShowButton.showReportProblemButton)}
              data-tip='Report a problem'
              data-for={`react-autoql-options-toolbar-tooltip-${this.COMPONENT_KEY}`}
            >
              <Icon type='warning-triangle' />
            </button>
          )}
          {shouldShowButton.showRefreshDataButton && (
            <button
              onClick={this.refreshData}
              className={this.getMenuItemClass(shouldShowButton.showRefreshDataButton)}
              data-tip='Re-run query'
              data-for={`react-autoql-options-toolbar-tooltip-${this.COMPONENT_KEY}`}
              data-test='options-toolbar-trash-btn'
            >
              <Icon type='refresh' />
            </button>
          )}
          {shouldShowButton.showDeleteButton && (
            <button
              onClick={this.deleteMessage}
              className={this.getMenuItemClass(shouldShowButton.showDeleteButton)}
              data-tip='Delete data response'
              data-for={`react-autoql-options-toolbar-tooltip-${this.COMPONENT_KEY}`}
              data-test='options-toolbar-trash-btn'
            >
              <Icon type='trash' />
            </button>
          )}
          {shouldShowButton.showMoreOptionsButton && (
            <Popover
              key={`more-options-button-${this.COMPONENT_KEY}`}
              isOpen={this.state.activeMenu === 'more-options'}
              positions={['bottom', 'top']}
              padding={8}
              onClickOutside={() => {
                this.setState({ activeMenu: undefined })
              }}
              content={(props) => this.renderMoreOptionsMenu(props, shouldShowButton)}
              parentElement={this.props.popoverParentElement}
              boundaryElement={this.props.popoverParentElement}
            >
              <button
                onClick={() => {
                  ReactTooltip.hide()
                  this.setState({ activeMenu: 'more-options' })
                }}
                className={this.getMenuItemClass(shouldShowButton.showMoreOptionsButton)}
                data-tip='More options'
                data-for={`react-autoql-options-toolbar-tooltip-${this.COMPONENT_KEY}`}
                data-test='react-autoql-toolbar-more-options-btn'
              >
                <Icon type='more-vertical' />
              </button>
            </Popover>
          )}
        </div>
      </ErrorBoundary>
    )
  }

  getShouldShowButtonObj = (props) => {
    let shouldShowButton = {}
    try {
      const displayType = props.responseRef?.state?.displayType
      const columns = props.responseRef?.getColumns()
      const isTable = isTableType(displayType)
      const isChart = isChartType(displayType)
      const isPivotTable = displayType === 'pivot_table'
      const response = props.responseRef?.queryResponse
      const isDataResponse = response?.data?.data?.display_type === 'data'
      const allColumnsHidden = areAllColumnsHidden(columns)
      const someColumnsHidden = areSomeColumnsHidden(columns)
      const numRows = response?.data?.data?.rows?.length
      const hasData = numRows > 0
      const isFiltered = !!props.responseRef?.tableParams?.filters?.length
      const hasMoreThanOneRow = (numRows > 1 && !isFiltered) || !!isFiltered
      const autoQLConfig = getAutoQLConfig(props.autoQLConfig)

      shouldShowButton = {
        showFilterButton: isTable && !isPivotTable && !allColumnsHidden && hasMoreThanOneRow,
        showCopyButton: isTable && !allColumnsHidden,
        showSaveAsPNGButton: isChart,
        showHideColumnsButton:
          autoQLConfig.enableColumnVisibilityManager &&
          hasData &&
          (displayType === 'table' || (displayType === 'text' && allColumnsHidden)),
        showHiddenColsBadge: someColumnsHidden,
        showSQLButton: isDataResponse && autoQLConfig.debug,
        showSaveAsCSVButton: isTable && hasMoreThanOneRow && autoQLConfig.enableCSVDownload,
        showDeleteButton: props.enableDeleteBtn,
        showReportProblemButton: autoQLConfig.enableReportProblem && !!response?.data?.data?.query_id,
        showCreateNotificationIcon:
          isDataResponse && autoQLConfig.enableNotifications && !this.isDrilldownResponse(props),
        showRefreshDataButton: false,
      }

      shouldShowButton.showMoreOptionsButton =
        shouldShowButton.showCopyButton ||
        shouldShowButton.showSQLButton ||
        shouldShowButton.showCreateNotificationIcon ||
        shouldShowButton.showSaveAsCSVButton ||
        shouldShowButton.showSaveAsPNGButton
    } catch (error) {
      console.error(error)
    }

    return shouldShowButton
  }

  render = () => {
    const shouldShowButton = this.getShouldShowButtonObj(this.props)

    // If there is nothing to put in the toolbar, don't render it
    if (!Object.values(shouldShowButton).find((showButton) => showButton === true)) {
      return null
    }

    return (
      <ErrorBoundary>
        {this.renderToolbar(shouldShowButton)}
        {shouldShowButton.showHideColumnsButton && this.renderHideColumnsModal()}
        {shouldShowButton.showReportProblemButton && this.renderReportProblemModal()}
        {shouldShowButton.showCreateNotificationIcon && this.renderDataAlertModal()}
        {shouldShowButton.showSQLButton && this.renderSQLModal()}
        <ReactTooltip
          className='react-autoql-tooltip'
          id={`react-autoql-options-toolbar-tooltip-${this.COMPONENT_KEY}`}
          effect='solid'
          delayShow={800}
        />
      </ErrorBoundary>
    )
  }
}

export default React.forwardRef(({ ...props }, ref) => <OptionsToolbar {...props} ref={ref} />)
