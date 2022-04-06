import React, { Component } from 'react'
import PropTypes from 'prop-types'
import _get from 'lodash.get'
import { scaleLinear } from 'd3-scale'
import { themeConfigDefault, getThemeConfig } from '../../../props/defaults'
import { themeConfigType } from '../../../props/types'

export default class Circles extends Component {
  static propTypes = {
    themeConfig: themeConfigType,

    columns: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
    maxValue: PropTypes.number,
    minValue: PropTypes.number,
  }

  static defaultProps = {
    themeConfig: themeConfigDefault,
    maxValue: 0,
    minValue: 0,
  }

  state = {
    activeKey: this.props.activeKey,
  }

  render = () => {
    const { scales, data } = this.props
    const { xScale, yScale } = scales

    const radiusScale = scaleLinear()
      .domain([this.props.minValue, this.props.maxValue])
      .range([0, Math.min(xScale.bandwidth(), yScale.bandwidth())])

    const circles = []
    data.forEach((d) => {
      d.cells.forEach((cell) => {
        circles.push(
          <circle
            key={`${cell.label}-${d.label}`}
            data-test="circles"
            className={`circle${
              this.state.activeKey === `${cell.label}-${d.label}`
                ? ' active'
                : ''
            }`}
            cx={xScale(d.label) + xScale.bandwidth() / 2}
            cy={yScale(cell.label) + yScale.bandwidth() / 2}
            r={cell.value < 0 ? 0 : radiusScale(cell.value) / 2}
            onClick={() => {
              this.setState({
                activeKey: `${cell.label}-${d.label}`,
              })
              this.props.onChartClick({
                activeKey: `${cell.label}-${d.label}`,
                drilldownData: cell.drilldownData,
              })
            }}
            data-tip={cell.tooltipData}
            data-for="chart-element-tooltip"
            style={{
              stroke: 'transparent',
              strokeWidth: 10,
              fill:
                this.state.activeKey === `${cell.label}-${d.label}`
                  ? _get(
                      getThemeConfig(this.props.themeConfig),
                      'chartColors[1]'
                    )
                  : _get(
                      getThemeConfig(this.props.themeConfig),
                      'chartColors[0]'
                    ),
              fillOpacity: 0.7,
            }}
          />
        )
      })
    })
    return <g>{circles}</g>
  }
}
