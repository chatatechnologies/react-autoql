import React from 'react'
import { v4 as uuid } from 'uuid'
import PropTypes from 'prop-types'
import { format } from 'sql-formatter'
import _cloneDeep from 'lodash.clonedeep'
import { isMobile } from 'react-device-detect'
import {
  setColumnVisibility,
  exportCSV,
  isTableType,
  areAllColumnsHidden,
  areSomeColumnsHidden,
  isChartType,
  deepEqual,
  autoQLConfigDefault,
  authenticationDefault,
  getAuthentication,
  getAutoQLConfig,
  dataFormattingDefault,
} from 'autoql-fe-utils'

import { Icon } from '../Icon'
import { Modal } from '../Modal'
import { Button } from '../Button'
import { Popover } from '../Popover'
import { Tooltip } from '../Tooltip'
import { ReportProblemModal } from '../ReportProblemModal'
import ErrorBoundary from '../../containers/ErrorHOC/ErrorHOC'
import { ColumnVisibilityModal } from '../ColumnVisibilityModal'
import DataAlertModal from '../Notifications/DataAlertModal/DataAlertModal'

import { autoQLConfigType, authenticationType, dataFormattingType } from '../../props/types'

import './OptionsToolbar.scss'

export class OptionsToolbar extends React.Component {
  constructor(props) {
    super(props)

    this.COMPONENT_KEY = uuid()
    this.TOOLTIP_ID = `react-autoql-options-toolbar-tooltip-${this.COMPONENT_KEY}`

    this.state = {
      isHideColumnsModalVisible: false,
      isSettingColumnVisibility: false,
      reportProblemMessage: undefined,
      isCSVDownloading: false,
      isFiltering: !!props.responseRef?.isFilteringTable(),
    }
  }

  static propTypes = {
    authentication: authenticationType,
    autoQLConfig: autoQLConfigType,
    dataFormatting: dataFormattingType,
    enableDeleteBtn: PropTypes.bool,
    shouldRender: PropTypes.bool,
    enableFilterBtn: PropTypes.bool,
    onSuccessAlert: PropTypes.func,
    onErrorCallback: PropTypes.func,
    onNewNotificationCallback: PropTypes.func,
    deleteMessageCallback: PropTypes.func,
    createDataAlertCallback: PropTypes.func,
    onCSVDownloadStart: PropTypes.func,
    onCSVDownloadFinish: PropTypes.func,
    onCSVDownloadProgress: PropTypes.func,
    showFilterBadge: PropTypes.bool,
    onExpandClick: PropTypes.func,
  }

  static defaultProps = {
    authentication: authenticationDefault,
    autoQLConfig: autoQLConfigDefault,
    dataFormatting: dataFormattingDefault,
    enableFilterBtn: true,
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
    showFilterBadge: false,
    onExpandClick: () => {},
  }

  componentDidMount = () => {
    this._isMounted = true
  }

  shouldComponentUpdate = (nextProps, nextState) => {
    if (this.state.activeMenu !== nextState.activeMenu) {
      return true
    }

    if (!this.props.shouldRender && !nextProps.shouldRender) {
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
    }
  }

  componentWillUnmount = () => {
    this._isMounted = false
    clearTimeout(this.temporaryStateTimeout)
    clearTimeout(this.pivotTableCSVDownloadTimeout)
  }
  renderOpenInNewBtn = () => {
    return (
      <Button
        onClick={this.props.onExpandClick}
        className={this.getMenuItemClass('open-in-new-btn')}
        tooltip='Open in new window'
        tooltipID={this.props.tooltipID ?? this.TOOLTIP_ID}
        data-test='options-toolbar-open-in-new-btn'
        size='small'
      >
        <Icon type='open-in-new' />
      </Button>
    )
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
    const cols = this.props.responseRef?._isMounted && this.props.responseRef?.getColumns()
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
    this.setState({ activeMenu: undefined })
  }

  renderDataAlertModal = () => {
    const queryResponse = _cloneDeep(this.props.responseRef?.queryResponse)
    const filters = this.props.responseRef?.getCombinedFilters()

    return (
      <ErrorBoundary>
        <DataAlertModal
          authentication={this.props.authentication}
          dataFormatting={this.props.dataFormatting}
          isVisible={this.state.activeMenu === 'notification'}
          onClose={this.closeDataAlertModal}
          onErrorCallback={this.props.onErrorCallback}
          onSuccessAlert={this.props.onSuccessAlert}
          onSave={this.onDataAlertSave}
          tooltipID={this.props.tooltipID}
          queryResponse={queryResponse}
          filters={filters}
          autoQLConfig={this.props.autoQLConfig}
          enableAlphaAlertSettings={!!this.props.autoQLConfig?.projectId}
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
    return `react-autoql-toolbar-btn react-autoql-btn ${className || ''}`
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
          {!!this.props.customOptions?.length &&
            !this.isDrilldownResponse(this.props) &&
            this.props.customOptions.map((option, i) => {
              return (
                <li
                  key={`custom-option-${i}`}
                  onClick={() => {
                    const responseRef = this.props.responseRef
                    const responseCopy = _cloneDeep(responseRef?.queryResponse)
                    this.setState({ activeMenu: undefined })
                    option.callback?.({
                      query: responseRef?.queryResponse?.data?.data?.text,
                      queryResponse: responseCopy,
                      aggConfig: _cloneDeep(responseRef?.state?.aggConfig),
                      displayType: responseRef?.state?.displayType,
                      columnSelects: responseCopy?.data?.data?.fe_req?.additional_selects,
                      displayOverrides: responseCopy?.data?.data?.fe_req?.display_overrides,
                      filters: responseCopy?.data?.data?.fe_req?.session_filter_locks,
                      tableFilters: responseCopy?.data?.data?.fe_req?.filters,
                      orders: responseCopy?.data?.data?.fe_req?.orders,
                      dataConfig: {
                        tableConfig: _cloneDeep(responseRef?.tableConfig),
                        pivotTableConfig: _cloneDeep(responseRef?.pivotTableConfig),
                      },
                    })
                  }}
                >
                  <Icon style={{ verticalAlign: 'middle', marginRight: '7px' }} type={option.icon} />
                  {option.name}
                </li>
              )
            })}
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
              tooltipID={this.props.tooltipID}
            >
              <Icon type='copy' />
              {this.state.sqlCopySuccess && <Icon type='check' className='sql-copied' />}
            </Button>
          </div>
        </Modal>
      </ErrorBoundary>
    )
  }

  renderFilterBtn = () => {
    const isFiltered = !!this.props.responseRef?.formattedTableParams?.filters?.length || this.props.showFilterBadge
    const displayType = this.props.responseRef?.state?.displayType
    const isTable = displayType === 'table'

    let tooltip = this.state.isFiltering ? 'Hide filters' : 'Filter table'
    if (!isTable) {
      tooltip = isFiltered ? 'Edit table filters' : 'Filter data from table'
    }

    return (
      <Button
        onClick={() => {
          const toggleFiltersOn = isTable ? !this.props.responseRef?.isFilteringTable() : true

          this.setState({ isFiltering: toggleFiltersOn })

          if (this.props.responseRef?.state?.displayType === 'table') {
            this.props.responseRef?.toggleTableFilter(toggleFiltersOn)
          } else {
            this.props.responseRef?.changeDisplayType('table', () => {
              this.props.responseRef?.toggleTableFilter(true, true)
            })
          }
        }}
        className={`${this.getMenuItemClass('filter-btn')}
          ${this.state.isFiltering && isTable ? 'react-autoql-toolbar-btn-selected' : ''}`}
        tooltip={tooltip}
        tooltipID={this.props.tooltipID ?? this.TOOLTIP_ID}
        data-test='react-autoql-filter-button'
        size='small'
      >
        <Icon type='filter' showBadge={isFiltered} />
      </Button>
    )
  }

  renderColumnVizBtn = (shouldShowButton) => {
    return (
      <Button
        onClick={this.showHideColumnsModal}
        className={this.getMenuItemClass()}
        tooltip='Show/hide columns'
        tooltipID={this.props.tooltipID ?? this.TOOLTIP_ID}
        data-test='options-toolbar-col-vis'
        size='small'
      >
        <Icon type='eye' showBadge={shouldShowButton.showHiddenColsBadge} />
      </Button>
    )
  }

  renderReportProblemBtn = () => {
    return (
      <Button
        onClick={this.openReportProblemModal}
        className={this.getMenuItemClass()}
        tooltip='Report a problem'
        tooltipID={this.props.tooltipID ?? this.TOOLTIP_ID}
        size='small'
      >
        <Icon type='warning-triangle' />
      </Button>
    )
  }

  renderToolbar = (shouldShowButton) => {
    return (
      <ErrorBoundary>
        <div
          className={`${isMobile ? 'react-autoql-toolbar-mobile' : 'react-autoql-toolbar'} options-toolbar
			${this.state.activeMenu ? 'active' : ''}
			${this.props.className || ''}`}
          data-test='autoql-options-toolbar'
        >
          {shouldShowButton.showFilterButton && this.renderFilterBtn()}
          {shouldShowButton.showHideColumnsButton && this.renderColumnVizBtn(shouldShowButton)}
          {shouldShowButton.showReportProblemButton && this.renderReportProblemBtn()}
          {shouldShowButton.showRefreshDataButton && (
            <Button
              onClick={this.refreshData}
              className={this.getMenuItemClass()}
              tooltip='Re-run query'
              tooltipID={this.props.tooltipID ?? this.TOOLTIP_ID}
              data-test='options-toolbar-trash-btn'
              size='small'
            >
              <Icon type='refresh' />
            </Button>
          )}
          {shouldShowButton.showDeleteButton && (
            <Button
              onClick={this.deleteMessage}
              className={this.getMenuItemClass()}
              tooltip='Delete data response'
              tooltipID={this.props.tooltipID ?? this.TOOLTIP_ID}
              data-test='options-toolbar-trash-btn'
              size='small'
            >
              <Icon type='trash' />
            </Button>
          )}
          {shouldShowButton.showMoreOptionsButton && (
            <Popover
              key={`more-options-button-${this.COMPONENT_KEY}`}
              isOpen={this.state.activeMenu === 'more-options'}
              padding={8}
              onClickOutside={() => this.setState({ activeMenu: undefined })}
              content={(props) => this.renderMoreOptionsMenu(props, shouldShowButton)}
              parentElement={this.props.popoverParentElement}
              boundaryElement={this.props.popoverParentElement}
              positions={this.props.popoverPositions ?? ['bottom', 'top', 'left', 'right']}
              align={this.props.popoverAlign}
            >
              <Button
                onClick={() => {
                  this.setState({ activeMenu: 'more-options' })
                }}
                className={this.getMenuItemClass('more-options')}
                tooltip='More options'
                tooltipID={this.props.tooltipID ?? this.TOOLTIP_ID}
                data-test='react-autoql-toolbar-more-options-btn'
                size='small'
              >
                <Icon type='more-vertical' />
              </Button>
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
      const response = props.responseRef?.queryResponse
      const isDataResponse = response?.data?.data?.display_type === 'data'
      const allColumnsHidden = areAllColumnsHidden(columns)
      const someColumnsHidden = areSomeColumnsHidden(columns)
      const numRows = response?.data?.data?.rows?.length
      const hasData = numRows > 0
      const isFiltered = !!props.responseRef?.formattedTableParams?.filters?.length
      const hasMoreThanOneRow = (numRows > 1 && !isFiltered) || !!isFiltered
      const autoQLConfig = getAutoQLConfig(props.autoQLConfig)

      shouldShowButton = {
        showFilterButton:
          this.props.enableFilterBtn &&
          (displayType === 'table' || isChartType(displayType)) &&
          !allColumnsHidden &&
          hasMoreThanOneRow,
        showCopyButton: isTable && !allColumnsHidden,
        showSaveAsPNGButton: isChart,
        showHideColumnsButton:
          autoQLConfig.enableColumnVisibilityManager &&
          hasData &&
          (displayType === 'table' || (displayType === 'text' && allColumnsHidden)),
        showHiddenColsBadge: someColumnsHidden,
        showSQLButton: isDataResponse && autoQLConfig.translation === 'include',
        showSaveAsCSVButton: isTable && hasMoreThanOneRow && autoQLConfig.enableCSVDownload,
        showDeleteButton: props.enableDeleteBtn,
        showReportProblemButton: autoQLConfig.enableReportProblem && !!response?.data?.data?.query_id,
        showCreateNotificationIcon: isMobile
          ? false
          : isDataResponse && autoQLConfig.enableNotifications && !this.isDrilldownResponse(props),
        showRefreshDataButton: false,
      }

      shouldShowButton.showMoreOptionsButton =
        (shouldShowButton.showCopyButton ||
          shouldShowButton.showSQLButton ||
          shouldShowButton.showCreateNotificationIcon ||
          shouldShowButton.showSaveAsCSVButton ||
          shouldShowButton.showSaveAsPNGButton) &&
        !isMobile
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
        {!this.props.tooltipID && <Tooltip tooltipId={this.TOOLTIP_ID} delayShow={800} />}
      </ErrorBoundary>
    )
  }
}

export default React.forwardRef(({ ...props }, ref) => <OptionsToolbar {...props} ref={ref} />)
