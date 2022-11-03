import React from 'react'
import _get from 'lodash.get'
import _isEqual from 'lodash.isequal'
import axios from 'axios'
import { v4 as uuid } from 'uuid'
import { Popover } from 'react-tiny-popover'
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
        className='axis-label-border'
        data-test='axis-label-border'
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
