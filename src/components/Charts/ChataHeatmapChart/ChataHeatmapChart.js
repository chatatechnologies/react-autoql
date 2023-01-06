import React, { Component } from 'react'
import { Axes } from '../Axes'
import { Squares } from '../Squares'

import { chartDefaultProps, chartPropTypes, getBandScale, shouldRecalculateLongestLabel } from '../helpers.js'

import { shouldLabelsRotate, getLongestLabelInPx } from '../../../js/Util.js'
import { getDataFormatting } from '../../../props/defaults'

export default class ChataHeatmapChart extends Component {
  constructor(props) {
    super(props)

    this.setChartData(props)
    this.setLongestLabelWidth(props)
    this.setLabelRotationValue(props)
  }

  static propTypes = chartPropTypes
  static defaultProps = chartDefaultProps

  shouldComponentUpdate = () => {
    return true
  }

  componentDidUpdate = (prevProps) => {
    if (shouldRecalculateLongestLabel(prevProps, this.props)) {
      this.setLongestLabelWidth(this.props)
    }
  }

  setLabelRotationValue = () => {
    const rotateLabels = shouldLabelsRotate(this.xScale.bandwidth(), this.longestLabelWidth)

    if (typeof rotateLabels !== 'undefined') {
      this.rotateLabels = rotateLabels
    }
  }

  setLongestLabelWidth = (props) => {
    this.longestLabelWidth = getLongestLabelInPx(
      this.xTickValues,
      props.columns[props.stringColumnIndex],
      getDataFormatting(props.dataFormatting),
    )
  }

  setChartData = (props) => {
    this.xScale = getBandScale({
      props,
      columnIndex: props.stringColumnIndex,
      axis: 'x',
      innerPadding: 0.01,
    })

    this.yScale = getBandScale({
      props,
      domain: props.legendLabels.map((d) => d.label),
      axis: 'y',
      innerPadding: 0.01,
    })
  }

  render = () => {
    this.setChartData(this.props)
    this.setLabelRotationValue(this.props)

    return (
      <g
        ref={(r) => (this.chartRef = r)}
        className='react-autoql-axes-chart react-autoql-heatmap-chart'
        data-test='react-autoql-heatmap-chart'
        transform={`translate(${this.props.deltaX}, ${this.props.deltaY})`}
      >
        {this.props.marginAdjustmentFinished && <Squares {...this.props} xScale={this.xScale} yScale={this.yScale} />}
        <Axes
          {...this.props}
          ref={(r) => (this.axesRef = r)}
          xScale={this.xScale}
          yScale={this.yScale}
          xCol={this.props.columns[this.props.stringColumnIndex]}
          yCol={this.props.legendColumn}
          rotateLabels={this.rotateLabels}
          bottomAxisTitle={this.props.stringAxisTitle}
          leftAxisTitle={this.props.legendTitle}
        />
      </g>
    )
  }
}
