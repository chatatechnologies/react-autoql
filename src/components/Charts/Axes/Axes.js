import React from 'react'
import { Axis } from '../Axis'
import { select } from 'd3-selection'
import _get from 'lodash.get'

export default class Axes extends React.Component {
  static propTypes = {}

  static defaultProps = {}

  renderAxisLabel = (title = '', hasDropdown) => {
    if (title.length > 35) {
      return (
        <tspan data-tip={title} data-for="chart-element-tooltip">
          {`${title.substring(0, 35)}...`}
        </tspan>
      )
    }

    return (
      <tspan>
        {title} {hasDropdown && <tspan fontSize="8px">&#9660;</tspan>}
      </tspan>
    )
  }

  getBBoxFromRef = ref => {
    try {
      const bBox = select(ref)
        .node()
        .getBBox()
      return bBox
    } catch (error) {
      return {}
    }
  }

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
      dataFormatting,
      hasRightLegend,
      hasBottomLegend,
      chartColors,
      onLegendClick,
      onXAxisClick,
      onYAxisClick,
      hasXDropdown,
      hasYDropdown,
      xAxisTitle,
      yAxisTitle
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
      title: xAxisTitle || xCol.title,
      showGridLines: xGridLines,
      hasRightLegend,
      hasBottomLegend,
      legendLabels,
      legendColumn,
      dataFormatting,
      chartColors,
      onLegendClick
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
      title: yAxisTitle || yCol.title,
      showGridLines: yGridLines,
      dataFormatting,
      chartColors,
      onLegendClick
    }

    const labelInlineStyles = {
      fontSize: 12,
      fontFamily: 'inherit',
      fill: 'currentColor',
      fillOpacity: 0.7
    }

    // x-axis positions
    const xLabelX =
      (xProps.width - xProps.margins.left) / 2 + xProps.margins.left
    const xLabelY = xProps.height - (xProps.margins.bottomLegend || 0) - 15
    const xLabelWidth = _get(this.getBBoxFromRef(this.xLabelRef), 'width', 0)
    const xLabelHeight = _get(this.getBBoxFromRef(this.xLabelRef), 'height', 0)

    // y-axis positions
    const yLabelY = 20
    const yLabelX = -((yProps.height - yProps.margins.bottom) / 2)
    const yLabelWidth = _get(this.getBBoxFromRef(this.yLabelRef), 'width', 0)
    const yLabelHeight = _get(this.getBBoxFromRef(this.yLabelRef), 'height', 0)

    return (
      <g className="chata-axes" data-test="chata-axes">
        <g>
          <text
            ref={r => (this.yLabelRef = r)}
            className="y-axis-label"
            textAnchor="middle"
            transform="rotate(-90)"
            fontWeight="bold"
            x={yLabelX}
            y={yLabelY}
            style={labelInlineStyles}
          >
            {this.renderAxisLabel(yProps.title, hasYDropdown)}
          </text>
          {hasYDropdown && (
            <rect
              className="y-axis-label-border"
              x={yLabelX - yLabelWidth / 2 - 10}
              y={yLabelY - 16}
              width={yLabelWidth + 20}
              height={yLabelHeight + 10}
              transform="rotate(-90)"
              onClick={e => onYAxisClick(e)}
              fill="transparent"
              stroke="transparent"
              strokeWidth="1px"
              rx="4"
            />
          )}
        </g>
        <Axis {...xProps} />
        <Axis {...yProps} />
        <g>
          <text
            ref={r => (this.xLabelRef = r)}
            className="x-axis-label"
            textAnchor="middle"
            fontWeight="bold"
            y={xLabelY}
            x={xLabelX}
            style={labelInlineStyles}
          >
            {this.renderAxisLabel(xProps.title, hasXDropdown)}
          </text>
          {hasXDropdown && (
            <rect
              className="x-axis-label-border"
              x={xLabelX - 10 - xLabelWidth / 2}
              y={xLabelY - 16}
              width={xLabelWidth + 20}
              height={xLabelHeight + 10}
              onClick={e => onXAxisClick(e)}
              fill="transparent"
              stroke="transparent"
              strokeWidth="1px"
              rx="4"
            />
          )}
        </g>
      </g>
    )
  }
}
