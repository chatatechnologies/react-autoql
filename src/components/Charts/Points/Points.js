import React from 'react'
import { max, min } from 'd3-array'
import { scaleLinear } from 'd3-scale'
import { deepEqual, getChartColorVars, getKey, getTooltipContent } from 'autoql-fe-utils'

import { chartElementDefaultProps, chartElementPropTypes } from '../chartPropHelpers'

export default class Points extends React.Component {
  constructor(props) {
    super(props)

    const maxValue = max(props.data.map((row) => max(row.filter((value, i) => props.numberColumnIndices.includes(i)))))
    const minValue = min(props.data.map((row) => min(row.filter((value, i) => props.numberColumnIndices.includes(i)))))

    this.opacityScale = scaleLinear().domain([minValue, maxValue]).range([0, 1])

    this.state = {
      activeKey: this.props.activeChartElementKey,
    }
  }

  static propTypes = chartElementPropTypes
  static defaultProps = chartElementDefaultProps

  shouldComponentUpdate = (nextProps, nextState) => {
    const propsEqual = deepEqual(this.props, nextProps)
    const stateEqual = deepEqual(this.state, nextState)

    return !propsEqual || !stateEqual
  }

  onPointClick = (row, colIndex, key) => {
    // Drilldowns not possible yet since it is only 1 data point
    // There may be a use case for this in the future if we can
    // get additional data for a single row
    // this.props.onChartClick({
    //   row,
    //   columnIndex: colIndex,
    //   columns: this.props.columns,
    //   stringColumnIndex: this.props.numberColumnIndex2,
    //   activeKey: key,
    // })

    this.setState({ activeKey: key })
  }

  render = () => {
    if (this.props.isLoading) {
      return null
    }

    const { columns, numberColumnIndex, numberColumnIndex2, dataFormatting, yScale, xScale } = this.props

    if (isNaN(numberColumnIndex) || isNaN(numberColumnIndex2)) {
      return null
    }

    const { chartColors } = getChartColorVars()
    const color0 = chartColors[0]
    const color1 = chartColors[1]

    const points = []
    this.props.data.forEach((row, index) => {
      const rawValueX = row[numberColumnIndex]
      const valueNumberX = Number(rawValueX)
      const valueX = !isNaN(valueNumberX) ? valueNumberX : 0

      const rawValueY = row[numberColumnIndex2]
      const valueNumberY = Number(rawValueY)
      const valueY = !isNaN(valueNumberY) ? valueNumberY : 0

      const tooltip = getTooltipContent({
        row,
        columns,
        colIndex: numberColumnIndex,
        colIndex2: numberColumnIndex2,
        dataFormatting,
        aggregated: this.props.isAggregated,
      })

      const key = getKey(numberColumnIndex, index)
      const isActive = this.state.activeKey === key

      points.push(
        <circle
          key={key}
          data-test='points'
          className={`point${isActive ? ' active' : ''}`}
          cx={xScale(valueX)}
          cy={yScale(valueY)}
          r={isActive ? 6 : 3}
          onClick={() => this.onPointClick(row, numberColumnIndex, key)}
          data-tooltip-html={tooltip}
          data-tooltip-id={this.props.chartTooltipID}
          style={{
            color: color1,
            stroke: 'transparent',
            fill: color0,
          }}
        />,
      )
    })

    return <g>{points}</g>
  }
}
