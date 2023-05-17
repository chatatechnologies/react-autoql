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

  render = () => {
    if (this.props.scale?.type === 'BIN') {
      return (
        <SingleNumberAxisSelector
          {...this.props}
          key={this.KEY}
          data-test='single-number-axis-selector'
          ref={(r) => (this.ref = r)}
        >
          {this.props.children}
        </SingleNumberAxisSelector>
      )
    } else if (this.props.scale?.type === 'LINEAR') {
      return (
        <NumberAxisSelector {...this.props} key={this.KEY} data-test='number-axis-selector' ref={(r) => (this.ref = r)}>
          {this.props.children}
        </NumberAxisSelector>
      )
    } else if (this.props.scale?.type === 'BAND' || this.props.scale?.type === 'TIME') {
      return (
        <StringAxisSelector {...this.props} key={this.KEY} data-test='string-axis-selector' ref={(r) => (this.ref = r)}>
          {this.props.children}
        </StringAxisSelector>
      )
    }

    return null
  }
}
