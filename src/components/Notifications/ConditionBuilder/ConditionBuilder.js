import React from 'react'
import PropTypes from 'prop-types'
import _isEqual from 'lodash.isequal'
import _cloneDeep from 'lodash.clonedeep'
import { v4 as uuid } from 'uuid'

import { ErrorBoundary } from '../../../containers/ErrorHOC'
import { RuleSimple } from '../RuleSimple'
import { Icon } from '../../Icon'

import { authenticationType } from '../../../props/types'
import { authenticationDefault } from '../../../props/defaults'
import { GROUP_TERM_TYPE, QUERY_TERM_TYPE } from '../DataAlertConstants'

import './ConditionBuilder.scss'

export default class ConditionBuilder extends React.Component {
  constructor(props) {
    super(props)

    this.ruleRef = undefined

    this.state = this.getInitialState(props)
  }

  static propTypes = {
    authentication: authenticationType,
    expression: PropTypes.oneOfType([PropTypes.shape({}), PropTypes.array]), // This is the expression of the existing notification if you are editing one. I should change the name of this at some point
    conditionStatementOnly: PropTypes.bool, // Set this to true if you want a summary of the expression without needing to interact with it
    onChange: PropTypes.func, // this returns 2 params (isSectionComplete, expressionJSON)
    onLastInputEnterPress: PropTypes.func,
  }

  static defaultProps = {
    authentication: authenticationDefault,
    expression: undefined,
    conditionStatementOnly: false,
    onChange: () => {},
    onLastInputEnterPress: () => {},
  }

  componentDidMount = () => {
    this._isMounted = true
    this.props.onChange(this.isComplete(), this.isValid(), this.getJSON())
  }

  componentDidUpdate = (prevProps, prevState) => {
    if (!_isEqual(prevState, this.state)) {
      this.props.onChange(this.isComplete(), this.isValid(), this.getJSON())
    }
  }

  componentWillUnmount = () => {
    this._isMounted = false
  }

  getInitialState = (initialProps) => {
    const props = initialProps ?? this.props
    const initialExpression = props.expression

    let state = {}
    let expression = undefined
    let expressionError = false

    if (Array.isArray(initialExpression) && initialExpression?.[0]?.term_type === QUERY_TERM_TYPE) {
      // If expression is just 1 set of terms (new format)
      expression = initialExpression
    } else if (initialExpression?.term_value?.[0]?.term_type === QUERY_TERM_TYPE) {
      // (deprecated - remove later)
      expression = initialExpression.term_value
    } else if (initialExpression?.[0]?.term_type === GROUP_TERM_TYPE) {
      // Here we will check for legacy data alert formats (deprecated - remove later)
      if (initialExpression?.length > 1 || initialExpression?.[0]?.term_value?.length > 1) {
        expressionError = true
      } else if (initialExpression?.[0]?.term_value?.[0]?.term_value?.[0]?.term_type === QUERY_TERM_TYPE) {
        expression = _cloneDeep(initialExpression[0].term_value[0].term_value)
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

  getConditionStatement = (tense) => {
    if (this.ruleRef) {
      return this.ruleRef?.getConditionStatement(tense)
    }

    return
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

    if (term.term_type === GROUP_TERM_TYPE) {
      return this.getFirstQuery(term?.term_value?.[0])
    } else if (term.term_type === QUERY_TERM_TYPE) {
      return term.term_value
    }

    return undefined
  }

  renderExpressionErrorMessage = () => {
    return (
      <div className='expression-error-message'>
        <Icon type='warning' warning /> Unable to display conditions. This Data Alert may be part of an older system
        that is no longer supported. <a onClick={this.resetConditions}>Reset Conditions</a>
      </div>
    )
  }

  render = () => {
    const style = {}
    if (this.props.conditionStatementOnly) {
      style.visibility = 'hidden'
      style.position = 'absolute'
      style.height = '0'
      style.width = '0'
      style.opacity = '0'
    }

    return (
      <ErrorBoundary>
        <div className='data-alerts-container'>
          <div className='notification-rule-outer-container' data-test='notification-rules'>
            {this.state.expressionError ? (
              this.renderExpressionErrorMessage()
            ) : (
              <>
                <RuleSimple
                  style={style}
                  authentication={this.props.authentication}
                  autoQLConfig={this.props.autoQLConfig}
                  ref={(r) => (this.ruleRef = r)}
                  ruleId={this.state.expression?.id ?? uuid()}
                  onUpdate={this.onRuleUpdate}
                  initialData={this.state.expression}
                  tooltipID={this.props.tooltipID}
                  queryResponse={this.props.queryResponse}
                  onLastInputEnterPress={this.props.onLastInputEnterPress}
                />
                {this.props.conditionStatementOnly && (
                  <span className='condition-builder-statement'>
                    {this.getConditionStatement(this.props.conditionTense)}
                  </span>
                )}
              </>
            )}
          </div>
        </div>
      </ErrorBoundary>
    )
  }
}
