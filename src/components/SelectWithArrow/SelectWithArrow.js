import React from 'react'
import PropTypes from 'prop-types'
import { v4 as uuid } from 'uuid'
import _get from 'lodash.get'
import _isEqual from 'lodash.isequal'
import ReactSelect from 'react-select'

import ErrorBoundary from '../../containers/ErrorHOC/ErrorHOC'

import './SelectWithArrow.scss'

export default class Select extends React.Component {
  ID = uuid()

  static propTypes = {
    onChange: PropTypes.func,
    options: PropTypes.arrayOf(PropTypes.shape({})),
    selectedOption: PropTypes.shape({}),
  }

  static defaultProps = {
    onChange: undefined,
    options: [],
    selectedOption: undefined,
    style: {},
  }

  state = {
    selected: this.props.selectedOption,
    isOpen: false,
  }

  handleChange = (selected) => {
    if (this.props.onChange) {
      this.props.onChange(selected)
    }

    this.setState({ selected })
  }

  render = () => {
    if (!this.props.options) {
      return null
    }

    const {
      onChange,
      options,
      selectedOption,
      className,
      ...restProps
    } = this.props

    return (
      <ErrorBoundary>
        <ReactSelect
          className={`${this.props.className ||
            ''} react-autoql-select-with-arrow`}
          classNamePrefix="react-autoql-select-with-arrow"
          value={this.state.selected}
          onChange={this.handleChange}
          options={this.props.options}
          {...restProps}
        />
      </ErrorBoundary>
    )
  }
}
