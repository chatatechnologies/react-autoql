import React from 'react'
import PropTypes from 'prop-types'

import { Select } from '../Select'

const DEFAULT_INTERVAL = 30

export default class DateRangePicker extends React.Component {
  constructor(props) {
    super(props)

    this.minuteFormatter = new Intl.NumberFormat('en-US', {
      minimumIntegerDigits: 2,
      minimumFractionDigits: 0,
    })

    const optionArray = this.getOptionArray()

    this.state = {
      selectedTime: this.props.value,
      optionArray,
    }
  }

  static propTypes = {
    value: PropTypes.string,
    interval: PropTypes.number,
  }

  static defaultProps = {
    value: undefined,
    interval: DEFAULT_INTERVAL,
  }

  componentDidMount = () => {
    this._isMounted = true
  }

  componentDidUpdate = (prevProps) => {
    if (this.props.interval !== prevProps.interval) {
      this.setState({ optionArray: this.getOptionArray() })
    }
  }

  componentWillUnmount = () => {
    this._isMounted = false
  }

  onChange = (value) => {
    const timeObject = this.state.optionArray.find((option) => option.value === value)
    this.props.onChange(timeObject)
  }

  isValid = () => {
    const valueExists = !!this.props.value
    const valueExistsInOptionsArray = !!this.state.optionArray.find((option) => option.value === this.props.value)
    return valueExists && valueExistsInOptionsArray
  }

  getOptionArray = () => {
    let interval = this.props.interval

    if (60 % interval !== 0) {
      console.warn(`Interval provided to TimePicker was invalid. 60 is not divisible ${interval}.`)
      interval = DEFAULT_INTERVAL
    }

    const optionsPerHour = 60 / interval
    const options = []
    const hours = 24

    for (let hr = 0; hr < hours; hr++) {
      for (let min = 0; min < optionsPerHour; min++) {
        let ampm = 'am'
        if (hr >= 12) {
          ampm = 'pm'
        }

        let hour = hr % 12
        if (hour === 0) {
          hour = 12
        }

        const minute = this.minuteFormatter.format(min * interval)

        options.push({
          ampm,
          minute,
          hour,
          hour24: hr,
          value: `${hour}:${minute}${ampm}`,
          value24hr: `${hr}:${minute}`,
        })
      }
    }

    return options
  }

  render = () => {
    return (
      <Select
        options={this.state.optionArray.map((timeObject) => ({ value: timeObject.value }))}
        value={this.props.value}
        onChange={this.onChange}
      />
    )
  }
}
