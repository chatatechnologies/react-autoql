import React, { Fragment } from 'react'
import PropTypes from 'prop-types'
import _get from 'lodash.get'
import uuid from 'uuid'

import '../DateSelect.scss'

const days = [
  {
    description: 'January',
    value: 1,
    label: 'Jan'
  },
  {
    description: 'February',
    value: 2,
    label: 'Feb'
  },
  {
    description: 'March',
    value: 3,
    label: 'Mar'
  },
  {
    description: 'April',
    value: 4,
    label: 'Apr'
  },
  {
    description: 'May',
    value: 5,
    label: 'May'
  },
  {
    description: 'June',
    value: 6,
    label: 'Jun'
  },
  {
    description: 'July',
    value: 7,
    label: 'Jul'
  },
  {
    description: 'August',
    value: 8,
    label: 'Aug'
  },
  {
    description: 'September',
    value: 9,
    label: 'Sep'
  },
  {
    description: 'October',
    value: 10,
    label: 'Oct'
  },
  {
    description: 'November',
    value: 11,
    label: 'Nov'
  },
  {
    description: 'December',
    value: 12,
    label: 'Dec'
  }
]

export default class YearSelect extends React.Component {
  COMPONENT_KEY = uuid.v4()

  static propTypes = {
    value: PropTypes.arrayOf(PropTypes.number),
    onChange: PropTypes.func,
    multiSelect: PropTypes.bool,
    allowNullValue: PropTypes.bool
  }

  static defaultProps = {
    value: [],
    multiSelect: false,
    onChange: () => {},
    allowNullValue: false
  }

  sortFunction = (a, b) => {
    try {
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

  onChange = selectedValue => {
    let finalOption = [selectedValue]
    if (this.props.multiSelect) {
      if (this.props.value.includes(selectedValue)) {
        // Its already selected, deselect it
        if (this.props.value.length === 1 && !this.props.allowNullValue) {
          // Do not allow to deselect last value if allowNullValue is false
          return this.props.value
        }
        finalOption = this.props.value.filter(value => value !== selectedValue)
      } else {
        // Select it
        finalOption = [...this.props.value, selectedValue]
      }
    }
    this.props.onChange(finalOption.sort(this.sortFunction))
  }

  render = () => {
    return (
      <div
        className="chata-radio-btn-container year-select"
        data-test="chata-year-select"
      >
        {days.map((option, i) => {
          let isActive = this.props.value === option.value
          if (this.props.multiSelect) {
            isActive = this.props.value.includes(option.value)
          }

          return (
            <Fragment key={`chata-radio-${this.COMPONENT_KEY}-${i}`}>
              <div
                className={`chata-radio-btn
                  ${isActive ? ' active' : ''}
                  ${this.props.outlined ? ' outlined' : ''}
                  ${i === 2 ? ' top-right' : ''}
                  ${i === 9 ? ' bottom-left' : ''}
                  ${i === 11 ? ' bottom-right' : ''}`}
                onClick={() => this.onChange(option.value)}
              >
                {option.label}
              </div>
              {i !== 0 && (i + 1) % 3 === 0 && <br />}
            </Fragment>
          )
        })}
      </div>
    )
  }
}
