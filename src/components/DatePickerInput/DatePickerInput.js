import React from 'react'
import PropTypes from 'prop-types'
import dayjs from '../../js/dayjsWithPlugins'

import { DatePicker } from '../DatePicker'
import { Popover } from '../../Popover'
import { Input } from '../Input'

import './DatePickerInput.scss'

export default class DatePickerInput extends React.Component {
  constructor(props) {
    super(props)

    this.state = {
      date: props.initialDate,
    }
  }

  static propTypes = {
    initialDate: PropTypes.shape({}),
  }

  static defaultProps = {
    initialDate: undefined,
  }

  onDateSelection = (date) => {
    this.setState({ date, isPopoverOpen: false }, () => {
      const formatted = dayjs(date).format('MMM D, YYYY')
      const dateUTC = dayjs.utc(formatted).utc()
      this.props.onChange({ dateLocal: date, dateUTC, formatted })
    })
  }

  renderDatePickerPopover = () => {
    return (
      <Popover
        isOpen={this.state.isPopoverOpen}
        align='start'
        positions={['bottom', 'right', 'left', 'top']}
        onClickOutside={() => this.setState({ isPopoverOpen: false })}
        content={
          <div className='react-autoql-popover-date-picker' onClick={(e) => e.stopPropagation()}>
            <DatePicker initialDate={this.state.date} onSelection={this.onDateSelection} />
          </div>
        }
      >
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
          }}
        />
      </Popover>
    )
  }

  render = () => {
    return (
      <div className='react-autoql-date-picker-input'>
        <Input
          ref={(r) => (this.inputRef = r)}
          readOnly
          value={this.state.date?.formatted ?? ''}
          placeholder='Pick a date'
          onClick={(e) => {
            e.stopPropagation()
            this.setState({ isPopoverOpen: true })
          }}
        />
        {this.renderDatePickerPopover()}
      </div>
    )
  }
}
