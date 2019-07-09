import React from 'react'
import { Axis } from '../Axis'

export default ({
  scales,
  margins,
  height,
  width,
  ticks,
  rotateLabels,
  columns
}) => {
  const xProps = {
    orient: 'Bottom',
    scale: scales.xScale,
    translate: `translate(0, ${height - margins.bottom})`,
    rotateLabels: rotateLabels,
    tickSizeInner: 0,
    ticks,
    col: columns ? columns[0] : {}
  }

  const yProps = {
    orient: 'Left',
    scale: scales.yScale,
    translate: `translate(${margins.left}, 0)`,
    tickSizeInner: -width + margins.left + margins.right,
    ticks,
    col: columns ? columns[1] : {}
  }

  return (
    <g>
      <Axis {...xProps} />
      <Axis {...yProps} />
    </g>
  )
}
