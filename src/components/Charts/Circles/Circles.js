import React, { Component } from 'react'
import { scaleLinear } from 'd3-scale'
import { max, min } from 'd3-array'

import { chartElementDefaultProps, chartElementPropTypes, getTooltipContent, getKey } from '../helpers'
import { getChartColorVars } from '../../../theme/configureTheme'
import { rebuildTooltips } from '../../Tooltip'

export default class Circles extends Component {
  constructor(props) {
    super(props)

    const maxValue = max(
      props.data.map((row) => max(row.filter((value, i) => props.numberColumnIndices.includes(i) && !isNaN(value)))),
    )

    const minValue = min(
      props.data.map((row) => min(row.filter((value, i) => props.numberColumnIndices.includes(i) && !isNaN(value)))),
    )

    this.radiusScale = scaleLinear()
      .domain([minValue, maxValue])
      .range([0, Math.min(props.xScale.bandwidth(), props.yScale.bandwidth())])
  }
  static propTypes = chartElementPropTypes
  static defaultProps = chartElementDefaultProps

  state = {
    activeKey: this.props.activeChartElementKey,
  }

  componentDidMount = () => {
    rebuildTooltips()
  }

  onCircleClick = (row, colIndex, rowIndex) => {
    const newActiveKey = getKey(colIndex, rowIndex)

    this.props.onChartClick({
      row,
      columnIndex: colIndex,
      columns: this.props.columns,
      stringColumnIndex: this.props.stringColumnIndex,
      legendColumn: this.props.legendColumn,
      activeKey: newActiveKey,
    })

    this.setState({ activeKey: newActiveKey })
  }

  render = () => {
    if (this.props.isLoading) {
      return null
    }

    const {
      columns,
      legendColumn,
      numberColumnIndices,
      stringColumnIndex,
      dataFormatting,
      legendLabels,
      yScale,
      xScale,
    } = this.props

    const visibleSeries = numberColumnIndices.filter((colIndex) => {
      return !columns[colIndex].isSeriesHidden
    })

    if (!visibleSeries.length) {
      return null
    }

    const circles = []

    const yBandwidth = yScale.bandwidth() || 0
    const xBandwidth = xScale.bandwidth() || 0

    const { chartColors } = getChartColorVars()
    const color0 = chartColors[0]
    const color1 = chartColors[1]

    this.props.data.forEach((row, index) => {
      numberColumnIndices.forEach((colIndex, i) => {
        if (!columns[colIndex].isSeriesHidden) {
          const rawValue = row[colIndex]
          const valueNumber = Number(rawValue)
          const value = !isNaN(valueNumber) ? valueNumber : 0

          const xLabel = row[stringColumnIndex]
          const yLabel = legendLabels[i].label

          const tooltip = getTooltipContent({
            row,
            columns,
            colIndex,
            colIndex2: stringColumnIndex,
            legendColumn,
            dataFormatting,
          })

          const scaleX = xScale(xLabel)
          const scaleY = yScale(yLabel)

          circles.push(
            <circle
              key={getKey(colIndex, index)}
              data-test='circles'
              className={`circle${this.state.activeKey === getKey(colIndex, index) ? ' active' : ''}`}
              cx={scaleX + xBandwidth / 2}
              cy={scaleY + yBandwidth / 2}
              r={value < 0 ? 0 : this.radiusScale(value) / 2}
              onClick={() => this.onCircleClick(row, colIndex, index)}
              data-tip={tooltip}
              data-for={this.props.chartTooltipID}
              style={{
                stroke: 'transparent',
                strokeWidth: 10,
                fill: this.state.activeKey === getKey(colIndex, index) ? color1 : color0,
                fillOpacity: 0.7,
              }}
            />,
          )
        }
      })
    })
    return <g>{circles}</g>
  }
}
