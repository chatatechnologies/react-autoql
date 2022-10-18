import React from 'react'
import _get from 'lodash.get'
import _isEqual from 'lodash.isequal'
import NumberAxisSelector from './NumberAxisSelector'
import StringAxisSelector from './StringAxisSelector'

import { isColumnNumberType, isColumnStringType } from '../../QueryOutput/columnHelpers'
import { axesDefaultProps, axesPropTypes } from '../helpers'

export default class AxisSelector extends React.Component {
  static propTypes = axesPropTypes
  static defaultProps = axesDefaultProps

  render = () => {
    if (isColumnNumberType(this.props.column)) {
      return <NumberAxisSelector data-test='number-axis-selector' {...this.props} />
    } else if (isColumnStringType(this.props.column)) {
      return <StringAxisSelector data-test='string-axis-selector' {...this.props} />
    }

    return null
  }
}
