import React from 'react'
import { v4 as uuid } from 'uuid'
import PropTypes from 'prop-types'

import { Input } from '../Input'
import { ErrorBoundary } from '../../containers/ErrorHOC'

import './InlineInputEditor.scss'

export default class InlineInputEditor extends React.Component {
  constructor(props) {
    super(props)

    this.ID = uuid()
    this.INPUT_ID = uuid()
    this.position = undefined

    this.state = {
      isInput: false,
      inputValue: `${props.value}` ?? '',
    }
  }

  static propTypes = {
    value: PropTypes.string,
    type: PropTypes.string,
    onChange: PropTypes.func,
    datePicker: PropTypes.bool,
    disabledOnClickEdit: PropTypes.bool,
    onClickEdit: PropTypes.func,
  }

  static defaultProps = {
    value: '',
    type: 'text',
    datePicker: false,
    disabledOnClickEdit: false,
    onChange: () => { },
    onClickEdit: () => { },
  }

  componentDidMount = () => {
    this._isMounted = true
  }

  componentDidUpdate = (prevProps, prevState) => {
    if (this.state.isInput && !prevState.isInput) {
      // Just opened input
      this.setInputWidth()
      this.inputRef?.focus?.()
    } else if (!this.state.isInput && prevState.isInput) {
      // Just closed input
      this.props.onChange(this.state.inputValue)
    }

    if (this.state.inputValue !== prevState.inputValue) {
      this.setInputWidth()
      if (this.state.inputValue !== this.props.value) {
        this.props.onChange(this.state.inputValue)
      }
    }

    if (this.props.disabledOnClickEdit && this.props.value !== prevProps.value) {
      this.setState({ inputValue: `${this.props.value}` })
    }
  }

  componentWillUnmount = () => {
    this._isMounted = false
  }

  onInputChange = (e) => {
    if (e?.target) {
      this.setState({ inputValue: `${e.target.value}` })
    }
  }

  onInputFocus = () => {
    this.inputRef?.selectAll()
  }

  onInputBlur = (e) => {
    this.setState({ isInput: false })
  }

  onKeyDown = (e) => {
    if (e.key === 'Enter') {
      this.setState({ isInput: false })
    }
  }

  getInputWidth = () => {
    if (this.inputRef?.inputRef) {
      const input = this.inputRef.inputRef

      let tempElement = document.createElement('span')
      tempElement.innerHTML = this.state.inputValue
      tempElement.style = window.getComputedStyle(input)
      tempElement.style.visibility = 'none'
      tempElement.style.position = 'absolute'
      tempElement.style.whiteSpace = 'pre'

      input.parentElement?.appendChild(tempElement)
      const width = window.getComputedStyle(tempElement)?.getPropertyValue('width')
      input.parentElement?.removeChild(tempElement)
      tempElement = undefined

      const paddingLeft = window.getComputedStyle(input)?.getPropertyValue('padding-left') || '0px'
      const paddingRight = window.getComputedStyle(input)?.getPropertyValue('padding-right') || '0px'
      const borderWidth = '2px'

      const widthCSS = `calc(${width} + ${paddingLeft} + ${paddingRight} + ${borderWidth})`

      return widthCSS
    }
  }

  setInputWidth = () => {
    const inputWidth = this.getInputWidth()
    if (inputWidth !== undefined && this.inputRef.wrapper) {
      this.inputRef.inputRef.style.width = inputWidth
    }
  }

  onDateRangeSelectionApplied = (dateRange, inputText) => {
    this.setState({ inputValue: inputText, isInput: false, dateRange })
  }

  render = () => {
    return (
      <ErrorBoundary>
        <div className='react-auoql-inline-number-editor-wrapper'>
          {this.state.isInput ? (
            <>
              <Input
                id={this.INPUT_ID}
                ref={(r) => (this.inputRef = r)}
                value={this.state.inputValue}
                onChange={this.onInputChange}
                onFocus={this.onInputFocus}
                onBlur={this.onInputBlur}
                onKeyDown={this.onKeyDown}
                type={this.props.type}
                datePicker={this.props.datePicker}
                onDateRangeChange={this.onDateRangeSelectionApplied}
                initialDateRange={this.state.dateRange}
              />
            </>
          ) : (
            <div
              className={`inline-number-input-editor-btn ${this.state.isInput ? 'inline-number-input-editor-btn-active' : ''
                }`}
              onClick={() => {
                this.setState({ isInput: this.props.disabledOnClickEdit ? false : true })
                this.props.onClickEdit()
              }}
            >
              {this.state.inputValue || this.props.value}
            </div>
          )}
        </div>
      </ErrorBoundary>
    )
  }
}
