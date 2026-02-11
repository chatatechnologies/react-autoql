import React from 'react'
import { v4 as uuid } from 'uuid'
import NumberAxisSelector from './NumberAxisSelector'
import SingleNumberAxisSelector from './SingleNumberAxisSelector'
import StringAxisSelector from './StringAxisSelector'

export default class AxisSelector extends React.Component {
  constructor(props) {
    super(props)

    this.KEY = uuid()
  }

  renderSingleNumberAxisSelector = (props, disableStringColumns) => {
    return (
      <SingleNumberAxisSelector
        data-test='single-number-axis-selector'
        {...props}
        disableStringColumns={disableStringColumns}
      />
    )
  }

  renderNumberAxisSelector = (props) => <NumberAxisSelector {...props} data-test='number-axis-selector' />

  renderSingleStringAxisSelector = (props) => <StringAxisSelector {...props} data-test='string-axis-selector' />

  render = () => {
    const { scale } = this.props

    if (!scale) {return null}

    const props = {
      ...this.props,
      key: this.KEY,
      ref: (r) => (this.ref = r),
    }

    if (scale.type === 'BIN') {
      return this.renderSingleNumberAxisSelector(props, true)
    } else if (scale.type === 'LINEAR') {
      return scale.allowMultipleSeries && !this.props.isAggregated
        ? this.renderNumberAxisSelector(props)
        : this.renderSingleNumberAxisSelector(props)
    } else if (scale?.type === 'BAND' || scale?.type === 'TIME') {
      return this.renderSingleStringAxisSelector(props)
    }

    return null
  }
}
