import React from 'react'
import PropTypes from 'prop-types'
import _isEqual from 'lodash.isequal'
import _get from 'lodash.get'
import _cloneDeep from 'lodash.clonedeep'
import { v4 as uuid } from 'uuid'
import ReactTooltip from 'react-tooltip'

import ErrorBoundary from '../../../containers/ErrorHOC/ErrorHOC'
import { RuleSimple } from '../RuleSimple'
import { Icon } from '../../Icon'

import { authenticationType } from '../../../props/types'
import {
  authenticationDefault,
  getAuthentication,
} from '../../../props/defaults'

import './ExpressionBuilderSimple.scss'

const getInitialStateData = (initialData) => {
  let state = {}
  let expression = undefined
  let expressionError = false

  if (
    Array.isArray(initialData) &&
    _get(initialData, '[0].term_type') === 'query'
  ) {
    // If expression is just 1 set of terms (new format)
    expression = initialData
  } else if (_get(initialData, 'term_value[0].term_type') === 'query') {
    // (deprecated - remove later)
    expression = initialData.term_value
  } else if (_get(initialData, '[0].term_type') === 'group') {
    // Here we will check for legacy data alert formats (deprecated - remove later)
    if (
      _get(initialData.length > 1) ||
      _get(initialData, '[0].term_value.length') > 1
    ) {
      expressionError = true
    } else if (
      _get(initialData, '[0].term_value[0].term_value[0].term_type') === 'query'
    ) {
      expression = _cloneDeep(initialData[0].term_value[0].term_value)
    } else {
      expressionError = true
    }
  }

  state = {
    expression,
    expressionError,
  }

  return state
}

export default class ExpressionBuilderSimple extends React.Component {
  ruleRef = undefined

  static propTypes = {
    authentication: authenticationType,
    expression: PropTypes.oneOfType([PropTypes.shape({}), PropTypes.array]), // This is the expression of the existing notification if you are editing one. I should change the name of this at some point
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
    if (this.state.expressionError) {
      return true // Has error, but marked as complete so it shows warning in UI
    } else if (this.ruleRef) {
      return this.ruleRef.isComplete()
    }
  }

  isValid = () => {
    if (this.state.expressionError) {
      return false
    } else if (this.ruleRef) {
      return this.ruleRef.isValid()
    }
  }

  getJSON = () => {
    let expression
    if (this.ruleRef) {
      expression = this.ruleRef.getJSON()
    }

    return expression
  }

  resetConditions = () => {
    this.setState({ expression: undefined, expressionError: false }, () => {
      this.props.onChange(this.isComplete(), this.isValid(), this.getJSON())
    })
  }

  onRuleUpdate = (id, isComplete) => {
    this.props.onChange(this.isComplete(), this.isValid(), this.getJSON())
  }

  getFirstQuery = (providedTerm) => {
    let term

    if (providedTerm) {
      term = providedTerm
    } else if (this.ruleRef) {
      term = this.ruleRef.getJSON()
    }

    if (!term) {
      return undefined
    }

    if (Array.isArray(term)) {
      term = term[0]
    }

    if (term.term_type === 'group') {
      return this.getFirstQuery(_get(term, 'term_value[0]'))
    } else if (term.term_type === 'query') {
      return term.term_value
    }

    return undefined
  }

  renderExpressionErrorMessage = () => {
    return (
      <div className="expression-error-message">
        <Icon type="warning" warning /> Unable to display conditions. This Data
        Alert may be part of an older system that is no longer supported.{' '}
        <a onClick={this.resetConditions}>Reset Conditions</a>
      </div>
    )
  }

  renderReadOnlyRule = () => {
    return (
      <div
        className={`data-alerts-container ${
          this.props.readOnly ? 'read-only' : ''
        }`}
      >
        {this.state.expressionError ? (
          this.renderExpressionErrorMessage()
        ) : (
          <RuleSimple
            ref={(r) => (this.ruleRef = r)}
            ruleId={_get(this.state.expression, 'id', uuid())}
            onUpdate={this.onRuleUpdate}
            initialData={this.state.expression}
            readOnly={true}
          />
        )}
      </div>
    )
  }

  renderRule = () => {
    return (
      <div
        className={`data-alerts-container ${
          this.props.readOnly ? 'read-only' : ''
        }`}
      >
        <div
          className="notification-rule-outer-container"
          data-test="notification-rules"
        >
          {this.state.expressionError ? (
            this.renderExpressionErrorMessage()
          ) : (
            <RuleSimple
              authentication={getAuthentication(this.props.authentication)}
              ref={(r) => (this.ruleRef = r)}
              ruleId={_get(this.state.expression, 'id', uuid())}
              onUpdate={this.onRuleUpdate}
              initialData={this.state.expression}
            />
          )}
        </div>
      </div>
    )
  }

  render = () => {
    return (
      <ErrorBoundary>
        {this.props.readOnly ? this.renderReadOnlyRule() : this.renderRule()}
        <ReactTooltip
          className="react-autoql-drawer-tooltip"
          id="notification-expression-tooltip"
          effect="solid"
          delayShow={500}
          html
        />
      </ErrorBoundary>
    )
  }
}
