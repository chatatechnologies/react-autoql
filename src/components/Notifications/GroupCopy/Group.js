import React from 'react'
import PropTypes from 'prop-types'
import uuid from 'uuid'

import { Button } from '../../Button'
import { Radio } from '../../Radio'
import { Icon } from '../../Icon'
import { Rule } from '../Rule'

import './Group.scss'

export default class Group extends React.Component {
  ID = uuid.v4()

  static propTypes = {
    groupId: PropTypes.string.isRequired,
    onDelete: PropTypes.func,
    disableAddGroupBtn: PropTypes.bool,
    hideTopCondition: PropTypes.bool
  }

  static defaultProps = {
    disableAddGroupBtn: false,
    hideTopCondition: false,
    onDelete: () => {}
  }

  state = {
    rules: [],
    andOrSelectValue: 'ALL'
  }

  componentDidMount = () => {
    // Populate first rule in the group
    this.addRule()
  }

  deleteRuleOrGroup = id => {
    const newRules = this.state.rules.filter(rule => rule.id !== id)
    this.setState({ rules: newRules })
  }

  addRule = () => {
    const newId = uuid.v4()
    const newRules = [
      ...this.state.rules,
      {
        id: newId,
        type: 'rule',
        rule: (
          <Rule
            ruleId={newId}
            key={newId}
            onDelete={() => this.deleteRuleOrGroup(newId)}
            onAdd={this.addRule}
          />
        )
      }
    ]
    this.setState({ rules: newRules })
  }

  onAddGroup = () => {
    const newId = uuid.v4()
    const newRules = [
      ...this.state.rules,
      {
        id: newId,
        type: 'group',
        rule: (
          <Group
            key={newId}
            groupId={newId}
            onDelete={() => this.deleteRuleOrGroup(newId)}
          />
        )
      }
    ]
    this.setState({ rules: newRules })
  }

  shouldDisableRuleDeleteBtn = () => {
    const rulesOnly = this.state.rules.filter(rule => rule.type === 'rule')
    return rulesOnly.length <= 1
  }

  renderAllAnySelect = () => {
    return (
      <div className="notification-rule-and-or-select">
        Match{' '}
        <Radio
          options={['ALL', 'ANY']}
          value={this.state.andOrSelectValue}
          onChange={value => this.setState({ andOrSelectValue: value })}
          // outlined
        />{' '}
        condition(s)
      </div>
    )
  }

  renderDeleteGroupBtn = () => {
    if (this.props.groupId === 'first-group') {
      return null
    }

    return (
      <div
        className="chata-notification-group-delete-btn"
        onClick={() => this.props.onDelete(this.props.groupId)}
      >
        <Icon type="close" />
      </div>
    )
  }

  renderAddBtn = () => {
    return (
      <div className="chata-notification-group-add-btn" onClick={this.addRule}>
        <Icon type="plus" />
      </div>
    )
  }

  renderAddBtn = () => {
    return (
      <div className="notification-rule-btn-container">
        <div className="chata-notification-rule-add-btn" onClick={this.addRule}>
          <Icon type="plus" className="chata-notification-add-icon" />
        </div>
      </div>
    )
  }

  render = () => {
    const hasOnlyOneRule =
      this.state.rules.filter(rule => rule.type === 'rule').length <= 1

    return (
      <div
        className="notification-group-wrapper"
        style={{ marginLeft: this.props.onlyGroup ? '0px' : '50px' }}
      >
        {!this.props.onlyGroup && (
          <div
            className="notification-and-or-break"
            style={{
              top: this.props.hideTopCondition ? '0px' : '-19px',
              height: this.props.hideTopCondition ? '100%' : 'calc(100% + 19px)'
            }}
          >
            {!this.props.hideTopCondition && (
              <div
                className="notification-and-or-text"
                style={{
                  background:
                    this.props.topCondition === 'ALL' ? '#bae9ff' : '#ffe5a7'
                }}
              >
                {this.props.topCondition === 'ALL' ? 'AND' : 'OR'}
              </div>
            )}
          </div>
        )}
        <div
          className={`chata-notification-group-container-copy${
            hasOnlyOneRule ? ' disable-first-delete' : ''
          }`}
          data-test="rule-group"
        >
          {this.state.rules.map(rule => {
            return rule.rule
          })}
          {this.renderAllAnySelect()}
          {this.renderDeleteGroupBtn()}
          {this.renderAddBtn()}
        </div>
      </div>
    )
  }
}
