import React, { Component } from 'react'
import { Axes } from '../Axes'
import { Points } from '../Points'
import { chartDefaultProps, chartPropTypes, getLinearScale, getMinAndMaxValues } from '../helpers.js'
import { getNumberColumnIndices } from '../../QueryOutput/columnHelpers'
import { deepEqual } from '../../../js/Util'

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

  shouldComponentUpdate = (nextProps, nextState) => {
    const propsEqual = deepEqual(this.props, nextProps)
    const stateEqual = deepEqual(this.state, nextState)

    return !propsEqual || !stateEqual
  }

  getNumberColumnIndices = (props) => {
    let numberColumnIndex = props.numberColumnIndex
    let numberColumnIndex2 = props.numberColumnIndex2
    let numberColumnIndices = props.numberColumnIndices
    let numberColumnIndices2 = props.numberColumnIndices2

    if (isNaN(numberColumnIndex) || isNaN(numberColumnIndex2)) {
      if (isNaN(this.numberColumnIndex)) {
        const numberColIndexData = getNumberColumnIndices(this.props.columns)
        this.numberColumnIndex = numberColIndexData.numberColumnIndex
        this.numberColumnIndex2 = numberColIndexData.numberColumnIndex2
        this.numberColumnIndices = numberColIndexData.numberColumnIndices
        this.numberColumnIndices2 = numberColIndexData.numberColumnIndices2
      }

      numberColumnIndex = this.numberColumnIndex
      numberColumnIndex2 = this.numberColumnIndex2
      numberColumnIndices = this.numberColumnIndices
      numberColumnIndices2 = this.numberColumnIndices2
    }

    return { numberColumnIndex, numberColumnIndex2, numberColumnIndices, numberColumnIndices2 }
  }

  setChartData = (props) => {
    const { isXScaled, isYScaled } = this.state

    const { numberColumnIndex, numberColumnIndex2, numberColumnIndices, numberColumnIndices2 } =
      this.getNumberColumnIndices(props)

    const xMinMax = getMinAndMaxValues(props.data, numberColumnIndices, isXScaled)
    const xMaxValue = xMinMax.maxValue
    const xMinValue = xMinMax.minValue

    this.xScale = getLinearScale({
      props,
      minValue: xMinValue,
      maxValue: xMaxValue,
      axis: 'x',
      isScaled: isXScaled,
      columnIndex: numberColumnIndex,
      changeColumnIndices: (indices) => props.changeNumberColumnIndices(indices),
      allowMultipleSeries: false,
    })

    const yMinMax = getMinAndMaxValues(props.data, numberColumnIndices2, isYScaled)
    const yMaxValue = yMinMax.maxValue
    const yMinValue = yMinMax.minValue

    this.yScale = getLinearScale({
      props,
      minValue: yMinValue,
      maxValue: yMaxValue,
      axis: 'y',
      isScaled: isYScaled,
      columnIndex: numberColumnIndex2,
      changeColumnIndices: (indices) => props.changeNumberColumnIndices(numberColumnIndices, indices),
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
        <Points {...this.props} xScale={this.xScale} yScale={this.yScale} />
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
