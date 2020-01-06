import React from 'react'
import uuid from 'uuid'

import { Button } from '../../Button'
import { Radio } from '../../Radio'
import { Icon } from '../../Icon'
import { Rule } from '../Rule'

import './Group.scss'

export default class Group extends React.Component {
  ID = uuid.v4()

  static propTypes = {}

  static defaultProps = {}

  state = {
    rules: [],
    andOrSelectValue: 'ALL'
  }

  componentDidMount = () => {
    this.setState({
      rules: [{ id: uuid.v4(), rule: <Rule onDelete={this.onDeleteRule} /> }]
    })
  }

  onDeleteRule = id => {
    console.log('on delete rule')
    console.log('id:')
    console.log(id)

    console.log('rule list')
    console.log(this.state.rules)
    const newRules = this.state.rules.filter(rule => rule.id !== id)
    this.setState({ rules: newRules })
  }

  onAddRule = () => {
    const newId = uuid.v4()
    const newRules = [
      ...this.state.rules,
      { id: newId, rule: <Rule ruleId={newId} onDelete={this.onDeleteRule} /> }
    ]
    this.setState({ rules: newRules })
  }

  onAddGroup = () => {
    const newId = uuid.v4()
    const newRules = [
      ...this.state.rules,
      {
        id: newId,
        rule: <Group groupId={newId} onDelete={this.onDeleteRule} />
      }
    ]
    this.setState({ rules: newRules })
  }

  renderAllAnySelect = () => {
    return (
      <div className="notification-rule-and-or-select">
        Match{' '}
        <Radio
          options={['ALL', 'ANY']}
          value={this.state.andOrSelectValue}
          onChange={value => this.setState({ andOrSelectValue: value })}
        />{' '}
        condition(s)
      </div>
    )
  }

  renderDeleteBtn = () => {
    if (this.props.groupId === 'first-group') {
      return null
    }

    return (
      <div className="chata-notification-group-delete-btn">
        <Icon
          type="close-circle"
          onClick={() => this.props.onDelete(this.props.groupId)}
        />
      </div>
    )
  }

  renderAddButtons = () => {
    return (
      <div className="notification-rule-btn-container">
        <Button className="notification-rule-add-btn" onClick={this.onAddRule}>
          + Add New Rule
        </Button>
        <Button className="notification-rule-add-btn" onClick={this.onAddGroup}>
          + Add New Group
        </Button>
      </div>
    )
  }

  render = () => {
    return (
      <div
        className="chata-notification-group-container"
        data-test="rule-group"
      >
        {this.state.rules.map(rule => {
          return rule.rule
        })}
        {this.renderAllAnySelect()}
        {this.renderDeleteBtn()}
        {this.renderAddButtons()}
      </div>
    )
  }
}
