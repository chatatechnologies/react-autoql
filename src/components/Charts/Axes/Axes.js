import React from 'react'
import PropTypes from 'prop-types'
import { v4 as uuid } from 'uuid'
import { Axis } from '../Axis'
import { Legend } from '../Legend'
import { getBBoxFromRef } from '../../../js/Util'
import { axesDefaultProps, axesPropTypes } from '../helpers'

export default class Axes extends React.Component {
  constructor(props) {
    super(props)
    this.LEGEND_PADDING = 20
    this.BOTTOM_AXIS_KEY = uuid()
    this.LEFT_AXIS_KEY = uuid()
    this.RIGHT_AXIS_KEY = uuid()
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
    console.log('completed:', orient)
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
      console.log('NO RIGHT AXIS')
      this.rightAxisComplete = true
    }

    if (!this.shouldRenderTopAxis() && !this.topAxisComplete) {
      console.log('NO TOP AXIS')
      this.topAxisComplete = true
    }

    if (this.topAxisComplete && this.bottomAxisComplete && this.leftAxisComplete && this.rightAxisComplete) {
      this.forceUpdate(() => {
        console.log('ON AXES RENDER COMPLETE')
        this.props.onAxesRenderComplete()
      })
    } else {
      console.log('one of the axes is not completed', {
        top: this.topAxisComplete,
        bottom: this.bottomAxisComplete,
        left: this.leftAxisComplete,
        right: this.rightAxisComplete,
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
        ticks={this.props.xTicks}
        translateY={0}
        translateX={0}
        // rotateLabels={this.props.rotateLabels}
        rotateLabels={true}
        col={this.props.xCol}
        title={this.props.bottomAxisTitle}
        showGridLines={this.props.xGridLines}
        hasDropdown={this.props.hasXDropdown}
        innerWidth={innerWidth}
        innerHeight={innerHeight}
        onAxisRenderComplete={this.onAxisRenderComplete}
      />
    )
  }

  renderLeftAxis = (innerWidth, innerHeight) => {
    return (
      <Axis
        {...this.props}
        key={this.LEFT_AXIS_KEY}
        orient='Left'
        scale={this.props.yScale}
        ticks={this.props.yTicks}
        col={this.props.yCol}
        title={this.props.leftAxisTitle}
        showGridLines={this.props.yGridLines}
        hasDropdown={this.props.hasYDropdown}
        innerWidth={innerWidth}
        innerHeight={innerHeight}
        translateY={0}
        translateX={0}
        onAxisRenderComplete={this.onAxisRenderComplete}
      />
    )
  }

  shouldRenderTopAxis = () => {
    return false
    const shouldRenderAxis = !!props.xCol2 && !!props.xScale2
    return shouldRenderAxis
  }

  renderTopAxis = (innerWidth, innerHeight) => {
    if (!this.shouldRenderTopAxis()) {
      return null
    }

    return null
  }

  shouldRenderRightAxis = () => {
    const shouldRenderAxis = !!this.props.yCol2 && !!this.props.yScale2
    return shouldRenderAxis
  }

  renderRightAxis = (innerWidth, innerHeight) => {
    const shouldRenderAxis = this.shouldRenderRightAxis()
    const shouldRenderLegend = !!this.props.legendLocation

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
            ticks={this.props.yTicks2}
            col={this.props.yCol2}
            title={this.props.rightAxisTitle}
            showGridLines={false}
            hasRightLegend={false}
            hasBottomLegend={false}
            hasDropdown={this.props.hasYDropdown}
            innerWidth={innerWidth}
            innerHeight={innerHeight}
            onAxisRenderComplete={this.onAxisRenderComplete}
          />
        )}
        {shouldRenderLegend && this.renderRightLegend()}
      </g>
    )
  }

  renderRightLegend = () => {
    let legendScale
    if (this.props.linearAxis === 'y') {
      legendScale = this.props.yScale
    } else if (this.props.linearAxis === 'x') {
      legendScale = this.props.xScale
    }

    let translateX = this.LEGEND_PADDING
    const rightAxisWidth = getBBoxFromRef(this.rightAxisWithoutLegend?.ref)?.width
    if (rightAxisWidth) {
      translateX += rightAxisWidth
    }

    return (
      <g transform={`translate(${translateX},0)`}>
        <Legend {...this.props} scale={legendScale} placement={this.props.legendLocation} />
      </g>
    )
  }

  render = () => {
    if (
      !this.props.yScale ||
      !this.props.xScale ||
      !this.props.height ||
      !this.props.width ||
      !this.props.xCol ||
      !this.props.yCol
    ) {
      return null
    }

    const xScaleRange = this.props.xScale?.range() || [0, 0]
    const yScaleRange = this.props.yScale?.range() || [0, 0]

    const innerWidth = xScaleRange[1] - xScaleRange[0]
    const innerHeight = yScaleRange[0] - yScaleRange[1]

    return (
      <g ref={(r) => (this.ref = r)}>
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
