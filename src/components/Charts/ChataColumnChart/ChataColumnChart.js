import React, { Component } from 'react'
import { getBandScale, getLinearScales, deepEqual } from 'autoql-fe-utils'

import { Axes } from '../Axes'
import { Columns } from '../Columns'
import { AverageLine } from '../AverageLine'
import { AverageLineToggle } from '../AverageLineToggle'

import { chartDefaultProps, chartPropTypes } from '../chartPropHelpers.js'

export default class ChataColumnChart extends Component {
  constructor(props) {
    super(props)

    this.state = {
      isChartScaled: true,
      showAverageLine: false,
    }
  }

  static propTypes = chartPropTypes
  static defaultProps = chartDefaultProps

  shouldComponentUpdate = (nextProps, nextState) => {
    const propsEqual = deepEqual(this.props, nextProps)
    const stateEqual = deepEqual(this.state, nextState)

    return !propsEqual || !stateEqual
  }

  setChartData = (props) => {
    let numberColumnIndices = props.numberColumnIndices
    if (props.visibleSeriesIndices?.length) {
      numberColumnIndices = props.visibleSeriesIndices
    }

    this.xScale = getBandScale({
      ...props,
      columnIndex: props.stringColumnIndex,
      axis: 'x',
    })

    const yScalesAndTicks = getLinearScales({
      ...props,
      columnIndices1: numberColumnIndices,
      axis: 'y',
      isScaled: this.state?.isChartScaled,
    })

    this.yScale = yScalesAndTicks.scale
    this.yTickValues = this.yScale.tickLabels
  }

  toggleChartScale = () => {
    this.setState({ isChartScaled: !this.state.isChartScaled })
  }

  toggleAverageLine = () => {
    this.setState({ showAverageLine: !this.state.showAverageLine })
  }

  render = () => {
    this.setChartData(this.props)

    const yCol = this.props.columns[this.props.numberColumnIndex]
    const { showAverageLine } = this.state

    return (
      <g ref={(r) => (this.chartRef = r)} className='react-autoql-axes-chart' data-test='react-autoql-column-chart'>
        <Axes
          {...this.props}
          ref={(r) => (this.axesRef = r)}
          chartRef={this.chartRef}
          xScale={this.xScale}
          yScale={this.yScale}
          xCol={this.props.columns[this.props.stringColumnIndex]}
          yCol={yCol}
          linearAxis='y'
          toggleChartScale={this.toggleChartScale}
          yGridLines
        >
          {!this.props.hidden && <Columns {...this.props} xScale={this.xScale} yScale={this.yScale} />}

          {/* Average Line */}
          {showAverageLine && !this.props.hidden && (
            <AverageLine
              data={this.props.data}
              columns={this.props.columns}
              numberColumnIndex={this.props.numberColumnIndex}
              visibleSeriesIndices={this.props.visibleSeriesIndices}
              xScale={this.xScale}
              yScale={this.yScale}
              width={this.props.width}
              height={this.props.height}
              isVisible={showAverageLine}
              dataFormatting={this.props.dataFormatting}
              chartTooltipID={this.props.chartTooltipID}
            />
          )}
        </Axes>
        {/* Average Line Toggle Button */}
        {!this.props.hidden && (
          <g transform='translate(10, 10)'>
            <AverageLineToggle
              isEnabled={showAverageLine}
              onToggle={this.toggleAverageLine}
              columns={this.props.columns}
              visibleSeriesIndices={this.props.visibleSeriesIndices}
              chartTooltipID={this.props.chartTooltipID}
            />
          </g>
        )}
      </g>
    )
  }
}
