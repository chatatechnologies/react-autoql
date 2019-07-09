import React, { Component } from 'react'
import PropTypes from 'prop-types'
import ReactTooltip from 'react-tooltip'
import { Axes } from '../Axes'
import { Bars } from '../Bars'
import { scaleLinear, scaleBand } from 'd3-scale'
import { max, min } from 'd3-array'

import styles from './ChatabarChartNew.css'

export default class ChataBarChart extends Component {
  xScale = scaleBand()
  yScale = scaleLinear()

  static propTypes = {
    data: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
    columns: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
    type: PropTypes.string, // bar or column
    margin: PropTypes.shape({}),
    dataValue: PropTypes.string,
    labelValue: PropTypes.string,
    tooltipFormatter: PropTypes.func,
    size: PropTypes.arrayOf(PropTypes.number),
    width: PropTypes.number,
    height: PropTypes.number
  }

  static defaultProps = {
    type: 'column',
    margins: { left: 50, right: 10, top: 10, bottom: 100 },
    dataValue: 'value',
    labelValue: 'label',
    tooltipFormatter: undefined
  }

  state = {
    // margins: this.props.margin,
    // activeBar: null
  }

  componentDidMount = () => {
    // const self = this
    // find max label size and use that as left and bottom margins
    // this.maxLabelLength = this.props.data.sort((a, b) => {
    //   return b[self.props.labelValue].length - a[self.props.labelValue].length
    // })[0][self.props.labelValue]
    // this.maxDataLength = this.props.data.sort((a, b) => {
    //   return (
    //     String.toString(b[self.props.dataValue]).length -
    //     String.toString(a[self.props.dataValue]).length
    //   )
    // })[0][self.props.dataValue]
  }

  render = () => {
    const self = this
    const { data, margins, width, height } = this.props
    const maxValue = max(data, d => d[self.props.dataValue])
    let minValue = min(data, d => d[self.props.dataValue])
    // Make sure 0 is always visible on the y axis
    if (minValue > 0) {
      minValue = 0
    }

    const xScale = this.xScale
      .domain(data.map(d => d[this.props.labelValue]))
      .rangeRound([margins.left, width - margins.right])
      .paddingInner(0.1)

    const yScale = this.yScale
      .domain([minValue, maxValue])
      .range([height - margins.bottom, margins.top])
    // .nice()

    const barWidth = width / data.length
    const interval = Math.ceil((data.length * 14) / width)
    let xTickValues
    if (barWidth < 14) {
      xTickValues = []
      data.forEach((element, index) => {
        if (index % interval === 0) {
          xTickValues.push(element[self.props.labelValue])
        }
      })
    }

    return (
      <div className="chata-bar-chart-container">
        <svg width={width} height={height}>
          <style>{`${styles}`}</style>
          <Axes
            // data={this.props.data}
            scales={{ xScale, yScale }}
            margins={this.props.margins}
            width={this.props.width}
            height={this.props.height}
            ticks={xTickValues}
            rotateLabels={barWidth < 100}
            columns={this.props.columns}
          />
          <Bars
            scales={{ xScale, yScale }}
            margins={this.props.margins}
            data={data}
            maxValue={maxValue}
            width={this.props.width}
            height={this.props.height}
            dataValue={this.props.dataValue}
            labelValue={this.props.labelValue}
            onDoubleClick={this.props.onDoubleClick}
            tooltipFormatter={this.props.tooltipFormatter}
          />
        </svg>
        <ReactTooltip
          className="chata-drawer-tooltip"
          id="chart-element-tooltip"
          effect="solid"
          html
        />
      </div>
    )
  }
}
