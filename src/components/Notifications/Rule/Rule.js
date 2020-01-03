import React from 'react'
import PropTypes from 'prop-types'

import { Input } from '../../Input'
import { Select } from '../../Select'
import { Icon } from '../../Icon'

import './Rule.scss'

export default class Rule extends React.Component {
  static propTypes = {
    onDelete: PropTypes.func
  }

  static defaultProps = {
    onDelete: () => {}
  }

  state = {
    conditionSelectValue: 'greater-than',
    secondTermType: 'query'
  }

  render = () => {
    let inputType = 'text'
    if (this.state.secondTermType === 'constant') {
      inputType = 'number'
    }

    return (
      <div className="chata-notification-rule-container">
        {' '}
        <Input
          className="chata-rule-input"
          icon="chata-bubbles-outline"
          placeholder="query"
        />
        <Select
          options={[
            { value: 'greater-than', label: '>', tooltip: 'Greater Than' },
            { value: 'less-than', label: '<', tooltip: 'Less Than' },
            { value: 'equals', label: '=', tooltip: 'Equals' },
            { value: 'exists', label: <span>&#8707;</span>, tooltip: 'Exists' }
          ]}
          value={this.state.conditionSelectValue}
          className="chata-rule-condition-select"
          onOptionClick={option => {
            this.setState({ conditionSelectValue: option.value })
          }}
        />
        <div
          className={`chata-rule-second-input-container${
            this.state.conditionSelectValue === 'exists' ? ' hidden' : ''
          }`}
        >
          <Input
            className="chata-rule-input"
            icon="chata-bubbles-outline"
            type={inputType}
            placeholder={inputType === 'number' ? 'constant' : 'query'}
          />
          <Select
            options={[
              {
                value: 'query',
                label: (
                  <Icon
                    type="chata-bubbles-outline"
                    className="rule-input-select-bubbles-icon"
                  />
                ),
                tooltip: 'Query'
              },
              {
                value: 'constant',
                // label: <Icon type="numbers" style={{ fontSize: '20px' }} />
                label: <div style={{ fontSize: '9px' }}>123</div>,
                tooltip: 'Constant'
              }
              // { value: 'equation', label: 'Eq' }
            ]}
            value={this.state.secondTermType}
            className="chata-rule-term-type-selector"
            onOptionClick={option => {
              this.setState({ secondTermType: option.value })
            }}
          />
        </div>
        <Icon
          className="chata-rule-delete-btn"
          type="close"
          onClick={() => this.props.onDelete(this.props.ruleId)}
        />
      </div>
    )
  }
}
