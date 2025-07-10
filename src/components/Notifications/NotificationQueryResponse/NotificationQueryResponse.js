import React from 'react'
import PropTypes from 'prop-types'
import { authenticationDefault, autoQLConfigDefault, dataFormattingDefault } from 'autoql-fe-utils'
import { isMobile } from 'react-device-detect'
import { VizToolbar } from '../../VizToolbar'
import { LoadingDots } from '../../LoadingDots'
import { QueryOutput } from '../../QueryOutput'
import OptionsToolbar from '../../OptionsToolbar/OptionsToolbar'

import { authenticationType, autoQLConfigType, dataFormattingType } from '../../../props/types'

export default class NotificationQueryResponse extends React.Component {
  constructor(props) {
    super(props)
    this.state = {
      isMounted: false,
      outputRef: null,
      localRTFilterResponse: null,
    }
  }
  setOutputRef = (r) => {
    this.setState({ outputRef: r })
  }
  static propTypes = {
    authentication: authenticationType,
    autoQLConfig: autoQLConfigType,
    dataFormatting: dataFormattingType,
    tooltipID: PropTypes.string,
    chartTooltipID: PropTypes.string,
    reportProblemCallback: PropTypes.func,
    onSuccessCallback: PropTypes.func,
    onErrorCallback: PropTypes.func,
  }

  static defaultProps = {
    authentication: authenticationDefault,
    autoQLConfig: autoQLConfigDefault,
    dataFormatting: dataFormattingDefault,
    reportProblemCallback: () => {},
    onSuccessCallback: () => {},
    onErrorCallback: () => {},
  }

  onUpdateFilterResponse = (localRTFilterResponse) => {
    this.setState({ localRTFilterResponse })
  }

  componentDidMount = () => {
    this.setState({
      isMounted: true,
    })
  }

  renderVisualization = () => {
    const { queryResponse } = this.props

    return (
      <div className='react-autoql-notification-chart-container'>
        <div ref={(r) => (this.dataContainer = r)} className='react-autoql-notification-query-data-container'>
          {queryResponse ? (
            <QueryOutput
              ref={this.setOutputRef}
              vizToolbarRef={this.vizToolbarRef}
              optionsToolbarRef={this.optionsToolbarRef}
              authentication={this.props.authentication}
              autoQLConfig={this.props.autoQLConfig}
              dataFormatting={this.props.dataFormatting}
              queryResponse={queryResponse}
              autoChartAggregations={this.props.autoChartAggregations}
              isResizing={this.props.isResizing || !this.props.shouldRender}
              popoverParentElement={this.props.popoverParentElement}
              showSingleValueResponseTitle={true}
              tooltipID={this.props.tooltipID}
              chartTooltipID={this.props.chartTooltipID}
              showQueryInterpretation={false}
              enableDynamicCharting={true}
              useInfiniteScroll={false}
              onUpdateFilterResponse={this.onUpdateFilterResponse}
            />
          ) : (
            <div style={{ position: 'absolute', top: 0 }} className='loading-container-centered'>
              <LoadingDots />
            </div>
          )}
        </div>
      </div>
    )
  }

  renderToolbar = () => {
    if (!this.props.shouldRender) {
      return null
    }

    return (
      <div className='react-autoql-notification-toolbar-container'>
        <div>
          <VizToolbar
            autoQLConfig={this.props.autoQLConfig}
            ref={(r) => (this.vizToolbarRef = r)}
            responseRef={this.state.outputRef}
          />
        </div>
        <div>
          <OptionsToolbar
            authentication={this.props.authentication}
            autoQLConfig={this.props.autoQLConfig}
            ref={(r) => (this.optionsToolbarRef = r)}
            responseRef={this.state.outputRef}
            onSuccessAlert={this.props.onSuccessCallback}
            onErrorCallback={this.props.onErrorCallback}
            popoverPositions={['top', 'left', 'bottom', 'right']}
            enableFilterBtn={this.props.enableFilterBtn}
            popoverAlign='end'
            showFilterBadge={this.state.outputRef?.tableRef?.getTabulatorHeaderFilters()?.length > 0}
          />
        </div>
      </div>
    )
  }

  render = () => {
    return (
      <div
        className={`react-autoql-notification-data-container ${isMobile ? 'mobile' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        {this.renderVisualization()}
        {this.renderToolbar()}
      </div>
    )
  }
}
