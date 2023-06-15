import React, { Component } from 'react'
import { deepEqual } from '../../../js/Util'

import { Axes } from '../Axes'
import { Bars } from '../Bars'

import { getBandScale, chartPropTypes, chartDefaultProps, getLinearScales } from '../helpers.js'

export default class ChataBarChart extends Component {
  constructor(props) {
    super(props)

    this.state = {
      isChartScaled: true,
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

    this.yScale = getBandScale({
      props,
      columnIndex: props.stringColumnIndex,
      axis: 'y',
    })

    const xScalesAndTicks = getLinearScales({
      props,
      columnIndices1: numberColumnIndices,
      axis: 'x',
      isScaled: this.state?.isChartScaled,
    })

    this.xScale = xScalesAndTicks.scale
    this.xTickValues = this.xScale.tickLabels
  }

  toggleChartScale = () => {
    this.setState({ isChartScaled: !this.state.isChartScaled })
  }

  render = () => {
    this.setChartData(this.props)

    const xCol = this.props.columns[this.props.numberColumnIndex]

    return (
      <g ref={(r) => (this.chartRef = r)} className='react-autoql-axes-chart' data-test='react-autoql-bar-chart'>
        <Axes
          {...this.props}
          ref={(r) => (this.axesRef = r)}
          chartRef={this.chartRef}
          xScale={this.xScale}
          yScale={this.yScale}
          xCol={xCol}
          yCol={this.props.columns[this.props.stringColumnIndex]}
          linearAxis='x'
          toggleChartScale={this.toggleChartScale}
        >
          <Bars {...this.props} xScale={this.xScale} yScale={this.yScale} />
        </Axes>
      </g>
    )
  }
}
