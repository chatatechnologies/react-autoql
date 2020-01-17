import React, { Fragment } from 'react'
import PropTypes from 'prop-types'
import uuid from 'uuid'
import isEqual from 'lodash.isequal'

import { Group } from '../GroupCopy'
import { Button } from '../../Button'
import { Radio } from '../../Radio'
import { Icon } from '../../Icon'

import './NotificationRules.scss'

export default class NotificationRules extends React.Component {
  static propTypes = {
    onUpdate: PropTypes.func
  }

  static defaultProps = {
    onUpdate: () => {}
  }

  state = {
    groups: [],
    andOrValue: 'ALL'
  }

  componentDidMount = () => {
    this.onAddGroup(undefined, true)
  }

  componentDidUpdate = (prevProps, prevState) => {
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

      return {
        term_type: 'group',
        condition,
        term_value: group.groupJSON
      }
    })
  }

  onAddGroup = (e, hideTopCondition) => {
    const newId = uuid.v4()
    const newGroups = [
      ...this.state.groups,
      {
        id: newId,
        isComplete: false,
        groupJSON: {}
        // element: (
        //   <Group
        //     groupId={newId}
        //     disableAddGroupBtn={true}
        //     onDelete={this.onDeleteGroup}
        //     hideTopCondition={!!hideTopCondition}
        //     getTopCondition={this.getAndOrValue}
        //     // onAdd={this.onAddGroup}
        //   />
        // )
      }
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

  onGroupUpdate = (id, isComplete, groupJSON) => {
    const newGroups = this.state.groups.map(group => {
      if (group.id === id) {
        return {
          ...group,
          isComplete,
          groupJSON
        }
      }
      return group
    })

    this.setState({ groups: newGroups })
  }

  render = () => {
    const hasOnlyOneGroup = this.state.groups.length <= 1

    return (
      <Fragment>
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
          // className={`notification-rule-outer-container${
          //   this.state.groups.length > 1 ? ' outlined' : ''
          // }`}
          className="notification-rule-outer-container"
          data-test="notification-rules"
        >
          {
            //   this.state.groups.length > 1 && (
            //   <div className="notification-outer-all-any">
            //     ALL/ANY FOR OUTER GROUP
            //   </div>
            // )
          }
          {
            // <div className="notification-rules-container">
            // </div>
          }
          {this.state.groups.map((group, i) => {
            return (
              <Group
                key={group.id}
                groupId={group.id}
                disableAddGroupBtn={true}
                onDelete={this.onDeleteGroup}
                onUpdate={this.onGroupUpdate}
                hideTopCondition={i === 0}
                // getTopCondition={this.getAndOrValue}
                // onAdd={this.onAddGroup}
                topCondition={this.state.andOrValue}
                onlyGroup={hasOnlyOneGroup}
              />
            )
          })}
          <span>
            <Button
              className="notification-rule-add-btn-outer"
              onClick={this.onAddGroup}
            >
              <Icon type="plus" /> Add Condition Group
            </Button>
          </span>
        </div>
      </Fragment>
    )
  }
}
