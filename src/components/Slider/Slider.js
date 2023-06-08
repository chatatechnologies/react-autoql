import React from 'react'
import PropTypes from 'prop-types'
import ErrorBoundary from '../../containers/ErrorHOC/ErrorHOC'
import ReactSlider from 'react-slider'
import { Input } from '../Input'

import './Slider.scss'

export default class Slider extends React.Component {
  constructor(props) {
    super(props)

    this.state = {
      value: props.initialValue,
      inputValue: props.initialValue,
    }
  }

  static propTypes = {
    renderThumbNumber: PropTypes.bool,
    initialValue: PropTypes.number,
    min: PropTypes.number,
    max: PropTypes.number,
    debounce: PropTypes.bool,
    debounceDelay: PropTypes.number,
    showInput: PropTypes.bool,
    onChange: PropTypes.func,
  }

  static defaultProps = {
    renderThumbNumber: false,
    initialValue: undefined,
    min: 0,
    max: Infinity,
    debounce: true,
    debounceDelay: 20,
    showInput: false,
    onChange: () => {},
  }

  componentWillUnmount = () => {
    clearTimeout(this.debounceTimer)
  }

  componentDidUpdate = (prevProps, prevState) => {
    if (this.state.value !== prevState.value) {
      this.debouncedOnChange(this.state.value)
    }
  }

  onInputChange = (e) => {
    const inputValue = e.target.value ? Number(e.target.value) : null
    const value = this.isValueValidForSlider(inputValue) ? inputValue : this.state.value

    this.setState({ inputValue, value })
  }

  onInputBlur = () => {
    if (this.state.inputValue !== this.state.value) {
      this.setState({ inputValue: this.state.value })
    }
  }

  isValueValidForSlider = (value) => {
    return !isNaN(value) && value > this.props.min && value < this.props.max
  }

  onSliderChange = (value) => {
    this.setState({ value, inputValue: value })
  }

  debouncedOnChange = (value) => {
    if (!this.props.debounce) {
      this.props.onChange(value)
    } else {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = setTimeout(() => {
        this.props.onChange(value)
      }, this.props.debounceDelay)
    }
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
          onChange={this.onSliderChange}
        />
        {this.props.showInput && (
          <Input
            className='react-autoql-slider-input-container'
            type='number'
            value={this.state.inputValue}
            onChange={this.onInputChange}
            onBlur={this.onInputBlur}
          />
        )}
      </ErrorBoundary>
    )
  }
}
