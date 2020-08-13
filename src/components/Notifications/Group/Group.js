import React, { Fragment } from 'react'
import PropTypes from 'prop-types'
import uuid from 'uuid'

import { Radio } from '../../Radio'
import { Icon } from '../../Icon'
import { Rule } from '../Rule'

import './Group.scss'

const isGroup = (termValue) => {
  return (
    termValue[0] &&
    (termValue[0].condition === 'AND' ||
      termValue[0].condition === 'OR' ||
      termValue[0].condition === 'TERMINATOR')
  )
}

const getInitialStateData = (initialData) => {
  let state = {}
  const rules = []
  if (!initialData || !initialData.length) {
    rules.push({
      id: uuid.v4(),
      type: 'rule',
      isComplete: false,
    })
    state = { rules }
  } else {
    initialData.forEach((rule) => {
      const id = rule.id || uuid.v4()
      rules.push({
        id,
        type: isGroup(rule.term_value) ? 'group' : 'rule',
        isComplete: true,
        termValue: rule.term_value || [],
      })
    })

    state = {
      rules,
      andOrSelectValue: initialData[0].condition === 'OR' ? 'ANY' : 'ALL',
    }
  }

  return state
}

export default class Group extends React.Component {
  ID = uuid.v4()
  ruleRefs = []

  static propTypes = {
    groupId: PropTypes.string,
    onDelete: PropTypes.func,
    onUpdate: PropTypes.func,
    disableAddGroupBtn: PropTypes.bool,
    hideTopCondition: PropTypes.bool,
    readOnly: PropTypes.bool,
  }

  static defaultProps = {
    groupId: undefined,
    disableAddGroupBtn: false,
    hideTopCondition: false,
    readOnly: false,
    onDelete: () => {},
    onUpdate: () => {},
  }

  state = {
    rules: [],
    andOrSelectValue: 'ALL',
    ...getInitialStateData(this.props.initialData),
  }

  componentDidMount = () => {
    this.props.onUpdate(this.props.groupId, this.isComplete())
  }

  getJSON = () => {
    return this.state.rules.map((rule, i) => {
      let condition = this.state.andOrSelectValue === 'ALL' ? 'AND' : 'OR'
      if (i === this.state.rules.length - 1) {
        condition = 'TERMINATOR'
      }

      const ruleRef = this.ruleRefs[i]
      let termValue = []
      if (ruleRef) {
        termValue = ruleRef.getJSON()
      }

      return {
        id: rule.id || uuid.v4(),
        term_type: 'group',
        condition,
        term_value: termValue,
      }
    })
  }

  isComplete = () => {
    // If we can find one rule that is not complete, then the whole group is incomplete
    const isComplete = this.state.rules.every((rule, i) => {
      const ruleRef = this.ruleRefs[i]
      if (ruleRef) {
        return ruleRef.isComplete()
      }
      return false
    })

    return isComplete
  }

  deleteRuleOrGroup = (id) => {
    const newRules = this.state.rules.filter((rule) => rule.id !== id)
    this.setState({ rules: newRules })
  }

  onRuleUpdate = (id, isComplete, termValue) => {
    const newRules = this.state.rules.map((rule) => {
      if (rule.id === id) {
        return {
          ...rule,
          isComplete,
          termValue,
        }
      }
      return rule
    })

    this.setState({ rules: newRules })
    this.props.onUpdate(this.props.groupId, this.isComplete())
  }

  addRule = () => {
    const newId = uuid.v4()
    const newRules = [
      ...this.state.rules,
      {
        id: newId,
        type: 'rule',
        isComplete: false,
      },
    ]

    this.setState({ rules: newRules })
  }

  addGroup = () => {
    const newId = uuid.v4()
    const newRules = [
      ...this.state.rules,
      {
        id: newId,
        type: 'group',
        isComplete: false,
      },
    ]

    this.setState({ rules: newRules })
  }

  shouldDisableRuleDeleteBtn = () => {
    const rulesOnly = this.state.rules.filter((rule) => rule.type === 'rule')
    return rulesOnly.length <= 1
  }

  renderAllAnySelect = () => {
    // if (this.props.readOnly) {
    //   return null
    // }

    return (
      <div className="notification-rule-and-or-select">
        Match{' '}
        <Radio
          options={['ALL', 'ANY']}
          value={this.state.andOrSelectValue}
          onChange={(value) => this.setState({ andOrSelectValue: value })}
          // outlined
        />{' '}
        conditions
      </div>
    )
  }

  renderDeleteGroupBtn = () => {
    if (this.props.readOnly) {
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

  // renderAddBtn = () => {
  //   return (
  //     <div className="chata-notification-group-add-btn" onClick={this.addRule}>
  //       <Icon type="plus" />
  //     </div>
  //   )
  // }

  renderAddBtn = () => {
    if (this.props.readOnly) {
      return null
    }

    return (
      <div className="notification-rule-btn-container">
        <div className="chata-notification-rule-add-btn" onClick={this.addRule}>
          <Icon type="plus" className="chata-notification-add-icon" />
        </div>
      </div>
    )
  }

  renderGroup = () => {
    const hasOnlyOneRule =
      this.state.rules.filter((rule) => rule.type === 'rule').length <= 1

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
              height: this.props.hideTopCondition
                ? '100%'
                : 'calc(100% + 19px)',
            }}
          >
            {!this.props.hideTopCondition && (
              <div
                className="notification-and-or-text"
                style={{
                  background:
                    this.props.topCondition === 'ALL' ? '#bae9ff' : '#fffaca',
                  border:
                    this.props.topCondition === 'ALL'
                      ? '1px solid rgb(144, 221, 255)'
                      : '1px solid #FFEB3B',
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
          {this.state.rules.map((rule, i) => {
            if (rule.type === 'rule') {
              return (
                <Rule
                  ref={(r) => (this.ruleRefs[i] = r)}
                  ruleId={rule.id}
                  key={rule.id}
                  initialData={rule.termValue}
                  onDelete={() => this.deleteRuleOrGroup(rule.id)}
                  onUpdate={this.onRuleUpdate}
                  onAdd={this.addRule}
                  readOnly={this.props.readOnly}
                />
              )
            } else if (rule.type === 'group') {
              return (
                <Group
                  groupId={rule.id}
                  key={rule.id}
                  initialData={rule.termValue}
                  onDelete={() => this.deleteRuleOrGroup(rule.id)}
                  readOnly={this.props.readOnly}
                />
              )
            }
          })}
          {this.renderAllAnySelect()}
          {this.renderDeleteGroupBtn()}
          {this.renderAddBtn()}
        </div>
      </div>
    )
  }

  renderReadOnlyGroup = () => {
    const hasOnlyOneRule =
      this.state.rules.filter((rule) => rule.type === 'rule').length <= 1

    let conditionText = null
    if (this.state.andOrSelectValue === 'ALL') {
      conditionText = 'AND'
    } else if (this.state.andOrSelectValue === 'ANY') {
      conditionText = 'OR'
    }

    return (
      <div
        className={`notification-read-only-group ${
          hasOnlyOneRule ? ' no-border' : ''
        }`}
      >
        {this.state.rules.map((rule, i) => {
          if (rule.type === 'rule') {
            return (
              <Rule
                key={`rule-readonly-${rule.id}`}
                ref={(r) => (this.ruleRefs[i] = r)}
                ruleId={rule.id}
                initialData={rule.termValue}
                andOrValue={
                  i !== this.state.rules.length - 1 ? conditionText : null
                }
                readOnly
              />
            )
          } else if (rule.type === 'group') {
            return (
              <div key={`group-${rule.id}`}>
                <Group
                  groupId={rule.id}
                  initialData={rule.termValue}
                  readOnly
                />
                {i !== this.state.rules.length - 1 && (
                  <div>
                    <span className="read-only-rule-term">{conditionText}</span>
                  </div>
                )}
              </div>
            )
          }
        })}
      </div>
    )
  }

  render = () => {
    if (this.props.readOnly) {
      return this.renderReadOnlyGroup()
    }
    return this.renderGroup()
  }
}
