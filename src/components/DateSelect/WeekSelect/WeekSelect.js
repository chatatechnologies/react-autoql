import React from 'react'
import PropTypes from 'prop-types'
import _get from 'lodash.get'
import { v4 as uuid } from 'uuid'

import '../DateSelect.scss'

const days = [
  {
    description: 'Sunday',
    value: 1,
    label: 'S',
  },
  {
    description: 'Monday',
    value: 2,
    label: 'M',
  },
  {
    description: 'Tuesday',
    value: 3,
    label: 'T',
  },
  {
    description: 'Wednesday',
    value: 4,
    label: 'W',
  },
  {
    description: 'Thursday',
    value: 5,
    label: 'T',
  },
  {
    description: 'Friday',
    value: 6,
    label: 'F',
  },
  {
    description: 'Saturday',
    value: 7,
    label: 'S',
  },
]

export default class WeekSelect extends React.Component {
  COMPONENT_KEY = uuid()

  static propTypes = {
    value: PropTypes.arrayOf(PropTypes.number),
    onChange: PropTypes.func,
    multiSelect: PropTypes.bool,
    allowNullValue: PropTypes.bool,
  }

  static defaultProps = {
    value: [],
    multiSelect: false,
    onChange: () => {},
    allowNullValue: false,
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
        finalOption = this.props.value.filter(
          (value) => value !== selectedValue
        )
      } else {
        // Select it
        finalOption = [...this.props.value, selectedValue]
      }
    }
    this.props.onChange(finalOption.sort())
  }

  render = () => {
    return (
      <div
        className="react-autoql-radio-btn-container"
        data-test="react-autoql-week-select"
      >
        {days.map((option, i) => {
          let isActive = this.props.value === option.value
          if (this.props.multiSelect) {
            isActive = this.props.value.includes(option.value)
          }

          return (
            <div
              key={`react-autoql-radio-${this.COMPONENT_KEY}-${i}`}
              className={`react-autoql-radio-btn
                ${isActive ? ' active' : ''}
                ${this.props.outlined ? ' outlined' : ''}`}
              onClick={() => this.onChange(option.value)}
            >
              {option.label}
            </div>
          )
        })}
      </div>
    )
  }
}
