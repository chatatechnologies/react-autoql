import React from 'react'
import _get from 'lodash.get'
import _isEqual from 'lodash.isequal'
import { axesDefaultProps, axesPropTypes } from '../helpers'
export default class AxisSelector extends React.Component {
  constructor(props) {
    super(props)
  }

  static propTypes = axesPropTypes
  static defaultProps = axesDefaultProps

  render = () => {
    return (
      <rect
        {...this.props.childProps}
        className='legend-title-border'
        data-test='legend-title-border'
        fill='transparent'
        stroke='transparent'
        strokeWidth='1px'
        rx='4'
        onClick={() => {
          console.log('You clicked me! I can scale the charts!')
        }}
      />
    )
  }
}
