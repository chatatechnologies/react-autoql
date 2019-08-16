import React, { Component } from 'react'
import PropTypes from 'prop-types'
import { Axes } from '../Axes'
import { Bars } from '../Bars'
import { scaleLinear, scaleBand } from 'd3-scale'
import { max, min } from 'd3-array'

export default class ChataBarChart extends Component {
  xScale = scaleLinear()
  yScale = scaleBand()

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
      onChartClick,
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
      .domain([minValue, maxValue])
      .range([leftMargin, width - rightMargin])

    const yScale = this.yScale
      .domain(data.map(d => d[labelValue]))
      .range([height - bottomMargin, topMargin])
      .paddingInner(0.1)

    const tickWidth = (width - leftMargin - rightMargin) / 6

    const barHeight = height / data.length
    const interval = Math.ceil((data.length * 16) / height)
    let yTickValues
    if (barHeight < 16) {
      yTickValues = []
      data.forEach((element, index) => {
        if (index % interval === 0) {
          yTickValues.push(element[labelValue])
        }
      })
    }

    return (
      <g>
        <Axes
          scales={{ xScale, yScale }}
          xCol={columns[1]}
          yCol={columns[0]}
          margins={{
            left: leftMargin,
            right: rightMargin,
            bottom: bottomMargin,
            top: topMargin
          }}
          width={width}
          height={height}
          yTicks={yTickValues}
          rotateLabels={tickWidth < 135}
          xGridLines
        />
        {
          <Bars
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
            onChartClick={onChartClick}
            tooltipFormatter={tooltipFormatter}
          />
        }
      </g>
    )
  }
}
