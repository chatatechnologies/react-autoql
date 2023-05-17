import React from 'react'
import PropTypes from 'prop-types'
import ErrorBoundary from '../../containers/ErrorHOC/ErrorHOC'
import ReactSlider from 'react-slider'

import './Slider.scss'

export default class Slider extends React.Component {
  constructor(props) {
    super(props)

    this.state = {
      value: this.props.intialValue,
    }
  }

  static propTypes = {
    renderThumbNumber: PropTypes.bool,
    initialValue: PropTypes.number,
    onChange: PropTypes.func,
  }

  static defaultProps = {
    renderThumbNumber: false,
    initialValue: undefined,
    onChange: () => {},
  }

  renderThumb = (props, state) => {
    return <div {...props}>{state.valueNow} </div>
  }

  render = () => {
    return (
      <ErrorBoundary>
        <ReactSlider
          {...this.props}
          className={`react-autoql-slider-container ${this.props.className ?? ''}`}
          thumbClassName='react-autoql-slider-thumb'
          trackClassName='react-autoql-slider-track'
          renderThumb={this.props.renderThumbNumber ? this.renderThumb : undefined}
          value={this.state.value}
          onChange={(value, index) => {
            this.props.onChange(value, index)
            this.setState({ value })
          }}
        />
      </ErrorBoundary>
    )
  }
}
