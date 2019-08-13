import React, { Component } from 'react'
import PropTypes from 'prop-types'
import { Axes } from '../Axes'
import { onlyUnique } from '../../js/Util.js'
import { Circles } from '../Circles'
import { scaleBand } from 'd3-scale'
import { max } from 'd3-array'

export default class ChataBubbleChart extends Component {
  xScale = scaleBand()
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
    labelValueX: PropTypes.string,
    labelValueY: PropTypes.string,
    tooltipFormatter: PropTypes.func
  }

  static defaultProps = {
    dataValue: 'value',
    labelValueX: 'labelX',
    labelValueY: 'labelY',
    tooltipFormatter: () => {}
  }

  render = () => {
    const {
      tooltipFormatter,
      onDoubleClick,
      bottomMargin,
      rightMargin,
      labelValueY,
      labelValueX,
      leftMargin,
      topMargin,
      dataValue,
      columns,
      height,
      width,
      data
    } = this.props

    const maxValue = max(data, d => d[dataValue])

    const uniqueXLabels = data
      .map(d => d[labelValueX])
      .filter(onlyUnique)
      .sort()
      .reverse() // sorts dates correctly

    const xScale = this.xScale
      .domain(uniqueXLabels)
      .rangeRound([width - rightMargin, leftMargin])
      .paddingInner(0)

    const uniqueYLabels = data.map(d => d[labelValueY]).filter(onlyUnique)
    const yScale = this.yScale
      .domain(uniqueYLabels)
      .rangeRound([height - bottomMargin, topMargin])
      .paddingInner(0)

    const squareHeight = height / uniqueYLabels.length
    const squareWidth = width / uniqueXLabels.length

    const intervalHeight = Math.ceil((uniqueYLabels.length * 16) / height)
    const intervalWidth = Math.ceil((uniqueXLabels.length * 16) / width)

    let xTickValues
    if (squareWidth < 16) {
      xTickValues = []
      uniqueXLabels.forEach((element, index) => {
        if (index % intervalWidth === 0) {
          xTickValues.push(element)
        }
      })
    }
    let yTickValues
    if (squareHeight < 16) {
      yTickValues = []
      uniqueYLabels.forEach((element, index) => {
        if (index % intervalHeight === 0) {
          yTickValues.push(element)
        }
      })
    }

    return (
      <g>
        <Axes
          scales={{ xScale, yScale }}
          xCol={columns[1]}
          yCol={columns[0]}
          valueCol={columns[2]}
          margins={{
            left: leftMargin,
            right: rightMargin,
            bottom: bottomMargin,
            top: topMargin
          }}
          width={width}
          height={height}
          yTicks={yTickValues}
          xTicks={xTickValues}
          rotateLabels={squareWidth < 135}
        />
        {
          <Circles
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
            labelValueX={labelValueX}
            labelValueY={labelValueY}
            onDoubleClick={onDoubleClick}
            tooltipFormatter={tooltipFormatter}
          />
        }
      </g>
    )
  }
}
