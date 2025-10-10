import React, { Component } from 'react'
import {
  getLinearScale,
  getMinAndMaxValues,
  getNumberColumnIndices,
  deepEqual,
  MAX_CHART_ELEMENTS,
} from 'autoql-fe-utils'

import { Axes } from '../Axes'
import { Points } from '../Points'

import { chartDefaultProps, chartPropTypes } from '../chartPropHelpers.js'

export default class ChataScatterplotChart extends Component {
  constructor(props) {
    super(props)

    this.state = {
      isXScaled: true,
      isYScaled: true,
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
    const wasXScaled = prevState.isXScaled
    const wasYScaled = prevState.isYScaled
    const isXScaled = this.state.isXScaled
    const isYScaled = this.state.isYScaled

    if (wasXScaled !== isXScaled || wasYScaled !== isYScaled) {
      // Scale has changed, increment scale version to force line redrawing
      this.props.incrementScaleVersion?.()
    }
  }

  setNumberColumnIndices = (props) => {
    this.numberColumnIndex = props.numberColumnIndex
    this.numberColumnIndex2 = props.numberColumnIndex2
    this.numberColumnIndices = props.numberColumnIndices
    this.numberColumnIndices2 = props.numberColumnIndices2

    if (isNaN(this.numberColumnIndex) || isNaN(this.numberColumnIndex2)) {
      const { numberColumnIndex, numberColumnIndex2, numberColumnIndices, numberColumnIndices2 } =
        getNumberColumnIndices(this.props.columns)
      this.numberColumnIndex = numberColumnIndex
      this.numberColumnIndex2 = numberColumnIndex2
      this.numberColumnIndices = numberColumnIndices
      this.numberColumnIndices2 = numberColumnIndices2
    }
  }

  setChartData = (props) => {
    const { isXScaled, isYScaled } = this.state

    this.setNumberColumnIndices(props)

    this.data = props.data?.slice(0, MAX_CHART_ELEMENTS)

    const xMinMax = getMinAndMaxValues(this.data, this.numberColumnIndices, isXScaled)
    const xMaxValue = xMinMax.maxValue
    const xMinValue = xMinMax.minValue

    this.xScale = getLinearScale({
      ...props,
      minValue: xMinValue,
      maxValue: xMaxValue,
      axis: 'x',
      isScaled: isXScaled,
      columnIndex: this.numberColumnIndex,
      changeColumnIndices: (indices) => props.changeNumberColumnIndices(indices),
      allowMultipleSeries: false,
    })

    const yMinMax = getMinAndMaxValues(this.data, this.numberColumnIndices2, isYScaled)
    const yMaxValue = yMinMax.maxValue
    const yMinValue = yMinMax.minValue

    this.yScale = getLinearScale({
      ...props,
      minValue: yMinValue,
      maxValue: yMaxValue,
      axis: 'y',
      isScaled: isYScaled,
      columnIndex: this.numberColumnIndex2,
      changeColumnIndices: (indices) => props.changeNumberColumnIndices(this.numberColumnIndices, indices),
      allowMultipleSeries: false,
    })

    this.xScale.secondScale = this.yScale
    this.yScale.secondScale = this.xScale
  }

  render = () => {
    this.setChartData(this.props)

    const columnIndexProps = {
      numberColumnIndex: this.numberColumnIndex,
      numberColumnIndex2: this.numberColumnIndex2,
      numberColumnIndices: this.numberColumnIndices,
      numberColumnIndices2: this.numberColumnIndices2,
    }

    return (
      <g
        ref={(r) => (this.chartRef = r)}
        className='react-autoql-axes-chart react-autoql-scatterplot-chart'
        data-test='react-autoql-scatterplot-chart'
      >
        <Points {...this.props} data={this.data} xScale={this.xScale} yScale={this.yScale} {...columnIndexProps} />
        <Axes
          {...this.props}
          ref={(r) => (this.axesRef = r)}
          chartRef={this.chartRef}
          xScale={this.xScale}
          yScale={this.yScale}
          xCol={this.props.columns[this.numberColumnIndex]}
          yCol={this.props.columns[this.numberColumnIndex2]}
          {...columnIndexProps}
        />
      </g>
    )
  }
}
