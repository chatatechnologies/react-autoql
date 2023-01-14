import React from 'react'
import NumberAxisSelector from './NumberAxisSelector'
import StringAxisSelector from './StringAxisSelector'

import { isColumnNumberType, isColumnStringType } from '../../QueryOutput/columnHelpers'
import { deepEqual } from '../../../js/Util'

export default class AxisSelector extends React.Component {
  shouldComponentUpdate = (nextProps, nextState) => {
    return !deepEqual(this.props, nextProps) || !deepEqual(this.state, nextState)
  }

  render = () => {
    if (isColumnNumberType(this.props.column)) {
      return <NumberAxisSelector data-test='number-axis-selector' {...this.props} />
    } else if (isColumnStringType(this.props.column)) {
      return <StringAxisSelector data-test='string-axis-selector' {...this.props} />
    }

    return null
  }
}
