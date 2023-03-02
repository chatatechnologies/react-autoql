import React from 'react'

export default class AxisScaler extends React.Component {
  constructor(props) {
    super(props)
  }

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
        onClick={this.props.toggleChartScale}
      />
    )
  }
}
