import React, { Fragment } from 'react'
import PropTypes from 'prop-types'
import uuid from 'uuid'
import isEqual from 'lodash.isequal'
import _get from 'lodash.get'

import { Group } from '../GroupCopy'
import { Button } from '../../Button'
import { Radio } from '../../Radio'
import { Icon } from '../../Icon'

import './NotificationRules.scss'

const getInitialStateData = initialData => {
  let state = {}
  const groups = []

  if (!_get(initialData, 'length')) {
    groups.push({
      id: uuid.v4(),
      isComplete: false,
    })

    state = { groups }
  } else {
    initialData.map(groupItem => {
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

export default class NotificationRules extends React.Component {
  groupRefs = []

  static propTypes = {
    onUpdate: PropTypes.func,
    readOnly: PropTypes.bool,
  }

  static defaultProps = {
    onUpdate: () => {},
    readOnly: false,
  }

  state = {
    groups: [],
    andOrValue: 'ALL',
    ...getInitialStateData(this.props.notificationData),
  }

  componentDidMount = () => {
    this.props.onUpdate(this.isComplete(), this.getJSON())
  }

  componentDidUpdate = (prevProps, prevState) => {
    if (!isEqual(prevProps.notificationData, this.props.notificationData)) {
      // Recalculate rules on notification data change
      this.setState({ ...getInitialStateData(this.props.notificationData) })
    }
    if (!isEqual(prevState, this.state)) {
      this.props.onUpdate(this.isComplete(), this.getJSON())
    }
  }

  isComplete = () => {
    return (
      this.state.groups.length &&
      !this.state.groups.find(group => !group.isComplete)
    )
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
        id: group.id || uuid.v4(),
        term_type: 'group',
        condition,
        term_value: termValue,
      }
    })
  }

  validateLogic = () => {}

  addGroup = ({ initialData, isComplete, id }) => {
    const newId = id || uuid.v4()
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

  onDeleteGroup = id => {
    const newGroups = this.state.groups.filter(group => group.id !== id)
    this.setState({ groups: newGroups })
  }

  getAndOrValue = () => {
    return this.state.andOrValue
  }

  onGroupUpdate = (id, isComplete) => {
    const newGroups = this.state.groups.map(group => {
      if (group.id === id) {
        return {
          ...group,
          isComplete,
        }
      }
      return group
    })

    this.setState({ groups: newGroups })
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
      <div
        className={`notification-rules-container ${
          this.props.readOnly ? 'read-only' : ''
        }`}
      >
        {!!this.state.groups.length &&
          this.state.groups.map((group, i) => {
            return (
              <Fragment>
                <Group
                  ref={r => (this.groupRefs[i] = r)}
                  key={group.id}
                  groupId={group.id}
                  disableAddGroupBtn={true}
                  onDelete={this.onDeleteGroup}
                  onUpdate={this.onGroupUpdate}
                  hideTopCondition={i === 0}
                  topCondition={this.state.andOrValue}
                  onlyGroup={hasOnlyOneGroup}
                  initialData={group.initialData}
                  readOnly={this.props.readOnly}
                />
                {i !== this.state.groups.length - 1 && (
                  <div style={{ textAlign: 'center', margin: '2px' }}>
                    <span
                      className="read-only-rule-term"
                      style={{ width: '100%' }}
                    >
                      {conditionText}
                    </span>
                  </div>
                )}
              </Fragment>
            )
          })}
      </div>
    )
  }

  renderRules = () => {
    const hasOnlyOneGroup = this.state.groups.length <= 1

    return (
      <div
        className={`notification-rules-container ${
          this.props.readOnly ? 'read-only' : ''
        }`}
      >
        {!hasOnlyOneGroup && (
          <div
            className="notification-rule-and-or-select"
            style={{ marginBottom: '10px' }}
          >
            Match{' '}
            <Radio
              options={['ALL', 'ANY']}
              value={this.state.andOrValue}
              onChange={value => this.setState({ andOrValue: value })}
            />{' '}
            of the following:
          </div>
        )}
        <div
          className="notification-rule-outer-container"
          data-test="notification-rules"
        >
          {!!this.state.groups.length &&
            this.state.groups.map((group, i) => {
              return (
                <Group
                  ref={r => (this.groupRefs[i] = r)}
                  key={group.id}
                  groupId={group.id}
                  disableAddGroupBtn={true}
                  onDelete={this.onDeleteGroup}
                  onUpdate={this.onGroupUpdate}
                  hideTopCondition={i === 0}
                  topCondition={this.state.andOrValue}
                  onlyGroup={hasOnlyOneGroup}
                  initialData={group.initialData}
                  readOnly={this.props.readOnly}
                />
              )
            })}
          {!this.props.readOnly && (
            <div className="notification-first-group-btn-container">
              <Button
                className="notification-rule-add-btn-outer"
                onClick={this.addGroup}
              >
                <Icon type="plus" /> Add Condition Group
              </Button>
            </div>
          )}
        </div>
      </div>
    )
  }

  render = () => {
    if (this.props.readOnly) {
      return this.renderReadOnlyRules()
    }
    return this.renderRules()
  }
}
