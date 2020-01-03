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
    conditionSelectValue: 'greater-than'
  }

  render = () => {
    return (
      <div className="chata-notification-rule-container">
        {' '}
        <Input className="chata-rule-input" icon="chata-bubbles-outline" />
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
        <Input
          className={`chata-rule-input${
            this.state.conditionSelectValue === 'exists' ? ' hidden' : ''
          }`}
          icon="chata-bubbles-outline"
        />
        <Icon
          className="chata-rule-delete-btn"
          type="close"
          onClick={() => this.props.onDelete(this.props.ruleId)}
        />
      </div>
    )
  }
}
