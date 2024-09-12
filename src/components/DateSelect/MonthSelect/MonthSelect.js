import React from 'react'
import PropTypes from 'prop-types'
import { v4 as uuid } from 'uuid'

import '../DateSelect.scss'

const days = Array.from({ length: 31 }, (a, b) => b + 1)

export default class MonthSelect extends React.Component {
  COMPONENT_KEY = uuid()

  static propTypes = {
    value: PropTypes.arrayOf(PropTypes.number),
    multiSelect: PropTypes.bool,
    showLastDaySelector: PropTypes.bool,
    onChange: PropTypes.func,
    allowNullValue: PropTypes.bool,
  }

  static defaultProps = {
    value: [],
    multiSelect: false,
    showLastDaySelector: true,
    onChange: () => {},
    allowNullValue: false,
  }

  sortFunction = (a, b) => {
    try {
      if (Number(a) === -1) {
        return 1
      }
      if (Number(b) === -1) {
        return -1
      }
      if (Number(a) < Number(b)) {
        return -1
      }
      if (Number(a) > Number(b)) {
        return 1
      }
      return 0
    } catch (error) {
      console.error(error)
      return 0
    }
  }

  onChange = (selectedValue) => {
    let finalOption = [selectedValue]
    if (this.props.multiSelect) {
      if (this.props.value.includes(selectedValue)) {
        // Its already selected, deselect it
        if (this.props.value.length === 1 && !this.props.allowNullValue) {
          // Do not allow to deselect last value if allowNullValue is false
          return this.props.value
        }
        finalOption = this.props.value.filter((value) => value !== selectedValue)
      } else {
        // Select it
        finalOption = [...this.props.value, selectedValue]
      }
    }

    this.props.onChange(finalOption.sort(this.sortFunction))
  }

  renderLastDaySelector = () => {
    if (!this.props.showLastDaySelector) {
      return null
    }

    let isActive = this.props.value === -1
    if (this.props.multiSelect) {
      isActive = this.props.value.includes(-1)
    }

    return (
      <div
        key={`react-autoql-radio-${this.COMPONENT_KEY}-last-day`}
        className={`react-autoql-radio-btn last-day
          ${isActive ? ' active' : ''}
          ${this.props.outlined ? ' outlined' : ''}`}
        onClick={() => this.onChange(-1)}
      >
        Last Day
      </div>
    )
  }

  getButtonClassNames = (option, i) => {
    let isActive = this.props.value === option
    if (this.props.multiSelect) {
      isActive = this.props.value.includes(option)
    }

    return `${isActive ? ' active' : ''}
    ${this.props.outlined ? ' outlined' : ''}
    ${i === 6 ? ' top-right' : ''}
    ${i === 27 && !this.props.showLastDaySelector ? ' bottom-right' : ''}
    ${i === 28 ? ' bottom-left' : ''}`
  }

  render = () => {
    return (
      <div
        className='react-autoql-radio-btn-container month-select'
        data-test='react-autoql-month-select'
        key={`month-select-${this.COMPONENT_KEY}`}
      >
        {days.map((option, i) => {
          return (
            <fragment key={`react-autoql-radio-${this.COMPONENT_KEY}-${i}`}>
              <div
                className={`react-autoql-radio-btn ${this.getButtonClassNames(option, i)}`}
                onClick={() => this.onChange(option)}
              >
                {option}
              </div>
              {
                i !== 0 && // not the first row
                  i !== days.length - 1 && // not the last row
                  (i + 1) % 7 === 0 && <br /> // every 7th day
              }
            </fragment>
          )
        })}
        {this.renderLastDaySelector()}
      </div>
    )
  }
}
