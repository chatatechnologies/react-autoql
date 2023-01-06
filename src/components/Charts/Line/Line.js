import React, { Component } from 'react'
import { chartElementDefaultProps, chartElementPropTypes, getKey, getTooltipContent } from '../helpers'

export default class Line extends Component {
  static propTypes = chartElementPropTypes
  static defaultProps = chartElementDefaultProps

  state = {
    activeKey: this.props.activeChartElementKey,
  }

  onDotClick = (row, colIndex, rowIndex) => {
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

  makePolyline = () => {
    const { columns, numberColumnIndices, stringColumnIndex, yScale, xScale } = this.props

    const polylines = []
    numberColumnIndices.forEach((colIndex, i) => {
      const vertices = []
      if (!columns[colIndex].isSeriesHidden) {
        this.props.data.forEach((d, index) => {
          const value = d[colIndex]
          const prevRow = this.props.data[index - 1]
          const nextRow = this.props.data[index + 1]

          // If the visual difference between vertices is not noticeable, dont even render
          const isFirstOrLastPoint = index === 0 || index === this.props.data.length - 1
          if (
            !isFirstOrLastPoint &&
            Math.abs(yScale(value) - yScale(prevRow?.[colIndex])) < 0.05 &&
            Math.abs(yScale(prevRow?.[colIndex]) - yScale(nextRow?.[colIndex])) < 0.05
          ) {
            return
          }

          const xShift = xScale.bandwidth() / 2
          const minValue = yScale.domain()[0]

          const x = xScale(d[stringColumnIndex]) + xShift
          const y = yScale(value || minValue)
          const xy = [x, y]
          vertices.push(xy)
        })
      }

      const polylinePoints = vertices
        .map((xy) => {
          return xy.join(',')
        })
        .join(' ')

      const polyline = (
        <polyline
          key={`line-${getKey(0, i)}`}
          className='line'
          points={polylinePoints}
          fill='none'
          stroke={this.props.colorScale(i)}
          strokeWidth={1.5}
          opacity={0.7}
        />
      )

      polylines.push(polyline)
    })

    return polylines
  }

  makeDots = () => {
    const { columns, legendColumn, numberColumnIndices, stringColumnIndex, dataFormatting, yScale, xScale } = this.props

    const allDots = []
    numberColumnIndices.forEach((colIndex, i) => {
      if (!columns[colIndex].isSeriesHidden) {
        this.props.data.forEach((d, index) => {
          const value = d[colIndex]
          if (!value) {
            return
          }

          const cy = yScale(value)
          if (cy < 0.05) {
            return
          }

          const xShift = xScale.bandwidth() / 2

          const tooltip = getTooltipContent({
            row: d,
            columns,
            colIndex,
            stringColumnIndex,
            legendColumn,
            dataFormatting,
          })

          const circle = (
            <circle
              className='line-dot-inner-circle'
              key={getKey(colIndex, index)}
              cy={cy}
              cx={xScale(d[stringColumnIndex]) + xShift}
              r={3}
              style={{
                pointerEvents: 'none',
                stroke: this.props.colorScale(i),
                strokeWidth: 2,
                strokeOpacity: 0.7,
                fillOpacity: 1,
                opacity: 0,
                fill:
                  this.state.activeKey === getKey(colIndex, index)
                    ? this.props.colorScale(i)
                    : this.props.backgroundColor || '#fff',
              }}
            />
          )

          // Render a bigger transparent circle so it's easier for the user
          // to hover over and see tooltip
          const transparentHoverCircle = (
            <circle
              key={`hover-circle-${getKey(colIndex, index)}`}
              cy={cy}
              cx={xScale(d[stringColumnIndex]) + xShift}
              r={10}
              style={{
                stroke: 'transparent',
                fill: 'transparent',
                cursor: 'pointer',
              }}
            />
          )

          allDots.push(
            <g
              className={`line-dot${this.state.activeKey === getKey(colIndex, index) ? ' active' : ''}`}
              key={`circle-group-${getKey(colIndex, index)}`}
              onClick={() => this.onDotClick(d, colIndex, index)}
              data-tip={tooltip}
              data-for={this.props.chartTooltipID}
            >
              {circle}
              {transparentHoverCircle}
            </g>,
          )
        })
      }
    })

    return allDots
  }

  render = () => {
    const visibleSeries = this.props.numberColumnIndices.filter((colIndex) => {
      return !this.props.columns[colIndex].isSeriesHidden
    })

    const numVisibleSeries = visibleSeries.length
    if (!numVisibleSeries) {
      return null
    }

    return (
      <g data-test='line'>
        {this.makePolyline()}
        {this.makeDots()}
      </g>
    )
  }
}
