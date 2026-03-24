import React, { PureComponent } from 'react'
import { scaleLinear } from 'd3-scale'
import { max, min } from 'd3-array'
import { getChartColorVars, getTooltipContent, getKey } from 'autoql-fe-utils'

import { chartElementDefaultProps, chartElementPropTypes, createDateDrilldownFilter } from '../chartPropHelpers'

/** Pivot null / empty cells must not become 0 — Number(null) === 0 in JS. */
export const parseBubbleCellValue = (raw) => {
  if (raw === null || raw === undefined || raw === '') {
    return null
  }
  const n = Number(raw)
  return Number.isNaN(n) ? null : n
}

const collectNumericBubbleValues = (data, numberColumnIndices) => {
  const values = []
  if (!data?.length || !numberColumnIndices?.length) {
    return values
  }
  for (const row of data) {
    for (const colIndex of numberColumnIndices) {
      const parsed = parseBubbleCellValue(row[colIndex])
      if (parsed !== null) {
        values.push(parsed)
      }
    }
  }
  return values
}

/** Max bubble diameter (maps to scale range top) — must call d3 .bandwidth() methods. */
const maxBubbleDiameter = (xScale, yScale) => {
  const xBw = typeof xScale.bandwidth === 'function' ? xScale.bandwidth() : xScale.bandwidth
  const yBw = typeof yScale.bandwidth === 'function' ? yScale.bandwidth() : yScale.bandwidth
  return Math.min(Number(xBw) || 0, Number(yBw) || 0)
}

export const buildBubbleRadiusScale = (numericValues, xScale, yScale) => {
  const maxR = maxBubbleDiameter(xScale, yScale)
  if (!numericValues.length || maxR <= 0) {
    return scaleLinear().domain([0, 1]).range([0, 0]).clamp(true)
  }

  const minValue = min(numericValues)
  const maxValue = max(numericValues)
  if (minValue == null || maxValue == null || Number.isNaN(minValue) || Number.isNaN(maxValue)) {
    return scaleLinear().domain([0, 1]).range([0, 0]).clamp(true)
  }

  if (minValue === maxValue) {
    return scaleLinear().domain([minValue, maxValue]).range([maxR / 2, maxR / 2]).clamp(true)
  }

  return scaleLinear().domain([minValue, maxValue]).range([0, maxR]).clamp(true)
}

export default class Circles extends PureComponent {
  static propTypes = chartElementPropTypes
  static defaultProps = chartElementDefaultProps

  state = {
    activeKey: this.props.activeChartElementKey,
  }

  onCircleClick = (row, colIndex, activeKey) => {
    const { columns, stringColumnIndex, dataFormatting } = this.props

    const stringColumn = columns[stringColumnIndex]
    const filter = createDateDrilldownFilter({
      stringColumn,
      dateValue: row[stringColumnIndex],
      dataFormatting,
    })

    this.props.onChartClick({
      row,
      columnIndex: colIndex,
      columns,
      stringColumnIndex,
      legendColumn: this.props.legendColumn,
      activeKey,
      filter,
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
      data,
    } = this.props

    const visibleSeries = numberColumnIndices.filter((colIndex) => {
      return !columns[colIndex].isSeriesHidden
    })

    if (!visibleSeries.length) {
      return null
    }

    const numericValues = collectNumericBubbleValues(data, numberColumnIndices)
    const radiusScale = buildBubbleRadiusScale(numericValues, xScale, yScale)

    const circles = []

    const yBandwidth = yScale.bandwidth() || 0
    const xBandwidth = xScale.bandwidth() || 0

    const { chartColors } = getChartColorVars()
    const color0 = chartColors[0]
    const color1 = chartColors[1]
    const color2 = 'var(--react-autoql-danger-color)'

    data.forEach((row, index) => {
      numberColumnIndices.forEach((colIndex, i) => {
        if (!columns[colIndex].isSeriesHidden) {
          const rawValue = row[colIndex]
          const value = parseBubbleCellValue(rawValue)
          if (value === null) {
            return
          }

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
          const radius = radiusScale(value) / 2

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
                fill: this.state.activeKey === key ? color1 : value < 0 ? color2 : color0,
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
