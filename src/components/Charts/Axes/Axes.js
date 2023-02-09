import React from 'react'
import PropTypes from 'prop-types'
import { v4 as uuid } from 'uuid'
import { Axis } from '../Axis'
import { Legend } from '../Legend'
import { getBBoxFromRef } from '../../../js/Util'
import { axesDefaultProps, axesPropTypes } from '../helpers'
import { select } from 'd3-selection'

export default class Axes extends React.Component {
  constructor(props) {
    super(props)
    this.LEGEND_PADDING = 20
    this.BOTTOM_AXIS_KEY = uuid()
    this.LEFT_AXIS_KEY = uuid()
    this.RIGHT_AXIS_KEY = uuid()
    this.TOP_AXIS_KEY = uuid()
  }

  static propTypes = {
    ...axesPropTypes,
    onAxesRenderComplete: PropTypes.func,
  }

  static defaultProps = {
    ...axesDefaultProps,
    onAxesRenderComplete: () => {},
  }

  onAxisRenderComplete = (orient) => {
    switch (orient) {
      case 'Right': {
        this.rightAxisComplete = true
        break
      }
      case 'Left': {
        this.leftAxisComplete = true
        break
      }
      case 'Bottom': {
        this.bottomAxisComplete = true
        break
      }
      case 'Top': {
        this.topAxisComplete = true
        break
      }
      case 'Legend': {
        this.legendComplete = true
        break
      }
      default: {
        break
      }
    }

    if (!this.shouldRenderRightAxis() && !this.rightAxisComplete) {
      this.rightAxisComplete = true
    }

    if (!this.shouldRenderTopAxis() && !this.topAxisComplete) {
      this.topAxisComplete = true
    }

    if (!this.shouldRenderLegend() && !this.legendComplete) {
      this.legendComplete = true
    }

    if (
      this.topAxisComplete &&
      this.bottomAxisComplete &&
      this.leftAxisComplete &&
      this.rightAxisComplete &&
      this.legendComplete
    ) {
      this.forceUpdate(() => {
        this.props.onAxesRenderComplete()
      })
    }
  }

  renderBottomAxis = (innerWidth, innerHeight) => {
    return (
      <Axis
        {...this.props}
        ref={(r) => (this.bottomAxis = r)}
        key={this.BOTTOM_AXIS_KEY}
        orient='Bottom'
        scale={this.props.xScale}
        translateY={0}
        translateX={0}
        innerWidth={innerWidth}
        innerHeight={innerHeight}
        onAxisRenderComplete={this.onAxisRenderComplete}
        hasSecondAxis={this.hasSecondAxis()}
      />
    )
  }

  renderLeftAxis = (innerWidth, innerHeight) => {
    return (
      <Axis
        {...this.props}
        key={this.LEFT_AXIS_KEY}
        ref={(r) => (this.leftAxis = r)}
        orient='Left'
        scale={this.props.yScale}
        showGridLines={this.props.yGridLines}
        innerWidth={innerWidth}
        innerHeight={innerHeight}
        translateY={0}
        translateX={0}
        onAxisRenderComplete={this.onAxisRenderComplete}
        hasSecondAxis={this.hasSecondAxis()}
      />
    )
  }

  shouldRenderTopAxis = () => {
    return !!this.props.xScale2
  }

  renderTopAxis = (innerWidth, innerHeight) => {
    if (!this.shouldRenderTopAxis()) {
      return null
    }

    return (
      <Axis
        {...this.props}
        key={this.TOP_AXIS_KEY}
        ref={(r) => (this.topAxis = r)}
        orient='Top'
        scale={this.props.xScale2}
        showGridLines={false}
        innerWidth={innerWidth}
        innerHeight={innerHeight}
        translateY={0}
        translateX={0}
        onAxisRenderComplete={this.onAxisRenderComplete}
        hasSecondAxis={this.hasSecondAxis()}
      />
    )
  }

  shouldRenderRightAxis = () => {
    const shouldRenderAxis = !!this.props.yCol2 && !!this.props.yScale2
    return shouldRenderAxis
  }

  shouldRenderLegend = () => {
    return !!this.props.legendLocation
  }

  renderRightAxis = (innerWidth, innerHeight) => {
    const shouldRenderAxis = this.shouldRenderRightAxis()
    const shouldRenderLegend = this.shouldRenderLegend()

    if (!shouldRenderAxis && !shouldRenderLegend) {
      return null
    }

    return (
      <g ref={(r) => (this.rightAxis = r)} transform={`translate(${innerWidth}, 0)`}>
        {shouldRenderAxis && (
          <Axis
            {...this.props}
            ref={(r) => (this.rightAxisWithoutLegend = r)}
            key={this.RIGHT_AXIS_KEY}
            orient='Right'
            scale={this.props.yScale2}
            showGridLines={false}
            hasRightLegend={false}
            hasBottomLegend={false}
            innerWidth={innerWidth}
            innerHeight={innerHeight}
            onAxisRenderComplete={this.onAxisRenderComplete}
            hasSecondAxis={this.hasSecondAxis()}
          />
        )}
        {shouldRenderLegend && this.renderRightLegend()}
      </g>
    )
  }

  hasSecondAxis = () => {
    return this.shouldRenderRightAxis() || this.shouldRenderTopAxis()
  }

  renderRightLegend = () => {
    const translateX = getBBoxFromRef(this.rightAxisWithoutLegend?.ref)?.width ?? 0
    const translateY = this.shouldRenderTopAxis() ? 10 : 0

    return (
      <g transform={`translate(${translateX},${translateY})`}>
        <Legend
          {...this.props}
          ref={(r) => (this.legendRef = r)}
          legendColumnIndices={this.props.numberColumnIndices}
          legendColumnIndices2={this.props.numberColumnIndices2}
          placement={this.props.legendLocation}
          onRenderComplete={() => this.onAxisRenderComplete('Legend')}
          hasSecondAxis={this.hasSecondAxis()}
        />
      </g>
    )
  }

  render = () => {
    if (!this.props.yScale || !this.props.xScale || !this.props.height || !this.props.width) {
      return null
    }

    const xScaleRange = this.props.xScale?.range() || [0, 0]
    const yScaleRange = this.props.yScale?.range() || [0, 0]

    const innerWidth = xScaleRange[1] - xScaleRange[0]
    const innerHeight = yScaleRange[0] - yScaleRange[1]

    return (
      <g ref={(r) => (this.ref = r)}>
        {this.props.children ?? null}
        <g className='react-autoql-axes' data-test='react-autoql-axes'>
          {this.renderBottomAxis(innerWidth, innerHeight)}
          {this.renderLeftAxis(innerWidth, innerHeight)}
          {this.renderRightAxis(innerWidth, innerHeight)}
          {this.renderTopAxis(innerWidth, innerHeight)}
        </g>
      </g>
    )
  }
}
