import React from 'react'
import { Axis } from '../Axis'

export default ({
  scales,
  margins,
  height,
  width,
  ticks,
  tickValues,
  rotateLabels,
  xCol,
  yCol
}) => {
  const xProps = {
    orient: 'Bottom',
    scale: scales.xScale,
    translate: `translate(0, ${height - margins.bottom})`,
    rotateLabels: rotateLabels,
    tickSizeInner: 0,
    ticks,
    tickValues,
    height,
    width,
    margins,
    col: xCol
  }

  const yProps = {
    orient: 'Left',
    scale: scales.yScale,
    translate: `translate(${margins.left}, 0)`,
    tickSizeInner: -width + margins.left + margins.right,
    ticks,
    tickValues,
    height,
    width,
    margins,
    col: yCol
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
      >
        {yProps.col.title}
      </text>
      <Axis {...xProps} />
      <Axis {...yProps} />
      <text
        className="x-axis-label"
        textAnchor="middle"
        fontWeight="bold"
        y={xProps.height - 10}
        x={(xProps.width - xProps.margins.left) / 2 + xProps.margins.left}
      >
        {xProps.col.title}
      </text>
    </g>
  )
}
