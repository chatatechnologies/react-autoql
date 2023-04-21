import React from 'react'
import PropTypes from 'prop-types'
import { QueryOutput } from '../QueryOutput'
import { VizToolbar } from '../VizToolbar'
import { OptionsToolbar } from '../OptionsToolbar'
import { authenticationType, autoQLConfigType, dataFormattingType } from '../../props/types'
import {
  authenticationDefault,
  autoQLConfigDefault,
  dataFormattingDefault,
  getAutoQLConfig,
} from '../../props/defaults'

export default class DrilldownTable extends React.Component {
  static propTypes = {
    authentication: authenticationType,
    autoQLConfig: autoQLConfigType,
    dataFormatting: dataFormattingType,
    tooltipID: PropTypes.string,
    chartTooltipID: PropTypes.string,
    reportProblemCallback: PropTypes.func,
  }

  static defaultProps = {
    authentication: authenticationDefault,
    autoQLConfig: autoQLConfigDefault,
    dataFormatting: dataFormattingDefault,
    tooltipID: null,
    chartTooltipID: null,
    reportProblemCallback: () => {},
  }

  componentDidMount = () => {
    this.setState({
      isMounted: true,
    })
  }

  render = () => {
    return (
      <div className='react-autoql-dashboard-drilldown-table'>
        <div className='dashboard-drilldown-table-and-toolbars-container'>
          <QueryOutput
            ref={(r) => (this.responseRef = r)}
            vizToolbarRef={this.vizToolbarRef}
            optionsToolbarRef={this.optionsToolbarRef}
            initialDisplayType='table'
            isResizing={this.props.isResizing}
            authentication={this.props.authentication}
            autoQLConfig={{
              ...getAutoQLConfig(this.props.autoQLConfig),
              enableDrilldowns: false,
            }}
            originalQueryID={this.props.queryResponse?.data?.data?.query_id}
            dataFormatting={this.props.dataFormatting}
            queryResponse={this.props.queryResponse}
            renderTooltips={false}
            reportProblemCallback={this.props.reportProblemCallback}
            enableAjaxTableData={this.props.enableAjaxTableData}
            showQueryInterpretation={this.props.showQueryInterpretation}
            reverseTranslationPlacement='top'
            tooltipID={this.props.tooltipID}
            chartTooltipID={this.props.chartTooltipID}
            allowDisplayTypeChange={true}
            height='100%'
            width='100%'
          />
          <div className='drilldown-modal-toolbars'>
            <div className='drilldown-modal-viz-toolbar'>
              <VizToolbar
                ref={(r) => (this.vizToolbarRef = r)}
                autoQLConfig={this.props.autoQLConfig}
                responseRef={this.responseRef}
                tooltipID={this.props.tooltipID}
              />
            </div>
            <div className='drilldown-modal-options-toolbar'>
              <OptionsToolbar
                authentication={this.props.authentication}
                autoQLConfig={{ ...getAutoQLConfig(this.props.autoQLConfig), enableNotifications: false }}
                ref={(r) => (this.optionsToolbarRef = r)}
                responseRef={this.responseRef}
                tooltipID={this.props.tooltipID}
                onErrorCallback={this.props.onErrorCallback}
                onSuccessAlert={this.props.onSuccessCallback}
                popoverPositions={['top', 'left', 'right', 'bottom']}
                popoverAlign='end'
              />
            </div>
          </div>
        </div>
      </div>
    )
  }
}
