import React, { Component } from 'react'
import { getBandScale, getLinearScales, deepEqual } from 'autoql-fe-utils'

import { Axes } from '../Axes'
import { Bars } from '../Bars'

import { chartPropTypes, chartDefaultProps } from '../chartPropHelpers.js'

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

  componentDidUpdate(prevProps, prevState) {
    // Check if the scale has changed (for average/regression line redrawing)
    const wasChartScaled = prevState.isChartScaled
    const isChartScaled = this.state.isChartScaled

    if (wasChartScaled !== isChartScaled) {
      // Scale has changed, increment scale version to force line redrawing
      this.props.incrementScaleVersion?.()
    }
  }

  setChartData = (props) => {
    let numberColumnIndices = props.numberColumnIndices
    if (props.visibleSeriesIndices?.length) {
      numberColumnIndices = props.visibleSeriesIndices
    }

    this.yScale = getBandScale({
      ...props,
      columnIndex: props.stringColumnIndex,
      axis: 'y',
    })

    const xScalesAndTicks = getLinearScales({
      ...props,
      columnIndices1: numberColumnIndices,
      isScaled: this.state?.isChartScaled,
      axis: 'x',
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
          {!this.props.hidden && <Bars {...this.props} xScale={this.xScale} yScale={this.yScale} />}
        </Axes>
      </g>
    )
  }
}
