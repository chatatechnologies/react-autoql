import React from 'react'
import PropTypes from 'prop-types'
import uuid from 'uuid'

import './Checkbox.scss'

export default class Checkbox extends React.Component {
  ID = uuid.v4()

  static propTypes = {
    hasError: PropTypes.bool,
    indeterminate: PropTypes.bool,
    label: PropTypes.string,
    type: PropTypes.oneOf(['default', 'switch']),
    checked: PropTypes.bool,
    onChange: PropTypes.func
  }

  static defaultProps = {
    hasError: false,
    indeterminate: undefined,
    type: 'default',
    label: '',
    checked: false,
    onChange: () => {}
  }

  componentDidMount = () => {
    // Apply the indeterminate attribute of the checkbox input
    this.selector.indeterminate = this.props.indeterminate
  }

  componentDidUpdate = prevProps => {
    if (prevProps.indeterminate !== this.props.indeterminate) {
      this.selector.indeterminate = this.props.indeterminate
    }
  }

  onCheckedChange = e => {
    this.props.onChange(e)
    // this.setState({ checked: e.target.checked })
  }

  render = () => {
    const { label, type, indeterminate, hasError, ...inputProps } = this.props

    const checkboxClassname = `
      chata-checkbox
      ${type === 'switch' && 'chata-checkbox--switch'}
      ${hasError && 'chata-checkbox--has-error'}
    `

    const inputClassname = `
      chata-checkbox__input
      ${type === 'switch' && 'chata-checkbox--switch__input'}
      ${hasError && 'chata-checkbox--has-error__input'}
    `

    const labelClassname = `
      chata-checkbox__label
      ${type === 'switch' && 'chata-checkbox--switch__label'}
    `

    return (
      <div style={{ display: 'inline-block' }}>
        {
          //   // <label>
          // <div style={{ display: 'inline-block', verticalAlign: 'middle' }}>
          //   <input
          //     type="checkbox"
          //     style={{
          //       border: 0,
          //       clip: 'rect(0 0 0 0)',
          //       clippath: 'inset(50%)',
          //       height: '1px',
          //       margin: '-1px',
          //       overflow: 'hidden',
          //       padding: 0,
          //       position: 'absolute',
          //       whiteSpace: 'nowrap',
          //       width: '1px'
          //     }}
          //     {...this.props}
          //     checked={this.props.checked}
          //   />
          //   <div
          //     style={{
          //       display: 'inline-block',
          //       width: '16px',
          //       height: '16px',
          //       background: this.props.checked ? 'salmon' : 'papayawhip',
          //       borderRadius: '3px',
          //       transition: 'all 150ms'
          //     }}
          //   >
          //     <svg viewBox="0 0 24 24">
          //       <polyline points="20 6 9 17 4 12" />
          //     </svg>
          //   </div>
          // </div>
          // {
          //   // <span>Label Text</span>
          //   // </label>
          // }
          <div className={`${checkboxClassname} ${this.props.className}`}>
            <input
              {...inputProps}
              type="checkbox"
              className={inputClassname}
              ref={el => (this.selector = el)}
              id={this.ID}
              checked={this.props.checked}
              onChange={this.onCheckedChange}
            />
            {label && (
              // <label className={labelClassname} htmlFor={this.ID}>
              //   {label}
              // </label>
              <div className="chata-checkbox-label">{label}</div>
            )}
          </div>
        }
      </div>
    )
  }
}
