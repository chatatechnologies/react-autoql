import React, { Component } from 'react'
import PropTypes from 'prop-types'
import { Axes } from '../Axes'
import { Columns } from '../Columns'
import { scaleLinear, scaleBand } from 'd3-scale'
import { max, min } from 'd3-array'

export default class ChataBarChart extends Component {
  xScale = scaleBand()
  yScale = scaleLinear()

  static propTypes = {
    data: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
    columns: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
    width: PropTypes.number.isRequired,
    height: PropTypes.number.isRequired,
    leftMargin: PropTypes.number.isRequired,
    rightMargin: PropTypes.number.isRequired,
    topMargin: PropTypes.number.isRequired,
    bottomMargin: PropTypes.number.isRequired,
    dataValue: PropTypes.string,
    labelValue: PropTypes.string,
    tooltipFormatter: PropTypes.func
  }

  static defaultProps = {
    dataValue: 'value',
    labelValue: 'label',
    tooltipFormatter: () => {}
  }

  render = () => {
    const {
      tooltipFormatter,
      onDoubleClick,
      bottomMargin,
      rightMargin,
      leftMargin,
      labelValue,
      topMargin,
      dataValue,
      columns,
      height,
      width,
      data
    } = this.props

    const maxValue = max(data, d => d[dataValue])
    let minValue = min(data, d => d[dataValue])
    // Make sure 0 is always visible on the y axis
    if (minValue > 0) {
      minValue = 0
    }

    const xScale = this.xScale
      .domain(data.map(d => d[labelValue]))
      .range([leftMargin, width - rightMargin])
      .paddingInner(0.1)

    const yScale = this.yScale
      .domain([minValue, maxValue])
      .range([height - bottomMargin, topMargin])

    const barWidth = width / data.length
    const interval = Math.ceil((data.length * 16) / width)
    let xTickValues
    if (barWidth < 16) {
      xTickValues = []
      data.forEach((element, index) => {
        if (index % interval === 0) {
          xTickValues.push(element[labelValue])
        }
      })
    }

    return (
      <g>
        <Axes
          scales={{ xScale, yScale }}
          xCol={columns[0]}
          yCol={columns[1]}
          margins={{
            left: leftMargin,
            right: rightMargin,
            bottom: bottomMargin,
            top: topMargin
          }}
          width={width}
          height={height}
          xTicks={xTickValues}
          rotateLabels={barWidth < 135}
          yGridLines
        />
        <Columns
          scales={{ xScale, yScale }}
          margins={{
            left: leftMargin,
            right: rightMargin,
            bottom: bottomMargin,
            top: topMargin
          }}
          data={data}
          maxValue={maxValue}
          width={width}
          height={height}
          dataValue={dataValue}
          labelValue={labelValue}
          onDoubleClick={onDoubleClick}
          tooltipFormatter={tooltipFormatter}
        />
      </g>
    )
  }
}
