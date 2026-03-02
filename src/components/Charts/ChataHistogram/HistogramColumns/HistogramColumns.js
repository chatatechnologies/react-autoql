import React, { Component } from 'react'
import { formatElement, getChartColorVars, getKey } from 'autoql-fe-utils'

import { chartElementDefaultProps, chartElementPropTypes } from '../../chartPropHelpers'

export default class HistogramColumns extends Component {
  static propTypes = chartElementPropTypes
  static defaultProps = chartElementDefaultProps

  state = {
    activeKey: this.props.activeChartElementKey,
  }

  onColumnClick = (x0, x1, rowIndex) => {
    const newActiveKey = getKey(rowIndex)

    // TODO: enable this once the BE can support number range filters
    this.props.onChartClick({
      activeKey: newActiveKey,
      filter: {
        name: this.props.columns[this.props.numberColumnIndex]?.name,
        value: `${x0},${x1}`,
        operator: 'between',
        column_type: this.props.columns[this.props.numberColumnIndex]?.type,
      },
    })

    this.setState({ activeKey: newActiveKey })
  }

  getBars = () => {
    const { xScale, yScale, buckets } = this.props
    if (!xScale || !yScale || !buckets?.length) {
      return null
    }

    const color = getChartColorVars()?.chartColors?.[0]
    const gradientId = `histogram-gradient-${this.props.chartTooltipID || 'default'}`
    const gradientDefs = []

    // Create vertical gradient for histogram bars (top to bottom) - matching column charts
    gradientDefs.push(
      <linearGradient key={gradientId} id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor={color} stopOpacity="0.9" />
        <stop offset="50%" stopColor={color} stopOpacity="0.7" />
        <stop offset="100%" stopColor={color} stopOpacity="0.5" />
      </linearGradient>
    )

    const bars = this.props.buckets.map((d, index) => {
      if (!d) {
        return null
      }

      const x = xScale.getValue(d.x0) + 1
      const y = yScale(d.length)
      const width = Math.max(0, xScale.getValue(d.x1) - xScale.getValue(d.x0) - 1)
      const height = yScale(0) - yScale(d.length)

      const x0Formatted = formatElement({
        element: d.x0,
        column: xScale.column,
        config: xScale.dataFormatting,
      })

      const x1Formatted = formatElement({
        element: d.x1,
        column: xScale.column,
        config: xScale.dataFormatting,
      })

      const tooltip = `<div><strong>${xScale.title} (Range):</strong> ${x0Formatted} - ${x1Formatted}</div>
      <div><strong>Count:</strong> ${d.length}</div>`

      const key = getKey(index)
      // Round corners - use smaller of width/height for radius, but cap at 4px
      const cornerRadius = Math.min(Math.min(width, height) / 2, 4)

      return (
        <rect
          key={key}
          className={`bar${this.state.activeKey === key ? ' active' : ''}`}
          data-test={`bar-${index}`}
          x={x}
          y={y}
          height={height}
          width={width}
          rx={cornerRadius}
          ry={cornerRadius}
          onClick={() => this.onColumnClick(d.x0, d.x1, index)}
          data-tooltip-html={tooltip}
          data-tooltip-id={this.props.chartTooltipID}
          fill={`url(#${gradientId})`}
        />
      )
    })

    return { bars, defs: gradientDefs }
  }

  render = () => {
    if (this.props.isLoading) {
      return null
    }

    const { bars, defs } = this.getBars() || { bars: [], defs: [] }

    return (
      <g data-test='columns'>
        <defs>{defs}</defs>
        {bars}
      </g>
    )
  }
}
