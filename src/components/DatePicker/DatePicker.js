import React from 'react'
import PropTypes from 'prop-types'
import { DateRange } from 'react-date-range'
import { getThemeValue } from '../../theme/configureTheme'

import 'react-date-range/dist/styles.css' // main style file
import 'react-date-range/dist/theme/default.css' // theme css file
import './DatePicker.scss'

export default class DatePicker extends React.Component {
  constructor(props) {
    super(props)

    this.state = {
      ranges: [
        {
          startDate: props.initialRange?.startDate ?? props.validRange?.startDate ?? new Date(),
          endDate: props.initialRange?.endDate ?? props.validRange?.endDate ?? new Date(),
          key: 'selection',
        },
      ],
    }
  }

  static propTypes = {
    initialRange: PropTypes.shape({}),
    validRange: PropTypes.shape({}),
  }

  static defaultProps = {
    initialRange: undefined,
    validRange: undefined,
  }

  handleSelect = (ranges) => {
    this.setState({ ranges: [ranges.selection] }, () => {
      const focusedRange = this.datePicker?.state?.focusedRange
      if (focusedRange.every((index) => index === 0)) {
        this.props.onSelection(ranges.selection)
      }
    })
  }

  render = () => {
    const accentColor = getThemeValue('accent-color')

    return (
      <div className='react-autoql-date-picker'>
        <DateRange
          ref={(r) => (this.datePicker = r)}
          ranges={this.state.ranges}
          onChange={this.handleSelect}
          minDate={this.props.validRange?.startDate}
          maxDate={this.props.validRange?.endDate}
          dragSelectionEnabled={false}
          rangeColors={[accentColor]} // defines color for selection preview.
          // Keep all below for reference until feature is complete
          // onRangeFocusChange={this.handleRangeFocusChange}
          // scroll={ // infinite scroll behaviour configuration. Check out Infinite Scroll section
          //   {
          //     enabled: true,
          //     monthHeight: 300,
          //     longMonthHeight: PropTypes.number, // some months has 1 more row than others
          //     monthWidth: 300, // just used when direction="horizontal"
          //     calendarWidth: 300, // defaults monthWidth * months
          //     calendarHeight: 300, // defaults monthHeight * months
          //   }
          // }
          // showMonthArrow
          // navigatorRenderer={() => {}} //renderer for focused date navigation area. fn(currentFocusedDate: Date, changeShownDate: func, props: object)
          // onPreviewChange={(preview) => {}}
          // className=""
          // locale={}
          // months={1} // Number: rendered month count
          // showMonthAndYearPickers={false} //show select tags for month and year on calendar top, if false it will just display the month and year
          // shownDate={} // initial focus date
          // minDate
          // maxDate
          // direction="vertical"
        />
      </div>
    )
  }
}
