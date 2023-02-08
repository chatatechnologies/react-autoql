import React, { Component } from 'react'
import { getThemeValue } from '../../../theme/configureTheme'
import { createSVGPath } from './lineFns'
import { chartElementDefaultProps, chartElementPropTypes, getKey, getTooltipContent } from '../helpers'

export default class Line extends Component {
  constructor(props) {
    super(props)

    this.PATH_SMOOTHING = 0.2

    this.state = {
      activeKey: this.props.activeChartElementKey,
    }
  }

  static propTypes = chartElementPropTypes
  static defaultProps = chartElementDefaultProps

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

  makePaths = () => {
    const { columns, numberColumnIndices, stringColumnIndex, yScale, xScale } = this.props
    const backgroundColor = getThemeValue('background-color-secondary')

    const paths = []
    const outerPaths = []
    numberColumnIndices.forEach((colIndex, i) => {
      const vertices = []
      if (!columns[colIndex].isSeriesHidden) {
        this.props.data.forEach((d, index) => {
          const value = d[colIndex]
          const prevRow = this.props.data[index - 1]
          const nextRow = this.props.data[index + 1]

          // If the visual difference between vertices is not noticeable, dont even render
          // const isFirstOrLastPoint = index === 0 || index === this.props.data.length - 1
          // if (
          //   !isFirstOrLastPoint &&
          //   Math.abs(yScale(value) - yScale(prevRow?.[colIndex])) < 0.05 &&
          //   Math.abs(yScale(prevRow?.[colIndex]) - yScale(nextRow?.[colIndex])) < 0.05
          // ) {
          //   return
          // }

          const xShift = xScale.bandwidth() / 2
          const minValue = yScale.domain()[0]

          const x = xScale(d[stringColumnIndex]) + xShift
          const y = yScale(value || minValue)
          const xy = [x, y]
          vertices.push(xy)
        })
      }

      const d = createSVGPath(vertices, this.PATH_SMOOTHING)

      const path = (
        <path
          key={`line-${getKey(0, i)}`}
          className='line'
          d={d}
          fill='none'
          stroke={this.props.colorScale(i)}
          strokeWidth={1.5}
        />
      )

      const outerPath = (
        <path
          key={`line-outer-${getKey(0, i)}`}
          className='line-outer'
          d={d}
          fill='none'
          stroke={backgroundColor}
          strokeOpacity={0.3}
          strokeWidth={3}
        />
      )

      outerPaths.push(outerPath)
      paths.push(path)
    })

    return { paths, outerPaths }
  }

  makeCircles = () => {
    const { columns, legendColumn, numberColumnIndices, stringColumnIndex, dataFormatting, yScale, xScale } = this.props
    const backgroundColor = getThemeValue('background-color-secondary')

    const largeDataset = this.props.width / this.props.data?.length < 10

    const innerCircles = []
    const outerCircles = []
    numberColumnIndices.forEach((colIndex, i) => {
      if (!columns[colIndex].isSeriesHidden) {
        this.props.data.forEach((d, index) => {
          const value = d[colIndex]
          if (!value) {
            return
          }

          const cy = yScale(value)
          if (!cy || cy < 0.05) {
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

          // Render a bigger transparent circle so it's easier for the user
          // to hover over and see tooltip
          const transparentHoverVertex = (
            <circle
              key={`hover-circle-${getKey(colIndex, index)}`}
              cy={cy}
              cx={xScale(d[stringColumnIndex]) + xShift}
              r={6}
              style={{
                stroke: 'transparent',
                fill: 'transparent',
                cursor: 'pointer',
              }}
            />
          )
          const circle = (
            <circle
              className='line-dot-inner-circle'
              key={getKey(colIndex, index)}
              cy={cy}
              cx={xScale(d[stringColumnIndex]) + xShift}
              r={2.5}
              style={{
                pointerEvents: 'none',
                stroke: this.props.colorScale(i),
                strokeWidth: 3.5,
                color: this.props.colorScale(i),
                opacity: largeDataset ? 0 : 1,
                fill:
                  this.state.activeKey === getKey(colIndex, index)
                    ? this.props.colorScale(i)
                    : backgroundColor || '#fff',
              }}
            />
          )

          const circleOuter = (
            <circle
              className='line-dot-outer-circle'
              key={getKey(colIndex, index)}
              cy={cy}
              cx={xScale(d[stringColumnIndex]) + xShift}
              r={5}
              style={{
                stroke: 'none',
                fill: backgroundColor,
                fillOpacity: 0.3,
                opacity: largeDataset ? 0 : 1,
              }}
            />
          )

          innerCircles.push(
            <g
              className={`line-dot${this.state.activeKey === getKey(colIndex, index) ? ' active' : ''}${
                largeDataset ? ' hidden-dot' : ''
              }`}
              key={`circle-group-${getKey(colIndex, index)}`}
              onClick={() => this.onDotClick(d, colIndex, index)}
              data-tip={tooltip}
              data-for={this.props.chartTooltipID}
            >
              {circle}
              {transparentHoverVertex}
            </g>,
          )

          outerCircles.push(
            <g
              className={`line-dot-outer${this.state.activeKey === getKey(colIndex, index) ? ' active' : ''}`}
              key={`circle-group-outer-${getKey(colIndex, index)}`}
            >
              {circleOuter}
            </g>,
          )
        })
      }
    })

    return { innerCircles, outerCircles }
  }

  render = () => {
    const visibleSeries = this.props.numberColumnIndices.filter((colIndex) => {
      return !this.props.columns[colIndex].isSeriesHidden
    })

    const numVisibleSeries = visibleSeries.length
    if (!numVisibleSeries) {
      return null
    }

    const { outerPaths, paths } = this.makePaths()
    const { innerCircles, outerCircles } = this.makeCircles()

    return (
      <g data-test='line'>
        {outerPaths}
        {outerCircles}
        {paths}
        {innerCircles}
      </g>
    )
  }
}
