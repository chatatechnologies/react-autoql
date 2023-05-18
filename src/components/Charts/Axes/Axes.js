import React from 'react'
import PropTypes from 'prop-types'
import { v4 as uuid } from 'uuid'
import { Axis } from '../Axis'
import { axesDefaultProps, axesPropTypes } from '../helpers'

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

    if (this.topAxisComplete && this.bottomAxisComplete && this.leftAxisComplete && this.rightAxisComplete) {
      this.props.onAxesRenderComplete()
    }
  }

  renderBottomAxis = (innerWidth, innerHeight) => {
    return (
      <g ref={(r) => (this.bottomAxis = r)}>
        <Axis
          {...this.props}
          ref={(r) => (this.bottomAxisWithoutLegend = r)}
          key={this.BOTTOM_AXIS_KEY}
          orient='Bottom'
          scale={this.props.xScale}
          translateY={0}
          translateX={0}
          hasLegend={this.shouldRenderBottomLegend()}
          innerWidth={innerWidth}
          innerHeight={innerHeight}
          onAxisRenderComplete={this.onAxisRenderComplete}
          hasSecondAxis={this.hasSecondAxis()}
        />
      </g>
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

  shouldRenderRightLegend = () => {
    return this.props.legendLocation === 'right'
  }

  shouldRenderBottomLegend = () => {
    return this.props.legendLocation === 'bottom'
  }

  renderRightAxis = (innerWidth, innerHeight) => {
    const shouldRenderAxis = this.shouldRenderRightAxis()
    const shouldRenderRightLegend = this.shouldRenderRightLegend()

    if (!shouldRenderAxis && !shouldRenderRightLegend) {
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
            hasLegend={shouldRenderRightLegend}
            innerWidth={innerWidth}
            innerHeight={innerHeight}
            onAxisRenderComplete={this.onAxisRenderComplete}
            hasSecondAxis={this.hasSecondAxis()}
          />
        )}
      </g>
    )
  }

  hasSecondAxis = () => {
    return this.shouldRenderRightAxis() || this.shouldRenderTopAxis()
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
