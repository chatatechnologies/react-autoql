import React, { Component } from 'react'
import { Axes } from '../Axes'
import { Points } from '../Points'
import { chartDefaultProps, chartPropTypes, getLinearScale, getMinAndMaxValues } from '../helpers.js'

export default class ChataScatterplotChart extends Component {
  constructor(props) {
    super(props)

    this.state = {
      isXScaled: false,
      isYScaled: false,
    }
  }

  static propTypes = chartPropTypes
  static defaultProps = chartDefaultProps

  setChartData = (props) => {
    const { isXScaled, isYScaled } = this.state
    const xMinMax = getMinAndMaxValues(props.data, props.numberColumnIndices, isXScaled)
    const xMaxValue = xMinMax.maxValue
    const xMinValue = xMinMax.minValue

    this.xScale = getLinearScale({
      props,
      minValue: xMinValue,
      maxValue: xMaxValue,
      axis: 'x',
      isScaled: isXScaled,
      columnIndex: props.numberColumnIndex,
      changeColumnIndices: (indices) => props.changeNumberColumnIndices(indices),
      allowMultipleSeries: false,
    })

    const yMinMax = getMinAndMaxValues(props.data, props.numberColumnIndices2, isYScaled)
    const yMaxValue = yMinMax.maxValue
    const yMinValue = yMinMax.minValue

    this.yScale = getLinearScale({
      props,
      minValue: yMinValue,
      maxValue: yMaxValue,
      axis: 'y',
      isScaled: isYScaled,
      columnIndex: props.numberColumnIndex2,
      changeColumnIndices: (indices) => props.changeNumberColumnIndices(undefined, indices),
      allowMultipleSeries: false,
    })

    this.xScale.secondScale = this.yScale
    this.yScale.secondScale = this.xScale
  }

  render = () => {
    this.setChartData(this.props)

    return (
      <g
        ref={(r) => (this.chartRef = r)}
        className='react-autoql-axes-chart react-autoql-scatterplot-chart'
        data-test='react-autoql-scatterplot-chart'
      >
        {this.props.marginAdjustmentFinished && <Points {...this.props} xScale={this.xScale} yScale={this.yScale} />}
        <Axes
          {...this.props}
          ref={(r) => (this.axesRef = r)}
          chartRef={this.chartRef}
          xScale={this.xScale}
          yScale={this.yScale}
          xCol={this.props.columns[this.props.numberColumnIndex]}
          yCol={this.props.columns[this.props.numberColumnIndex2]}
        />
      </g>
    )
  }
}
