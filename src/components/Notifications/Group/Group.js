import React from 'react'
import { v4 as uuid } from 'uuid'
import PropTypes from 'prop-types'
import { authenticationDefault } from 'autoql-fe-utils'

import { Rule } from '../Rule'
import { Icon } from '../../Icon'
import { Radio } from '../../Radio'
import ErrorBoundary from '../../../containers/ErrorHOC/ErrorHOC'

import { authenticationType } from '../../../props/types'

import './Group.scss'

const isGroup = (termValue) => {
  return (
    termValue[0] &&
    (termValue[0].condition === 'AND' || termValue[0].condition === 'OR' || termValue[0].condition === 'TERMINATOR')
  )
}

const getInitialStateData = (initialData) => {
  let state = {}
  const rules = []
  if (!initialData || !initialData.length) {
    rules.push({
      id: uuid(),
      type: 'rule',
      isComplete: false,
    })
    state = { rules }
  } else {
    initialData.forEach((rule) => {
      const id = rule.id || uuid()
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
  ID = uuid()
  ruleRefs = []

  static propTypes = {
    authentication: authenticationType,
    groupId: PropTypes.string,
    onDelete: PropTypes.func,
    onUpdate: PropTypes.func,
    disableAddGroupBtn: PropTypes.bool,
    hideTopCondition: PropTypes.bool,
    readOnly: PropTypes.bool,
    enableQueryValidation: PropTypes.bool,
  }

  static defaultProps = {
    authentication: authenticationDefault,
    groupId: undefined,
    disableAddGroupBtn: false,
    hideTopCondition: false,
    readOnly: false,
    onDelete: () => {},
    onUpdate: () => {},
    enableQueryValidation: true,
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
        id: rule.id || uuid(),
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

  isValid = () => {
    if (!this.props.enableQueryValidation) {
      return true
    }

    // If we can find one rule that is not valid, then the whole group is invalid
    const isValid = this.state.rules.every((rule, i) => {
      const ruleRef = this.ruleRefs[i]
      if (ruleRef) {
        return ruleRef.isValid()
      }
      return false
    })

    return isValid
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
    const newId = uuid()
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
    const newId = uuid()
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
    return (
      <div className='notification-rule-and-or-select'>
        Notify me when{' '}
        <Radio
          options={['ALL', 'ANY']}
          value={this.state.andOrSelectValue}
          type='button'
          onChange={(value) => this.setState({ andOrSelectValue: value })}
        />{' '}
        of the following conditions are met:
      </div>
    )
  }

  renderDeleteGroupBtn = () => {
    if (this.props.readOnly || this.props.onlyGroup) {
      return null
    }

    return (
      <div
        className='react-autoql-notification-group-delete-btn'
        onClick={() => this.props.onDelete(this.props.groupId)}
      >
        <Icon type='close' data-tip='Remove Condition Group' data-for='notification-expression-tooltip' />
      </div>
    )
  }

  renderAddBtn = () => {
    if (this.props.readOnly) {
      return null
    }

    return (
      <div className='notification-rule-btn-container'>
        <div className='react-autoql-notification-rule-add-btn' onClick={this.addRule}>
          <Icon
            type='plus'
            className='react-autoql-notification-add-icon'
            data-tip='Add Condition'
            data-for='notification-expression-tooltip'
          />
        </div>
      </div>
    )
  }

  renderGroup = () => {
    const hasOnlyOneRule = this.state.rules.filter((rule) => rule.type === 'rule').length <= 1

    return (
      <ErrorBoundary>
        <div className='notification-group-wrapper' style={{ marginLeft: this.props.onlyGroup ? '0px' : '50px' }}>
          {!this.props.onlyGroup && (
            <div
              className='notification-and-or-break'
              style={{
                top: this.props.hideTopCondition ? '0px' : '-19px',
                height: this.props.hideTopCondition ? '100%' : 'calc(100% + 19px)',
              }}
            >
              {!this.props.hideTopCondition && (
                <div
                  className='notification-and-or-text'
                  style={{
                    background: this.props.topCondition === 'ALL' ? '#bae9ff' : '#fffaca',
                    border: this.props.topCondition === 'ALL' ? '1px solid rgb(144, 221, 255)' : '1px solid #FFEB3B',
                  }}
                >
                  {this.props.topCondition === 'ALL' ? 'AND' : 'OR'}
                </div>
              )}
            </div>
          )}
          <div
            className={`react-autoql-notification-group-container${hasOnlyOneRule ? ' disable-first-delete' : ''}`}
            data-test='rule-group'
          >
            {this.state.rules.map((rule, i) => {
              if (rule.type === 'rule') {
                return (
                  <Rule
                    authentication={this.props.authentication}
                    ref={(r) => (this.ruleRefs[i] = r)}
                    ruleId={rule.id}
                    key={rule.id}
                    initialData={rule.termValue}
                    onDelete={() => this.deleteRuleOrGroup(rule.id)}
                    onUpdate={this.onRuleUpdate}
                    onAdd={this.addRule}
                    readOnly={this.props.readOnly}
                    enableQueryValidation={this.props.enableQueryValidation}
                  />
                )
              } else if (rule.type === 'group') {
                return (
                  <Group
                    authentication={this.props.authentication}
                    groupId={rule.id}
                    key={rule.id}
                    initialData={rule.termValue}
                    onDelete={() => this.deleteRuleOrGroup(rule.id)}
                    readOnly={this.props.readOnly}
                    enableQueryValidation={this.props.enableQueryValidation}
                  />
                )
              }
            })}
            {this.renderAllAnySelect()}
            {this.renderDeleteGroupBtn()}
            {this.renderAddBtn()}
          </div>
        </div>
      </ErrorBoundary>
    )
  }

  renderReadOnlyGroup = () => {
    const hasOnlyOneRule = this.state.rules.filter((rule) => rule.type === 'rule').length <= 1

    let conditionText = null
    if (this.state.andOrSelectValue === 'ALL') {
      conditionText = 'AND'
    } else if (this.state.andOrSelectValue === 'ANY') {
      conditionText = 'OR'
    }

    return (
      <ErrorBoundary>
        <div className={`notification-read-only-group ${hasOnlyOneRule ? ' no-border' : ''}`}>
          {this.state.rules.map((rule, i) => {
            if (rule.type === 'rule') {
              return (
                <Rule
                  key={`rule-readonly-${rule.id}`}
                  ref={(r) => (this.ruleRefs[i] = r)}
                  ruleId={rule.id}
                  initialData={rule.termValue}
                  andOrValue={i !== this.state.rules.length - 1 ? conditionText : null}
                  enableQueryValidation={false}
                  readOnly
                />
              )
            } else if (rule.type === 'group') {
              return (
                <div key={`group-${rule.id}`}>
                  <Group
                    authentication={this.props.authentication}
                    groupId={rule.id}
                    initialData={rule.termValue}
                    enableQueryValidation={false}
                    readOnly
                  />
                  {i !== this.state.rules.length - 1 && (
                    <div>
                      <span className='read-only-rule-term'>{conditionText}</span>
                    </div>
                  )}
                </div>
              )
            }
          })}
        </div>
      </ErrorBoundary>
    )
  }

  render = () => {
    if (this.props.readOnly) {
      return this.renderReadOnlyGroup()
    }
    return this.renderGroup()
  }
}
