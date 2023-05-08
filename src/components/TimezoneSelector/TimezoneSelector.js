import React from 'react'
import PropTypes from 'prop-types'
import momentTZ from 'moment-timezone'

import { Select } from '../Select'

const options = momentTZ.tz.names().map((tz) => {
  return {
    value: tz,
    label: tz,
  }
})

export default class TimezoneSelector extends React.Component {
  constructor(props) {
    super(props)

    this.defaultTimeZone = momentTZ.tz.guess()
  }

  static propTypes = {
    onChange: PropTypes.func,
    value: PropTypes.string,
    label: PropTypes.string,
  }

  static defaultProps = {
    onChange: () => {},
    value: undefined,
    label: '',
  }

  componentDidMount = () => {
    const selectedOption = this.getSelectedOption()
    this.props.onChange(selectedOption)
  }

  getSelectedOption = () => {
    const defaultValue = this.props.value || this.defaultTimeZone

    return options.find((option) => {
      return option.label === defaultValue
    })?.value
  }

  render = () => {
    const selectedOption = this.getSelectedOption()

    return (
      <Select
        className='react-autoql-timezone-select'
        options={options}
        value={selectedOption}
        onChange={this.props.onChange}
        menuPlacement='top'
        maxMenuHeight={180}
        popoverParentElement={this.props.popoverParentElement}
        popoverBoundaryElement={this.props.popoverBoundaryElement}
        label={this.props.label}
        isSearchable
      />
    )
  }
}
