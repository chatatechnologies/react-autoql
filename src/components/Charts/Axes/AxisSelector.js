import React from 'react'
import { v4 as uuid } from 'uuid'
import NumberAxisSelector from './NumberAxisSelector'
import StringAxisSelector from './StringAxisSelector'

import { isColumnNumberType, isColumnStringType } from '../../QueryOutput/columnHelpers'

export default class AxisSelector extends React.Component {
  constructor(props) {
    super(props)

    this.KEY = uuid()
  }

  render = () => {
    if (this.props.scale?.type === 'LINEAR') {
      return (
        <NumberAxisSelector {...this.props} key={this.KEY} data-test='number-axis-selector' ref={(r) => (this.ref = r)}>
          {this.props.children}
        </NumberAxisSelector>
      )
    } else if (this.props.scale?.type === 'BAND') {
      return (
        <StringAxisSelector {...this.props} key={this.KEY} data-test='string-axis-selector' ref={(r) => (this.ref = r)}>
          {this.props.children}
        </StringAxisSelector>
      )
    }

    return null
  }
}
