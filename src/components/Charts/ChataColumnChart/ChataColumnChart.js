import React, { Component } from 'react'
import { Axes } from '../Axes'
import { Columns } from '../Columns'

import { chartDefaultProps, chartPropTypes, getBandScale, getLinearScales } from '../helpers.js'
import { deepEqual } from '../../../js/Util'

export default class ChataColumnChart extends Component {
  constructor(props) {
    super(props)

    this.setChartData(props)

    this.state = {
      isChartScaled: false,
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
      props,
      columnIndex: props.stringColumnIndex,
      axis: 'x',
    })

    const yScalesAndTicks = getLinearScales({
      props,
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

  render = () => {
    this.setChartData(this.props)

    const yCol = this.props.columns[this.props.numberColumnIndex]

    return (
      <g
        ref={(r) => (this.chartRef = r)}
        className='react-autoql-axes-chart'
        data-test='react-autoql-column-chart'
        transform={`translate(${this.props.deltaX}, ${this.props.deltaY})`}
      >
        <Axes
          {...this.props}
          ref={(r) => (this.axesRef = r)}
          chartRef={this.chartRef}
          xScale={this.xScale}
          yScale={this.yScale}
          xCol={this.props.columns[this.props.stringColumnIndex]}
          yCol={yCol}
          linearAxis='y'
          hasRightLegend={this.props.legendLocation === 'right'}
          hasBottomLegend={this.props.legendLocation === 'bottom'}
          hasXDropdown={this.props.hasStringDropdown}
          hasYDropdown={this.props.hasNumberDropdown}
          // leftAxisTitle={this.props.numberAxisTitle}
          // bottomAxisTitle={this.props.stringAxisTitle}
          toggleChartScale={this.toggleChartScale}
          yGridLines
        >
          {this.props.marginAdjustmentFinished && <Columns {...this.props} xScale={this.xScale} yScale={this.yScale} />}
        </Axes>
      </g>
    )
  }
}
