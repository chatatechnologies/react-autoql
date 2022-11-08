import React from 'react'
import _get from 'lodash.get'
import _isEqual from 'lodash.isequal'
import { axesDefaultProps, axesPropTypes } from '../helpers'
export default class AxisScaler extends React.Component {
  constructor(props) {
    super(props)
  }

  static propTypes = axesPropTypes
  static defaultProps = axesDefaultProps

  render = () => {
    return (
      <rect
        {...this.props.childProps}
        className='axis-scaler-border'
        data-test='axis-scaler-border'
        fill='transparent'
        stroke='transparent'
        strokeWidth='1px'
        rx='4'
        onClick={this.props.setIsChartScaled}
      />
    )
  }
}
