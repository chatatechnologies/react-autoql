import React from 'react'
import PropTypes from 'prop-types'
import { v4 as uuid } from 'uuid'
import _isEqual from 'lodash.isequal'
import _get from 'lodash.get'

import { Group } from '../Group'
import { Radio } from '../../Radio'
import { Icon } from '../../Icon'
import { Tooltip } from '../../Tooltip'
import ErrorBoundary from '../../../containers/ErrorHOC/ErrorHOC'

import { authenticationType } from '../../../props/types'
import { authenticationDefault, getAuthentication } from '../../../props/defaults'

import './ExpressionBuilder.scss'

const getInitialStateData = (initialData) => {
  let state = {}
  const groups = []

  if (!_get(initialData, 'length')) {
    groups.push({
      id: uuid(),
      isComplete: false,
    })

    state = { groups }
  } else {
    initialData.map((groupItem) => {
      groups.push({
        initialData: groupItem.term_value,
        // We can safely assume that if there is initial data, it is complete
        isComplete: true,
        type: 'group',
        id: groupItem.id,
      })
    })

    state = {
      groups,
      andOrValue: initialData[0].condition === 'OR' ? 'ANY' : 'ALL',
    }
  }
  return state
}

export default class ExpressionBuilder extends React.Component {
  groupRefs = []

  static propTypes = {
    authentication: authenticationType,
    expression: PropTypes.arrayOf(PropTypes.shape({})), // This is the expression of the existing notification if you are editing one. I should change the name of this at some point
    readOnly: PropTypes.bool, // Set this to true if you want a summary of the expression without needing to interact with it
    onChange: PropTypes.func, // this returns 2 params (isSectionComplete, expressionJSON)
  }

  static defaultProps = {
    authentication: authenticationDefault,
    expression: undefined,
    readOnly: false,
    onChange: () => {},
  }

  state = {
    groups: [],
    andOrValue: 'ALL',
    ...getInitialStateData(this.props.expression),
  }

  componentDidMount = () => {
    this.props.onChange(this.isComplete(), this.isValid(), this.getJSON())
  }

  componentDidUpdate = (prevProps, prevState) => {
    if (!_isEqual(prevProps.expression, this.props.expression)) {
      // Recalculate rules on notification data change
      this.setState({ ...getInitialStateData(this.props.expression) })
    }
    if (!_isEqual(prevState, this.state)) {
      this.props.onChange(this.isComplete(), this.isValid(), this.getJSON())
    }
  }

  isComplete = () => {
    const isComplete = this.state.groups.every((group, i) => {
      const groupRef = this.groupRefs[i]
      if (groupRef) {
        return groupRef.isComplete()
      }
      return false
    })

    return isComplete
  }

  isValid = () => {
    if (!this.props.enableQueryValidation) {
      return true
    }

    const isValid = this.state.groups.every((group, i) => {
      const groupRef = this.groupRefs[i]
      if (groupRef) {
        return groupRef.isValid()
      }
      return false
    })

    return isValid
  }

  getJSON = () => {
    return this.state.groups.map((group, i) => {
      let condition = this.state.andOrValue === 'ALL' ? 'AND' : 'OR'
      if (i === this.state.groups.length - 1) {
        condition = 'TERMINATOR'
      }

      const groupRef = this.groupRefs[i]
      let termValue = []
      if (groupRef) {
        termValue = groupRef.getJSON()
      }

      return {
        id: group.id || uuid(),
        term_type: 'group',
        condition,
        term_value: termValue,
      }
    })
  }

  addGroup = ({ initialData, isComplete, id }) => {
    const newId = id || uuid()
    const newGroups = [
      ...this.state.groups,
      {
        initialData,
        isComplete,
        id: newId,
      },
    ]

    this.setState({ groups: newGroups })
  }

  onDeleteGroup = (id) => {
    const newGroups = this.state.groups.filter((group) => group.id !== id)
    this.setState({ groups: newGroups })
  }

  getAndOrValue = () => {
    return this.state.andOrValue
  }

  onGroupUpdate = (id, isComplete) => {
    const newGroups = this.state.groups.map((group) => {
      if (group.id === id) {
        return {
          ...group,
          isComplete,
        }
      }
      return group
    })

    this.setState({ groups: newGroups })
    this.props.onChange(this.isComplete(), this.isValid(), this.getJSON())
  }

  renderReadOnlyRules = () => {
    const hasOnlyOneGroup = this.state.groups.length <= 1

    let conditionText = null
    if (this.state.andOrValue === 'ALL') {
      conditionText = 'AND'
    } else if (this.state.andOrValue === 'ANY') {
      conditionText = 'OR'
    }

    return (
      <div className={`data-alerts-container ${this.props.readOnly ? 'read-only' : ''}`}>
        {!!this.state.groups.length &&
          this.state.groups.map((group, i) => {
            return (
              <div key={`expression-group-readonly-${group.id}-${i}`}>
                <Group
                  ref={(r) => (this.groupRefs[i] = r)}
                  groupId={group.id}
                  disableAddGroupBtn={true}
                  onDelete={this.onDeleteGroup}
                  onUpdate={this.onGroupUpdate}
                  hideTopCondition={i === 0}
                  topCondition={this.state.andOrValue}
                  onlyGroup={hasOnlyOneGroup}
                  initialData={group.initialData}
                  readOnly={this.props.readOnly}
                  enableQueryValidation={false}
                />
                {i !== this.state.groups.length - 1 && (
                  <div style={{ textAlign: 'center', margin: '2px' }}>
                    <span className='read-only-rule-term' style={{ width: '100%' }}>
                      {conditionText}
                    </span>
                  </div>
                )}
              </div>
            )
          })}
      </div>
    )
  }

  renderRules = () => {
    const hasOnlyOneGroup = this.state.groups.length <= 1

    return (
      <div className={`data-alerts-container ${this.props.readOnly ? 'read-only' : ''}`}>
        {!hasOnlyOneGroup && (
          <div className='notification-rule-and-or-select' style={{ marginBottom: '10px' }}>
            Notify me when{' '}
            <Radio
              options={['ALL', 'ANY']}
              value={this.state.andOrValue}
              type='button'
              onChange={(value) => this.setState({ andOrValue: value })}
            />{' '}
            of the following conditions are met:
          </div>
        )}
        <div className='notification-rule-outer-container' data-test='notification-rules'>
          {!!this.state.groups.length &&
            this.state.groups.map((group, i) => {
              return (
                <Group
                  authentication={this.props.authentication}
                  ref={(r) => (this.groupRefs[i] = r)}
                  key={`group-${group.id}-${i}`}
                  groupId={group.id}
                  disableAddGroupBtn={true}
                  onDelete={this.onDeleteGroup}
                  onUpdate={this.onGroupUpdate}
                  hideTopCondition={i === 0}
                  topCondition={this.state.andOrValue}
                  onlyGroup={hasOnlyOneGroup}
                  initialData={group.initialData}
                  readOnly={this.props.readOnly}
                  enableQueryValidation={this.props.enableQueryValidation}
                />
              )
            })}
          {!this.props.readOnly && (
            <div
              className='notification-rule-add-group-btn'
              onClick={this.addGroup}
              data-tip='Add Condition Group'
              data-for='notification-expression-tooltip'
            >
              <Icon type='plus' className='react-autoql-notification-add-icon' />
            </div>
          )}
        </div>
      </div>
    )
  }

  render = () => {
    return (
      <ErrorBoundary>
        {this.props.readOnly ? this.renderReadOnlyRules() : this.renderRules()}
        {!this.props.tooltipID && (
          <Tooltip
            className='react-autoql-tooltip'
            id='notification-expression-tooltip'
            effect='solid'
            delayShow={500}
            html
          />
        )}
      </ErrorBoundary>
    )
  }
}
