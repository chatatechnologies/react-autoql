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
    minLabel: PropTypes.string,
    maxLabel: PropTypes.string,
    marks: PropTypes.oneOfType([PropTypes.number, PropTypes.array, PropTypes.bool]),
    debounce: PropTypes.bool,
    debounceDelay: PropTypes.number,
    showInput: PropTypes.bool,
    label: PropTypes.string,
    step: PropTypes.number,
    onChange: PropTypes.func,
  }

  static defaultProps = {
    renderThumbNumber: true,
    initialValue: undefined,
    min: 0,
    max: 100,
    minLabel: undefined,
    maxLabel: undefined,
    marks: 10,
    debounce: false,
    throttle: true,
    debounceDelay: 20,
    throttleDelay: 20,
    showInput: false,
    label: undefined,
    step: 1,
    onChange: () => {},
  }

  componentWillUnmount = () => {
    clearTimeout(this.debounceTimer)
    clearTimeout(this.throttleTimer)
  }

  componentDidUpdate = (prevProps, prevState) => {
    if (this.state.value !== prevState.value) {
      if (this.props.throttle) {
        this.throttledOnChange(this.state.value)
      } else if (this.props.debounce) {
        this.debouncedOnChange(this.state.value)
      } else {
        this.props.onChange(this.state.value)
      }
    }
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

  throttledOnChange = (value) => {
    if (!this.inThrottle) {
      this.props.onChange(value)
      this.inThrottle = true
      this.throttleTimer = setTimeout(() => (this.inThrottle = false), this.props.throttleDelay)
    }
  }

  onInputChange = (e) => {
    const inputValue = e.target.value
    const value = this.isValueValidForSlider(inputValue) ? Number(inputValue) : this.state.value

    this.setState({ inputValue, value })
  }

  onInputBlur = () => {
    if (this.state.inputValue !== this.state.value) {
      this.setState({ inputValue: this.state.value })
    }
  }

  isValueValidForSlider = (value) => {
    const numberValue = Number(value)
    return !isNaN(value) && numberValue >= this.props.min && numberValue <= this.props.max
  }

  onSliderChange = (value) => {
    this.setState({ value, inputValue: value })
  }

  renderThumb = (props, state) => {
    let value = state.valueNow
    if (this.props.renderThumbNumber && this.props.valueFormatter) {
      value = this.props.valueFormatter(state.valueNow)
    }

    return (
      <div {...props}>
        {!!this.props.renderThumbNumber && <div className='react-autoql-slider-value-bubble'>{value}</div>}
      </div>
    )
  }

  render = () => {
    let min = this.props.min
    let max = this.props.max
    let inputStep = undefined

    if (!isNaN(this.props.step)) {
      inputStep = `${this.props.step}`
    }

    if (isNaN(min)) {
      min = 0
    }

    if (isNaN(max)) {
      max = 100
    }

    const marks = [min, max]

    return (
      <ErrorBoundary>
        <div className={`react-autoql-slider-wrapper ${this.props.className ?? ''}`} style={this.props.style}>
          <div className='react-autoql-slider-and-label-container'>
            <div className='react-autoql-slider-container'>
              <div className='react-autoql-slider-min-max-labels'>
                <div className='react-autoql-slider-mark-label'>{this.props.minLabel ?? min}</div>
                <label id='react-autoql-slider-label' className='react-autoql-slider-label'>
                  {this.props.label}
                </label>
                <div className='react-autoql-slider-mark-label'>{this.props.maxLabel ?? max}</div>
              </div>
              <ReactSlider
                className='react-autoql-slider'
                thumbClassName='react-autoql-slider-thumb'
                trackClassName='react-autoql-slider-track'
                markClassName='react-autoql-slider-mark'
                ariaLabelledby='react-autoql-slider-label'
                thumbActiveClassName='react-autoql-slider-thumb-active'
                min={min}
                max={max}
                step={this.props.step}
                marks={marks}
                value={this.state.value}
                onChange={this.onSliderChange}
                renderThumb={this.renderThumb}
              />
            </div>
          </div>
          {this.props.showInput && (
            <div className='react-autoql-slider-input-wrapper'>
              <Input
                type='number'
                value={`${this.state.inputValue}`}
                onChange={this.onInputChange}
                onBlur={this.onInputBlur}
                min={min}
                max={max}
                step={inputStep}
              />
            </div>
          )}
        </div>
      </ErrorBoundary>
    )
  }
}
