import React, { PureComponent } from 'react'
import { scaleLinear } from 'd3-scale'
import { max, min } from 'd3-array'
import { getChartColorVars, getTooltipContent, getKey } from 'autoql-fe-utils'

import { chartElementDefaultProps, chartElementPropTypes } from '../chartPropHelpers'

export default class Circles extends PureComponent {
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

  onCircleClick = (row, colIndex, activeKey) => {
    this.props.onChartClick({
      row,
      columnIndex: colIndex,
      columns: this.props.columns,
      stringColumnIndex: this.props.stringColumnIndex,
      legendColumn: this.props.legendColumn,
      activeKey,
    })

    this.setState({ activeKey })
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
    const color2 = 'var(--react-autoql-danger-color)'

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
            aggregated: this.props.isAggregated,
          })

          const key = getKey(colIndex, index)

          const scaleX = xScale.getValue(xLabel)
          const scaleY = yScale.getValue(yLabel)
          const radius = this.radiusScale(value) / 2

          circles.push(
            <circle
              id={key}
              key={key}
              data-test='circles'
              className={`circle${this.state.activeKey === key ? ' active' : ''}`}
              cx={scaleX + xBandwidth / 2}
              cy={scaleY + yBandwidth / 2}
              r={Math.abs(radius)}
              onClick={() => this.onCircleClick(row, colIndex, key)}
              data-tooltip-html={tooltip}
              data-tooltip-id={this.props.chartTooltipID}
              style={{
                stroke: 'transparent',
                strokeWidth: 10,
                fill: this.state.activeKey === key ? color1 : radius > 0 ? color0 : color2,
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
