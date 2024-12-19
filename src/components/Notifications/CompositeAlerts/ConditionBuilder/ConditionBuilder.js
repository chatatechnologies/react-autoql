import React from 'react'
import { v4 as uuid } from 'uuid'
import PropTypes from 'prop-types'
import _isEqual from 'lodash.isequal'
import _cloneDeep from 'lodash.clonedeep'
import { GROUP_TERM_TYPE, QUERY_TERM_TYPE, authenticationDefault, dataFormattingDefault } from 'autoql-fe-utils'
import { Icon } from '../../../Icon'
import { RuleSimple } from '../RuleSimple'
import { ErrorBoundary } from '../../../../containers/ErrorHOC'
import { authenticationType, dataFormattingType } from '../../../../props/types'

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
    dataFormatting: dataFormattingType,
    dataAlert: PropTypes.object,
    baseDataAlertColumns: PropTypes.array,
    baseDataAlertQueryResponse: PropTypes.object,
    isLoadingBaseDataAlertQueryResponse: PropTypes.bool,
    onCustomFiltersChange: PropTypes.func,
    customFilters: PropTypes.array,
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
    dataFormatting: dataFormattingDefault,
    dataAlert: {},
    baseDataAlertColumns: [],
    baseDataAlertQueryResponse: {},
    isLoadingBaseDataAlertQueryResponse: false,
    onCustomFiltersChange: () => {},
    customFilters: [],
  }

  componentDidMount = () => {
    this._isMounted = true
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

  renderExpressionErrorMessage = () => {
    return (
      <div className='expression-error-message'>
        <Icon type='warning' warning /> Unable to display conditions. This Data Alert may be part of an older system
        that is no longer supported.
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
                  initialData={this.props.expression}
                  tooltipID={this.props.tooltipID}
                  queryResponse={this.props.queryResponse}
                  queryResultMetadata={this.props.queryResultMetadata}
                  filters={this.props.filters}
                  dataAlert={this.props.dataAlert}
                  baseDataAlertColumns={this.props.baseDataAlertColumns}
                  baseDataAlertQueryResponse={this.props.baseDataAlertQueryResponse}
                  isLoadingBaseDataAlertQueryResponse={this.props.isLoadingBaseDataAlertQueryResponse}
                  onCustomFiltersChange={this.props.onCustomFiltersChange}
                  customFilters={this.props.customFilters}
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
