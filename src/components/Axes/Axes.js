import React from 'react'
import { Axis } from '../Axis'

export default class Axes extends React.Component {
  static propTypes = {}

  static defaultProps = {}

  render = () => {
    const {
      scales,
      margins,
      height,
      width,
      xTicks,
      yTicks,
      rotateLabels,
      xCol,
      yCol,
      xGridLines,
      yGridLines,
      legendLabels,
      legendColumn,
      currencyCode,
      languageCode,
      hasLegend
    } = this.props

    const xProps = {
      orient: 'Bottom',
      scale: scales.xScale,
      translate: `translate(0, ${height - margins.bottom})`,
      rotateLabels: rotateLabels,
      tickSizeInner: -height + margins.top + margins.bottom,
      ticks: xTicks,
      height,
      width: width - margins.right,
      margins,
      col: xCol,
      showGridLines: xGridLines,
      hasLegend,
      legendLabels,
      legendColumn,
      currencyCode,
      languageCode
    }

    const yProps = {
      orient: 'Left',
      scale: scales.yScale,
      translate: `translate(${margins.left}, 0)`,
      tickSizeInner: -width + margins.left + margins.right,
      ticks: yTicks,
      height,
      width: width - margins.right,
      margins,
      col: yCol,
      showGridLines: yGridLines,
      currencyCode,
      languageCode
    }

    return (
      <g>
        <text
          className="y-axis-label"
          textAnchor="middle"
          transform="rotate(-90)"
          fontWeight="bold"
          y={10}
          x={-((yProps.height - yProps.margins.bottom) / 2)}
          style={{ fontSize: 12, fill: 'currentColor', fillOpacity: 0.7 }}
        >
          {yProps.col.title}
        </text>
        <Axis {...xProps} />
        <Axis {...yProps} />
        <text
          className="x-axis-label"
          textAnchor="middle"
          fontWeight="bold"
          y={xProps.height}
          x={(xProps.width - xProps.margins.left) / 2 + xProps.margins.left}
          style={{ fontSize: 12, fill: 'currentColor', fillOpacity: 0.7 }}
        >
          {xProps.col.title}
        </text>
      </g>
    )
  }
}
