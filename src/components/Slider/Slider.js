import React from 'react'
import PropTypes from 'prop-types'
import ErrorBoundary from '../../containers/ErrorHOC/ErrorHOC'
import ReactSlider from 'react-slider'

import './Slider.scss'

export default class Slider extends React.Component {
  static propTypes = {
    renderThumbNumber: PropTypes.bool,
  }

  static defaultProps = {
    renderThumbNumber: false,
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
        />
      </ErrorBoundary>
    )
  }
}
