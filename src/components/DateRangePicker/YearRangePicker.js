import React from 'react'
import PropTypes from 'prop-types'
import dayjs from '../../js/dayjsWithPlugins'
import { v4 as uuid } from 'uuid'

import './YearRangePicker.scss'

export default class YearRangePicker extends React.Component {
  constructor(props) {
    super(props)

    this.COMPONENT_KEY = uuid()

    const now = dayjs()

    let visibleDecade = this.getDecade(now.year())
    let selectedStart = now.startOf('year')
    let selectedEnd = now.endOf('year')

    if (props.initialRange) {
      selectedStart = dayjs(this.props.initialRange.startDate).startOf('year')
      selectedEnd = dayjs(this.props.initialRange.endDate).endOf('year')
      visibleDecade = this.getDecade(selectedEnd.year())
    } else if (
      props.minDate &&
      props.maxDate &&
      (now.isBefore(dayjs(props.minDate)) || now.isAfter(dayjs(props.maxDate)))
    ) {
      selectedStart = dayjs(props.minDate).startOf('year')
      selectedEnd = dayjs(props.maxDate).endOf('year')
    }

    this.state = {
      selectedRange: this.props.initialRange,
      visibleDecade,
      selectedStart,
      selectedEnd,
      previewStart: undefined,
      previewEnd: undefined,
      focusedDateDisplay: 'start',
    }
  }

  static propTypes = {
    minDate: PropTypes.instanceOf(Date),
    maxDate: PropTypes.instanceOf(Date),
    initialRange: PropTypes.shape({ startDate: PropTypes.instanceOf(Date), endDate: PropTypes.instanceOf(Date) }),
    onRangeSelection: PropTypes.func,
  }

  static defaultProps = {
    minDate: undefined,
    maxDate: undefined,
    initialRange: undefined,
    onRangeSelection: () => {},
  }

  getDecade = (year) => {
    const yearsSinceDecadeStart = year % 10
    const decadeStart = year - yearsSinceDecadeStart
    return [decadeStart, decadeStart + 9]
  }

  isInDecade = (year, decade) => {
    return year >= decade[0] && year <= decade[1]
  }

  selectedRangeIncludesYear = (timestamp) => {
    if (this.state.selectedStart && this.state.selectedEnd) {
      return timestamp.isBetween(this.state.selectedStart, this.state.selectedEnd, 'year')
    }
    return false
  }

  handleYearHover = (timestamp) => {
    const { selectedStart } = this.state
    let previewStart = timestamp.startOf('year')
    let previewEnd = timestamp.endOf('year')

    if (selectedStart && this.state.focusedDateDisplay === 'end') {
      if (previewEnd.isBefore(selectedStart)) {
        previewEnd = selectedStart.endOf('year')
      } else if (selectedStart.isBefore(previewStart)) {
        previewStart = selectedStart.startOf('year')
      }
    }

    this.setState({ previewStart, previewEnd })
  }

  handleYearClick = (timestamp) => {
    if (this.state.focusedDateDisplay === 'start') {
      this.onYearStartSelection(timestamp)
    } else {
      this.onYearEndSelection(timestamp)
    }
  }

  incrementDecade = () => {
    const currentDecadeEnd = this.state.visibleDecade[1]
    this.setState({ visibleDecade: [currentDecadeEnd + 1, currentDecadeEnd + 10] })
  }

  decrementDecade = () => {
    const currentDecadeStart = this.state.visibleDecade[0]
    this.setState({ visibleDecade: [currentDecadeStart - 10, currentDecadeStart - 1] })
  }

  onYearStartSelection = (timestamp) => {
    this.setState({ selectedStart: timestamp.startOf('year'), selectedEnd: undefined, focusedDateDisplay: 'end' })
    const selectedStart = timestamp.startOf('year')
    const rangeSelection = [selectedStart, timestamp]
    const selectedStartMonthStart = rangeSelection[0].startOf('year')
    const selectedEndMonthEnd = rangeSelection[1].endOf('year')
    this.props.onRangeSelection({
      startDate: selectedStartMonthStart.toDate(),
      endDate: selectedEndMonthEnd.toDate(),
    })
  }

  onYearEndSelection = (timestamp) => {
    try {
      const { selectedStart } = this.state
      if (!selectedStart) {
        this.setState({ selectedEnd: timestamp, focusedDateDisplay: 'start' })
      }

      const rangeSelection = [selectedStart, timestamp]
      if (selectedStart.isAfter(timestamp)) {
        rangeSelection.reverse()
      }

      const selectedStartYearStart = rangeSelection[0].startOf('year')
      const selectedEndYearEnd = rangeSelection[1].endOf('year')

      this.setState({ selectedStart: selectedStartYearStart, selectedEnd: selectedEndYearEnd })

      this.props.onRangeSelection({
        startDate: selectedStartYearStart.toDate(),
        endDate: selectedEndYearEnd.toDate(),
      })
    } catch (error) {
      console.error(error)
    }
  }

  renderDateDisplay = () => {
    const startDateText = this.state.selectedStart?.year() ?? ''
    const endDateText = this.state.selectedEnd?.year() ?? startDateText ?? ''

    return (
      <div className='rdrDateDisplayWrapper'>
        <div className='rdrDateDisplay'>
          <span
            className={`rdrDatePickerInput rdrDateDisplayItem
              ${this.state.focusedDateDisplay === 'start' ? 'rdrDateDisplayItemActive' : ''}`}
          >
            <input
              readOnly
              placeholder='Early'
              value={startDateText}
              onClick={() => this.setState({ focusedDateDisplay: 'start' })}
            />
          </span>
          <span
            className={`rdrDatePickerInput rdrDateDisplayItem ${
              this.state.focusedDateDisplay === 'end' ? 'rdrDateDisplayItemActive' : ''
            }`}
          >
            <input
              readOnly
              placeholder='Continuous'
              value={endDateText}
              onClick={() => this.setState({ focusedDateDisplay: 'end' })}
            />
          </span>
        </div>
      </div>
    )
  }

  renderDecadePicker = () => {
    const lowerDecadeLimit = this.props.minDate
      ? this.getDecade(dayjs(this.props.minDate).year())
      : this.getDecade(dayjs(new Date()).add(-100, 'year').year())

    const upperDecadeLimit = this.props.maxDate
      ? this.getDecade(dayjs(this.props.maxDate).year())
      : this.getDecade(dayjs(new Date()).add(20, 'year').year())

    const numDecades = (upperDecadeLimit[0] - lowerDecadeLimit[0]) / 10

    return (
      <div className={`react-autoql-month-picker-year`}>
        <button
          className='rdrNextPrevButton rdrPprevButton rdrPrevButton'
          onClick={this.decrementDecade}
          disabled={this.state.visibleDecade[0] === lowerDecadeLimit[0]}
        >
          <i></i>
        </button>
        <select
          className='year-picker'
          value={`${this.state.visibleDecade[0]} - ${this.state.visibleDecade[1]}`}
          onChange={(e) => {
            const decadeArray = e.target.value.split(' - ').map((year) => Number(year))
            this.setState({ visibleDecade: decadeArray })
          }}
        >
          {new Array(numDecades).fill(lowerDecadeLimit).map((decade, i) => {
            const decadeText = `${decade[0] + i * 10} - ${decade[1] + i * 10}`
            return (
              <option key={i} value={decadeText}>
                {decadeText}
              </option>
            )
          })}
        </select>
        <button
          className='rdrNextPrevButton rdrNextButton'
          onClick={this.incrementDecade}
          disabled={this.state.visibleDecade[0] === upperDecadeLimit[0]}
        >
          <i></i>
        </button>
      </div>
    )
  }

  isSelected = (timestamp) => {
    const { selectedStart, selectedEnd } = this.state
    const isSelectedStart = timestamp.startOf('year').isSame(selectedStart?.startOf('year'))
    const isSelectedEnd =
      (isSelectedStart && !selectedEnd) || timestamp.endOf('year').isSame(selectedEnd?.endOf('year'))
    const isSelected = isSelectedStart || isSelectedEnd || this.selectedRangeIncludesYear(timestamp)

    return {
      isSelected,
      isSelectedStart,
      isSelectedEnd,
    }
  }

  isPreview = (timestamp) => {
    const { previewStart, previewEnd } = this.state
    const isPreviewStart = timestamp.startOf('year').isSame(previewStart)
    const isPreviewEnd = timestamp.endOf('year').isSame(previewEnd)
    const isPreview = isPreviewStart || isPreviewEnd || timestamp.isBetween(previewStart, previewEnd, 'year')

    return {
      isPreview,
      isPreviewStart,
      isPreviewEnd,
    }
  }

  isDisabled = (timestamp) => {
    const isBeforeMinDate = this.props.minDate && timestamp.isBefore(dayjs(this.props.minDate).startOf('year'))
    const isAfterMaxDate = this.props.maxDate && timestamp.isAfter(dayjs(this.props.maxDate).endOf('year'))
    return isBeforeMinDate || isAfterMaxDate
  }

  renderYearGrid = () => {
    const { visibleDecade } = this.state
    const yearArray = new Array(10).fill(visibleDecade[0]).map((val, i) => {
      return val + i
    })

    const yearGrid = [
      [...yearArray.slice(0, 3)],
      [...yearArray.slice(3, 6)],
      [...yearArray.slice(6, 9)],
      [yearArray[9]],
    ]

    return (
      <div className='react-autoql-month-picker-month-picker'>
        {yearGrid.map((yearRow, i) => {
          return (
            <div className='month-picker-row' key={`month-row-${i}`}>
              {yearRow.map((year) => {
                const timestamp = dayjs(`${year}-01-15`)

                const { isSelected, isSelectedStart, isSelectedEnd } = this.isSelected(timestamp)
                const { isPreview, isPreviewStart, isPreviewEnd } = this.isPreview(timestamp)
                const isDisabled = this.isDisabled(timestamp)
                const isThisYear = year === dayjs().year()

                return (
                  <div
                    key={year}
                    className={`month-picker-month
                      ${isThisYear ? ' current-month' : ''}
                      ${isSelectedStart ? ' selection-start' : ''}
                      ${isSelectedEnd ? ' selection-end' : ''}
                      ${isSelected ? ' active' : ''}
                      ${isPreviewStart ? ' preview-start' : ''}
                      ${isPreviewEnd ? ' preview-end' : ''}
                      ${isPreview ? ' preview' : ''}
                      ${isDisabled ? ' rdrDayDisabled' : ''}`}
                    onClick={() => this.handleYearClick(timestamp)}
                    onMouseEnter={() => !isDisabled && this.handleYearHover(timestamp)}
                    onMouseLeave={() =>
                      !isDisabled && this.setState({ previewStart: undefined, previewEnd: undefined })
                    }
                  >
                    <div className='month-picker-month-text-wrapper'>
                      <div className='month-picker-month-text'>
                        <span>{year}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    )
  }

  render = () => {
    return (
      <div className='react-autoql-date-picker react-autoql-month-range-picker'>
        {this.renderDateDisplay()}
        {this.renderDecadePicker()}
        {this.renderYearGrid()}
      </div>
    )
  }
}
