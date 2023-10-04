import React from 'react'
import { v4 as uuid } from 'uuid'
import PropTypes from 'prop-types'

import { Input } from '../Input'
import { ErrorBoundary } from '../../containers/ErrorHOC'

export default class InlineNumberEditor extends React.Component {
  constructor(props) {
    super(props)

    this.ID = uuid()
    this.position = undefined

    this.state = {
      isInput: false,
      inputValue: `${props.value}` ?? '',
    }
  }

  static propTypes = {
    value: PropTypes.string,
    onChange: PropTypes.func,
  }

  static defaultProps = {
    value: '',
    onChange: () => {},
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

      const characterLength = this.state.inputValue?.length
      const paddingLeft = window.getComputedStyle(input)?.getPropertyValue('padding-left') || '0px'
      const paddingRight = window.getComputedStyle(input)?.getPropertyValue('padding-right') || '0px'
      const borderWidth = '2px'

      const widthCSS = `calc(${characterLength}ch + ${paddingLeft} + ${paddingRight} + ${borderWidth})`

      return widthCSS
    }
  }

  setInputWidth = () => {
    const inputWidth = this.getInputWidth()
    if (inputWidth !== undefined && this.inputRef.wrapper) {
      this.inputRef.inputRef.style.width = inputWidth
    }
  }

  render = () => {
    return (
      <ErrorBoundary>
        <div className='react-auoql-inline-number-editor-wrapper'>
          {this.state.isInput ? (
            <Input
              ref={(r) => (this.inputRef = r)}
              value={this.state.inputValue}
              onChange={this.onInputChange}
              onFocus={this.onInputFocus}
              onBlur={this.onInputBlur}
              onKeyDown={this.onKeyDown}
              type='number'
            />
          ) : (
            <div
              className={`inline-number-input-editor-btn ${
                this.state.isInput ? 'inline-number-input-editor-btn-active' : ''
              }`}
              onClick={() => this.setState({ isInput: true })}
            >
              {this.state.inputValue}
            </div>
          )}
        </div>
      </ErrorBoundary>
    )
  }
}
