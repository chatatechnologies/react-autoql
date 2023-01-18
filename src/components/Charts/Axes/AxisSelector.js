import React from 'react'
import NumberAxisSelector from './NumberAxisSelector'
import StringAxisSelector from './StringAxisSelector'

import { isColumnNumberType, isColumnStringType } from '../../QueryOutput/columnHelpers'

export default class AxisSelector extends React.Component {
  shouldComponentUpdate = () => true

  render = () => {
    if (isColumnNumberType(this.props.column)) {
      return <NumberAxisSelector {...this.props} data-test='number-axis-selector' ref={(r) => (this.ref = r)} />
    } else if (isColumnStringType(this.props.column)) {
      return <StringAxisSelector {...this.props} data-test='string-axis-selector' ref={(r) => (this.ref = r)} />
    }

    return null
  }
}
