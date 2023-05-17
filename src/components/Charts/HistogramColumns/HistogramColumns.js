import React, { Component } from 'react'
import { formatElement } from '../../../js/Util'
import { getChartColorVars } from '../../../theme/configureTheme'
import { rebuildTooltips } from '../../Tooltip'
import { chartElementDefaultProps, chartElementPropTypes, getTooltipContent, scaleZero, getKey } from '../helpers'

export default class HistogramColumns extends Component {
  static propTypes = chartElementPropTypes
  static defaultProps = chartElementDefaultProps

  state = {
    activeKey: this.props.activeChartElementKey,
  }

  componentDidMount = () => {
    rebuildTooltips()
  }

  onColumnClick = (x0, x1, rowIndex) => {
    const newActiveKey = getKey(rowIndex)

    // TODO: create drilldown fn for bucket range
    // this.props.onChartClick({
    //   row,
    //   columnIndex: this.props.numberColumnIndex,
    //   columns: this.props.columns,
    //   legendColumn: this.props.legendColumn,
    //   activeKey: newActiveKey,
    // })

    this.setState({ activeKey: newActiveKey })
  }

  getBars = () => {
    const { xScale, yScale, columns, numberColumnIndex, dataFormatting } = this.props
    if (!xScale || !yScale) {
      return null
    }

    const color = getChartColorVars()?.chartColors?.[0]

    return this.props.xScale.buckets.map((d, index) => {
      if (!d) {
        return null
      }

      const x = xScale.getValue(d.x0) + 1
      const y = yScale(d.length)
      const width = Math.max(0, xScale.getValue(d.x1) - xScale.getValue(d.x0) - 1)
      const height = yScale(0) - yScale(d.length)

      if (index === 0) {
        console.log('width of first column', width)
      }
      if (index === 1) {
        console.log('width of second column', width)
      }

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

      return (
        <rect
          key={key}
          className={`bar${this.state.activeKey === key ? ' active' : ''}`}
          data-test={`bar-${index}`}
          x={x}
          y={y}
          height={height}
          width={width}
          onClick={() => this.onColumnClick(d.x0, d.x1, index)}
          data-tip={tooltip}
          data-for={this.props.chartTooltipID}
          style={{ fill: color, fillOpacity: 0.7 }}
        />
      )
    })
  }

  render = () => {
    const bars = this.getBars()

    return <g data-test='columns'>{bars}</g>
  }
}
