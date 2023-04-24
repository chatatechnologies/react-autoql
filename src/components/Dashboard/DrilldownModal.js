import React, { Fragment } from 'react'
import PropTypes from 'prop-types'
import { v4 as uuid } from 'uuid'
import RGL, { WidthProvider } from 'react-grid-layout'
import _isEqual from 'lodash.isequal'
import _cloneDeep from 'lodash.clonedeep'
import SplitterLayout from 'react-splitter-layout'

import { Modal } from '../Modal'
import { DashboardTile } from './DashboardTile'
import { QueryOutput } from '../QueryOutput'
import { LoadingDots } from '../LoadingDots'
import { ErrorBoundary } from '../../containers/ErrorHOC'
import { hideTooltips, rebuildTooltips, Tooltip } from '../Tooltip'
import ReportProblemModal from '../OptionsToolbar/ReportProblemModal'
import DrilldownTable from './DrilldownTable'

import { deepEqual, mergeSources } from '../../js/Util'
import { CHART_TYPES } from '../../js/Constants'
import { withTheme } from '../../theme'
import { authenticationType, autoQLConfigType, dataFormattingType } from '../../props/types'
import {
  authenticationDefault,
  autoQLConfigDefault,
  dataFormattingDefault,
  getAutoQLConfig,
} from '../../props/defaults'

export default class DrilldownModal extends React.Component {
  constructor(props) {
    super(props)

    this.COMPONENT_KEY = uuid()
    this.SOURCE = mergeSources(props.source, 'dashboards')
    this.TOOLTIP_ID = `react-autoql-dashboard-toolbar-btn-tooltip-${this.COMPONENT_KEY}`
    this.CHART_TOOLTIP_ID = `react-autoql-chart-tooltip-${this.COMPONENT_KEY}`
    this.tileRefs = {}
    this.debounceTime = 50
    this.onChangeTiles = null
    this.callbackSubsciptions = []
    this.tileLog = []
    this.currentLogIndex = 0

    this.state = {
      isDragging: false,
      isReportProblemOpen: false,
      isResizingDrilldown: false,
    }
  }

  static propTypes = {
    // Global
    authentication: authenticationType,
    autoQLConfig: autoQLConfigType,
    dataFormatting: dataFormattingType,

    tiles: PropTypes.arrayOf(PropTypes.shape({})),
    executeOnMount: PropTypes.bool,
    dataPageSize: PropTypes.number,
    executeOnStopEditing: PropTypes.bool,
    isEditing: PropTypes.bool,
    isEditable: PropTypes.bool,
    notExecutedText: PropTypes.string,
    onChange: PropTypes.func,
    enableDynamicCharting: PropTypes.bool,
    onErrorCallback: PropTypes.func,
    onSuccessCallback: PropTypes.func,
    autoChartAggregations: PropTypes.bool,
    onCSVDownloadStart: PropTypes.func,
    onCSVDownloadProgress: PropTypes.func,
    onCSVDownloadFinish: PropTypes.func,
    enableAjaxTableData: PropTypes.bool,
    cancelQueriesOnUnmount: PropTypes.bool,
  }

  static defaultProps = {
    // Global
    authentication: authenticationDefault,
    autoQLConfig: autoQLConfigDefault,
    dataFormatting: dataFormattingDefault,

    tiles: [],
    executeOnMount: true,
    dataPageSize: undefined,
    executeOnStopEditing: true,
    isEditing: false,
    isEditable: true,
    notExecutedText: undefined,
    enableDynamicCharting: true,
    autoChartAggregations: true,
    enableAjaxTableData: false,
    cancelQueriesOnUnmount: false,
    onErrorCallback: () => {},
    onSuccessCallback: () => {},
    onChange: () => {},
    onCSVDownloadStart: () => {},
    onCSVDownloadProgress: () => {},
    onCSVDownloadFinish: () => {},
  }

  componentDidUpdate = (prevProps, prevState) => {
    if (this.splitterLayoutRef?.splitter) {
      this.renderSplitterCollapseBtn()
    }

    if (prevState.isDrilldownChartHidden !== this.state.isDrilldownChartHidden) {
      rebuildTooltips()
    }
  }

  renderSplitterCollapseBtn = () => {
    const splitterBtn = document.querySelector(`#splitter-btn-${this.COMPONENT_KEY}`)
    if (splitterBtn) {
      splitterBtn.setAttribute('data-tip', this.state.isDrilldownChartHidden ? 'Show chart' : 'Hide chart')
    } else {
      const btn = document.createElement('div')
      btn.innerHTML = '&#94;'
      btn.className = 'splitter-collapse-btn'
      btn.id = `splitter-btn-${this.COMPONENT_KEY}`
      btn.setAttribute('data-for', this.TOOLTIP_ID)

      btn.addEventListener('click', () => {
        this.setState(
          {
            isDrilldownChartHidden: !this.state.isDrilldownChartHidden,
            isResizingDrilldown: true,
          },
          () => {
            this.setState({ isResizingDrilldown: false })
          },
        )
      })
      this.splitterLayoutRef.splitter.parentNode.insertBefore(btn, this.splitterLayoutRef.splitter.nextSibling)
    }
  }

  onDrilldownStart = ({ tileId, activeKey, isSecondHalf, queryOutputRef }) => {
    if (getAutoQLConfig(this.props.autoQLConfig).enableDrilldowns) {
      this.props.activeDrilldownRef = queryOutputRef
      this.setState({
        isDrilldownRunning: true,
        isDrilldownChartHidden: false,
        isDrilldownModalVisible: true,
        isDrilldownSecondHalf: isSecondHalf,
        activeDrilldownTile: tileId || this.state.activeDrilldownTile,
        activeDrilldownResponse: null,
        activeDrilldownChartElementKey: activeKey,
        isAnimatingModal: !this.state.isDrilldownModalVisible,
      })

      this.animationTimeout = setTimeout(() => {
        if (this._isMounted) {
          this.setState({
            isAnimatingModal: false,
          })
        }
      }, 500)
    }
  }

  onDrilldownEnd = ({ response, error }) => {
    if (response) {
      if (this._isMounted) {
        this.setState({
          activeDrilldownResponse: response,
          isDrilldownRunning: false,
        })
      }
    } else if (error) {
      console.error(error)
      if (this._isMounted) {
        this.setState({
          isDrilldownRunning: false,
          activeDrilldownResponse: undefined,
        })
      }
    }
  }

  shouldShowOriginalQuery = () => {
    const displayType = this.props.activeDrilldownRef?.state?.displayType
    if (!displayType) {
      return false
    }

    return CHART_TYPES.includes(displayType)
  }

  reportProblemCallback = () => {
    this.setState({ isReportProblemOpen: true })
  }

  renderDrilldownTable = () => {
    if (this.props.isDrilldownRunning) {
      return (
        <div className='react-autoql-dashboard-drilldown-table'>
          <div className='dashboard-tile-loading-container'>
            <LoadingDots />
          </div>
        </div>
      )
    }

    const queryResponse = this.props.activeDrilldownRef?.queryResponse
    return (
      <DrilldownTable
        authentication={this.props.authentication}
        autoQLConfig={this.props.autoQLConfig}
        dataFormatting={this.props.dataFormatting}
        isResizing={this.props.isAnimating || this.state.isResizingDrilldown}
        isLoading={this.props.isDrilldownRunning}
        queryResponse={queryResponse}
        tooltipID={this.props.tooltipID}
        chartTooltipID={this.props.chartTooltipID}
        reportProblemCallback={this.reportProblemCallback}
        enableAjaxTableData={this.props.enableAjaxTableData}
        showQueryInterpretation={this.props.showQueryInterpretation}
        onErrorCallback={this.props.onErrorCallback}
        onSuccessCallback={this.props.onSuccessCallback}
      />
    )
  }

  renderReportProblemModal = () => {
    return (
      <ReportProblemModal
        authentication={this.props.authentication}
        contentClassName='dashboard-drilldown-report-problem-modal'
        onClose={this.closeReportProblemModal}
        onReportProblem={this.onReportProblem}
        responseRef={this.drilldownTableRef}
        isVisible={this.state.isReportProblemOpen}
      />
    )
  }

  closeReportProblemModal = () => {
    this.setState({
      isReportProblemOpen: false,
    })
  }

  onReportProblem = ({ successMessage, error }) => {
    if (successMessage) {
      this.props.onSuccessCallback(successMessage)
      if (this._isMounted) {
        this.setState({
          isReportProblemOpen: false,
        })
      }
    } else if (error) {
      this.props.onErrorCallback(error)
    }
  }

  render = () => {
    let queryResponse
    if (this.props.isOpen) {
      queryResponse = this.props.activeDrilldownRef?.queryResponse
      if (queryResponse) {
        queryResponse.data.data.columns = this.props.activeDrilldownRef?.state?.columns
      }
    }

    const renderTopHalf = !this.state.isDrilldownChartHidden && this.shouldShowOriginalQuery()

    return (
      <ErrorBoundary>
        <Modal
          className='dashboard-drilldown-modal'
          contentClassName={`dashboard-drilldown-modal-content
            ${this.state.isDrilldownChartHidden ? 'chart-hidden' : ''}
            ${!this.shouldShowOriginalQuery() ? 'table-only' : ''}`}
          title={this.props.activeDrilldownRef?.queryResponse?.data?.data?.text}
          isVisible={this.props.isOpen}
          width='90vw'
          height='100vh'
          confirmText='Done'
          showFooter={false}
          shouldRender={this.props.shouldRender}
          onClose={this.props.onClose}
        >
          <Fragment>
            {!!this.props.activeDrilldownRef?.queryResponse && (
              <SplitterLayout
                ref={(r) => (this.splitterLayoutRef = r)}
                vertical={true}
                percentage={true}
                primaryMinSize={renderTopHalf ? 35 : 0}
                secondaryMinSize={25}
                secondaryInitialSize={50}
                onDragStart={() => this.setState({ isResizingDrilldown: true })}
                onDragEnd={() => this.setState({ isResizingDrilldown: false })}
              >
                <div className='react-autoql-dashboard-drilldown-original'>
                  {this.shouldShowOriginalQuery() && (
                    <>
                      {!!this.props.activeDrilldownRef?.queryResponse && (
                        <QueryOutput
                          {...this.props.activeDrilldownRef.props}
                          ref={(r) => (this.drilldownTopRef = r)}
                          queryResponse={queryResponse}
                          isDrilldownChartHidden={this.state.isDrilldownChartHidden}
                          key={`dashboard-drilldown-chart-${this.props.activeDrilldownRef?.queryResponse?.query_id}`}
                          activeChartElementKey={this.props.activeDrilldownChartElementKey}
                          initialDisplayType={this.props.activeDrilldownRef?.state?.displayType}
                          initialTableConfigs={{
                            tableConfig: this.props.activeDrilldownRef.tableConfig,
                            pivotTableConfig: this.props.activeDrilldownRef.pivotTableConfig,
                          }}
                          isAnimating={this.props.isAnimating}
                          isResizing={this.state.isResizingDrilldown || !this.props.isOpen}
                          showQueryInterpretation={this.props.showQueryInterpretation}
                          reverseTranslationPlacement='top'
                          allowDisplayTypeChange={false}
                          source={this.SOURCE}
                          height='100%'
                          width='100%'
                        />
                      )}
                    </>
                  )}
                </div>
                {this.renderDrilldownTable()}
              </SplitterLayout>
            )}
          </Fragment>
        </Modal>
        {this.renderReportProblemModal()}
      </ErrorBoundary>
    )
  }
}
