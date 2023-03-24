import React, { Component } from 'react'
import { Axes } from '../Axes'
import { Columns } from '../Columns'
import { Line } from '../Line'

import { chartDefaultProps, chartPropTypes, getBandScale, getTimeScale, getLinearScales } from '../helpers.js'
import { deepEqual } from '../../../js/Util'

export default class ChataColumnLineChart extends Component {
  constructor(props) {
    super(props)

    this.setChartData(props)

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

    let numberColumnIndices2 = props.numberColumnIndices2
    if (props.visibleSeriesIndices2?.length) {
      numberColumnIndices2 = props.visibleSeriesIndices2
    }

    this.xScale = getBandScale({
      props,
      columnIndex: props.stringColumnIndex,
      axis: 'x',
    })

    const yScalesAndTicks = getLinearScales({
      props,
      columnIndices1: numberColumnIndices,
      columnIndices2: numberColumnIndices2,
      axis: 'y',
      isScaled: this.state?.isChartScaled,
    })

    this.yScale = yScalesAndTicks.scale
    this.yTickValues = this.yScale.tickLabels
    this.yScale2 = yScalesAndTicks.scale2
    this.yTickValues2 = this.yScale2?.tickLabels
  }

  toggleChartScale = () => {
    this.setState({ isChartScaled: !this.state.isChartScaled })
  }

  render = () => {
    this.setChartData(this.props)

    const yCol = this.props.columns[this.props.numberColumnIndex]
    const yCol2 = this.props.columns[this.props.numberColumnIndex2]

    if (!this.props.height || !this.props.width) {
      return null
    }

    return (
      <g
        ref={(r) => (this.chartRef = r)}
        className='react-autoql-axes-chart'
        data-test='react-autoql-column-line-chart'
      >
        <Axes
          {...this.props}
          ref={(r) => (this.axesRef = r)}
          chartRef={this.chartRef}
          xScale={this.xScale}
          yScale={this.yScale}
          yScale2={this.yScale2}
          xCol={this.props.columns[this.props.stringColumnIndex]}
          yCol={yCol}
          yCol2={yCol2}
          linearAxis='y'
          hasRightLegend={this.props.legendLocation === 'right'}
          hasBottomLegend={this.props.legendLocation === 'bottom'}
          toggleChartScale={this.toggleChartScale}
          yGridLines
        >
          {this.props.marginAdjustmentFinished && (
            <>
              <Columns {...this.props} xScale={this.xScale} yScale={this.yScale} />
              {!!this.yScale2 && (
                <Line
                  {...this.props}
                  numberColumnIndices={this.props.numberColumnIndices2}
                  xScale={this.xScale}
                  yScale={this.yScale2}
                  colorScale={this.props.colorScale2}
                />
              )}
            </>
          )}
        </Axes>
      </g>
    )
  }
}
