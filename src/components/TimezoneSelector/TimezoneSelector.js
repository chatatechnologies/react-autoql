import React from 'react'
import PropTypes from 'prop-types'
import _get from 'lodash.get'
import momentTZ from 'moment-timezone'

import { SelectWithArrow } from '../SelectWithArrow'

const defaultTimeZone = momentTZ.tz.guess()
const options = momentTZ.tz.names().map((tz) => {
  return {
    value: tz,
    label: tz,
  }
})

export default class DataAlertModal extends React.Component {
  static propTypes = {
    onChange: PropTypes.func,
    defaultSelection: PropTypes.string,
  }

  static defaultProps = {
    onChange: () => {},
    defaultSelection: undefined,
  }

  componentDidMount = () => {
    const selectedOption = this.getSelectedOption()
    this.props.onChange(selectedOption)
  }

  getSelectedOption = () => {
    const defaultValue = this.props.defaultSelection || defaultTimeZone

    return options.find((option) => {
      return option.label === defaultValue
    })
  }

  render = () => {
    const selectedOption = this.getSelectedOption()

    return (
      <SelectWithArrow
        className="react-autoql-timezone-select"
        options={options}
        selectedOption={selectedOption}
        onChange={this.props.onChange}
        menuPlacement="top"
        maxMenuHeight={180}
        isSearchable
      />
    )
  }
}
