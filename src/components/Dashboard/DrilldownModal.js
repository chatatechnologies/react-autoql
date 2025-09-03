import React from 'react'
import { v4 as uuid } from 'uuid'
import PropTypes from 'prop-types'
import SplitterLayout from 'react-splitter-layout'
import _cloneDeep from 'lodash.clonedeep'
import { CHART_TYPES, authenticationDefault, autoQLConfigDefault, dataFormattingDefault } from 'autoql-fe-utils'

import { Modal } from '../Modal'
import { QueryOutput } from '../QueryOutput'
import { LoadingDots } from '../LoadingDots'
import DrilldownTable from './DrilldownTable'
import { ErrorBoundary } from '../../containers/ErrorHOC'
import { ReportProblemModal } from '../ReportProblemModal'

import { authenticationType, autoQLConfigType, dataFormattingType } from '../../props/types'

export default class DrilldownModal extends React.Component {
  constructor(props) {
    super(props)

    this.COMPONENT_KEY = uuid()

    this.state = {
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
    onPNGDownloadFinish: PropTypes.func,
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
    cancelQueriesOnUnmount: false,
    onErrorCallback: () => {},
    onSuccessCallback: () => {},
    onChange: () => {},
    onCSVDownloadStart: () => {},
    onCSVDownloadProgress: () => {},
    onCSVDownloadFinish: () => {},
    onPNGDownloadFinish: () => {},
  }

  componentDidUpdate = (prevProps, prevState) => {
    if (this.splitterLayoutRef?.splitter) {
      this.renderSplitterCollapseBtn()
    }
  }

  renderSplitterCollapseBtn = () => {
    const splitterBtn = document.querySelector(`#splitter-btn-${this.COMPONENT_KEY}`)
    if (splitterBtn) {
      splitterBtn.setAttribute('data-tooltip-content', this.state.isDrilldownChartHidden ? 'Show chart' : 'Hide chart')
    } else {
      const btn = document.createElement('div')
      btn.innerHTML = '&#94;'
      btn.className = 'splitter-collapse-btn'
      btn.id = `splitter-btn-${this.COMPONENT_KEY}`
      btn.setAttribute('data-tooltip-id', this.props.tooltipID)

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

    return (
      <DrilldownTable
        authentication={this.props.authentication}
        autoQLConfig={this.props.autoQLConfig}
        dataFormatting={this.props.dataFormatting}
        isResizing={this.props.isAnimating || this.state.isResizingDrilldown}
        isLoading={this.props.isDrilldownRunning}
        queryResponse={this.props.drilldownResponse}
        tooltipID={this.props.tooltipID}
        chartTooltipID={this.props.chartTooltipID}
        reportProblemCallback={this.reportProblemCallback}
        showQueryInterpretation={this.props.showQueryInterpretation}
        onErrorCallback={this.props.onErrorCallback}
        onSuccessCallback={this.props.onSuccessCallback}
        onCSVDownloadStart={this.props.onCSVDownloadStart}
        onCSVDownloadProgress={this.props.onCSVDownloadProgress}
        onCSVDownloadFinish={this.props.onCSVDownloadFinish}
        onPNGDownloadFinish={this.props.onPNGDownloadFinish}
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
      queryResponse = _cloneDeep(this.props.activeDrilldownRef?.queryResponse)
      if (queryResponse) {
        queryResponse.data.data.columns = _cloneDeep(this.props.activeDrilldownRef?.state?.columns)
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
          <>
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
                          source={this.props.source}
                          enableCustomColumns={this.props.enableCustomColumns}
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
          </>
        </Modal>
        {this.renderReportProblemModal()}
      </ErrorBoundary>
    )
  }
}
