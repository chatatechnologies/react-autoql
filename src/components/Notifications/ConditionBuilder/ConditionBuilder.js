import React from 'react'
import { v4 as uuid } from 'uuid'
import PropTypes from 'prop-types'
import _isEqual from 'lodash.isequal'
import { cloneDeep } from 'lodash'
import { GROUP_TERM_TYPE, QUERY_TERM_TYPE, authenticationDefault, dataFormattingDefault } from 'autoql-fe-utils'

import { Icon } from '../../Icon'
import { RuleSimple } from '../RuleSimple'
import { ErrorBoundary } from '../../../containers/ErrorHOC'

import { authenticationType, dataFormattingType } from '../../../props/types'

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
    dataFormatting: dataFormattingType,
  }

  static defaultProps = {
    authentication: authenticationDefault,
    expression: undefined,
    conditionStatementOnly: false,
    conditionTense: 'present',
    useRT: false,
    sentenceCase: true,
    withFilters: false,
    onChange: () => {},
    onLastInputEnterPress: () => {},
    dataFormatting: dataFormattingDefault,
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
        expression = cloneDeep(initialExpression[0].term_value[0].term_value)
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

  onRuleUpdate = (id, isComplete, isValid) => {
    this.props.onChange(this.isComplete(), this.isValid(), this.getJSON())
  }

  getFormattedQueryText = ({ sentenceCase, withFilters } = {}) => {
    if (this.ruleRef) {
      return this.ruleRef.getFormattedQueryText({ sentenceCase, withFilters })
    }

    return null
  }

  getConditionStatement = ({
    tense = this.props.conditionTense,
    useRT = this.props.useRT,
    sentenceCase = this.props.sentenceCase,
    withFilters = this.props.withFilters,
  } = {}) => {
    if (this.ruleRef) {
      return this.ruleRef.getConditionStatement({ tense, useRT, sentenceCase, withFilters })
    }

    return null
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
                  dataFormatting={this.props.dataFormatting}
                  ref={(r) => (this.ruleRef = r)}
                  ruleId={this.props.expression?.id ?? uuid()}
                  onUpdate={this.onRuleUpdate}
                  initialData={this.props.expression}
                  tooltipID={this.props.tooltipID}
                  queryResponse={this.props.queryResponse}
                  queryResultMetadata={this.props.queryResultMetadata}
                  onLastInputEnterPress={this.props.onLastInputEnterPress}
                  dataAlertType={this.props.dataAlertType}
                  filters={this.props.filters}
                />
                {this.props.conditionStatementOnly && (
                  <span className='condition-builder-statement'>
                    {this.getConditionStatement(this.props.conditionTense, this.props.useRT, this.props.sentenceCase)}
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
