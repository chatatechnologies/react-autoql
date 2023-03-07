import React from 'react'
import PropTypes from 'prop-types'
import _isEqual from 'lodash.isequal'
import { v4 as uuid } from 'uuid'
import parseNum from 'parse-num'

import { Input } from '../../Input'
import { Select } from '../../Select'
import { Icon } from '../../Icon'
import { Button } from '../../Button'
import { ErrorBoundary } from '../../../containers/ErrorHOC'

import { authenticationType } from '../../../props/types'
import { authenticationDefault, getAuthentication } from '../../../props/defaults'
import { fetchAutocomplete } from '../../../js/queryService'
import { capitalizeFirstChar, isListQuery, isSingleValueResponse } from '../../../js/Util'
import { DATA_ALERT_OPERATORS } from '../../../js/Constants'

import './RuleSimpleV2.scss'
import { isAggregation } from '../../QueryOutput/columnHelpers'

const getInitialStateData = (initialData) => {
  if (initialData && initialData.length === 1) {
    return {
      input1Value: initialData[0].term_value,
      selectedOperator: this.supportedOperators[0],
      isComplete: !!initialData?.[0]?.term_value?.length,
      userSelection: initialData[0].user_selection,
    }
  } else if (initialData && initialData.length > 1) {
    const input1Value = initialData?.[0]?.term_value ?? ''
    const input2Value = initialData?.[1]?.term_value ?? ''

    return {
      input1Value,
      input2Value,
      selectedOperator: initialData[0].condition,
      secondTermType: initialData[1].term_type,
      isComplete: !!input1Value?.length && !!input2Value?.length,
      userSelection: initialData[0].user_selection,
    }
  }

  return {}
}

export default class RuleSimpleV2 extends React.Component {
  autoCompleteTimer = undefined

  constructor(props) {
    super(props)

    this.initialData = {}
    this.TERM_ID_1 = uuid()
    this.TERM_ID_2 = uuid()

    const { initialData } = props

    this.supportedOperators = Object.keys(DATA_ALERT_OPERATORS)
    this.supportedSecondTermTypes = this.getSupportedSecondTermTypes(props.queryResponse)

    if (initialData && initialData.length === 1) {
      this.TERM_ID_1 = initialData[0].id
      this.TERM_ID_2 = uuid()
    } else if (initialData && initialData.length > 1) {
      this.TERM_ID_1 = initialData[0].id
      this.TERM_ID_2 = initialData[1].id
    }

    this.state = {
      input1Value: props.queryResponse?.data?.data?.text ?? '',
      input2Value: '',
      selectedOperator: this.supportedOperators?.[0],
      secondTermType: this.supportedSecondTermTypes?.[0],
      isFirstTermValid: true,
      isSecondTermValid: true,
      ...getInitialStateData(props.initialData),
    }
  }

  static propTypes = {
    authentication: authenticationType,
    ruleId: PropTypes.string,
    onUpdate: PropTypes.func,
    initialData: PropTypes.arrayOf(PropTypes.shape({})),
    readOnly: PropTypes.bool,
    queryResponse: PropTypes.shape({}),
  }

  static defaultProps = {
    authentication: authenticationDefault,
    ruleId: undefined,
    onUpdate: () => {},
    initialData: undefined,
    queryResponse: undefined,
    readOnly: false,
  }

  componentDidMount = () => {
    this.props.onUpdate(this.props.ruleId, this.isComplete(), this.isValid())

    // Focus on second input if it exists. The first input will already be filled in
    this.secondInput?.focus()
  }

  componentDidUpdate = (prevProps, prevState) => {
    if (!_isEqual(this.state, prevState)) {
      this.props.onUpdate(this.props.ruleId, this.isComplete(), this.isValid())
    }
  }

  componentWillUnmount = () => {
    if (this.autoCompleteTimer) {
      clearTimeout(this.autoCompleteTimer)
    }
  }

  parseJSON = (initialData) => {
    // if (initialData.length === 1) {
    //   console.log('initialData exists.. setting condition to EXISTS')
    //   this.TERM_ID_1 = initialData[0].id
    //   this.TERM_ID_2 = uuid()
    //   this.setState({
    //     input1Value: initialData[0].term_value,
    //     selectedOperator: 'EXISTS',
    //   })
    // } else
    if (initialData.length > 1) {
      this.TERM_ID_1 = initialData[0].id
      this.TERM_ID_2 = initialData[1].id
      this.setState({
        input1Value: initialData[0].term_value,
        input2Value: `${initialData[1].term_value}`,
        selectedOperator: initialData[0].condition,
        secondTermType: initialData[1].term_type,
      })
    }
  }

  getJSON = () => {
    // if (this.state.selectedOperator === 'EXISTS') {
    //   return [
    //     {
    //       id: this.TERM_ID_1,
    //       term_type: 'query',
    //       condition: this.state.selectedOperator,
    //       term_value: this.state.input1Value,
    //       user_selection: this.state.userSelection,
    //     },
    //   ]
    // }

    const { input2Value } = this.state
    return [
      {
        id: this.TERM_ID_1,
        term_type: 'query',
        condition: this.state.selectedOperator,
        term_value: this.state.input1Value,
        user_selection: this.state.userSelection,
      },
      {
        id: this.TERM_ID_2,
        term_type: this.isNumerical(input2Value) ? 'constant' : 'query',
        condition: 'TERMINATOR',
        term_value: this.isNumerical(input2Value) ? parseNum(input2Value) : input2Value,
        user_selection: this.state.userSelection,
      },
    ]
  }

  isNumerical = (num) => {
    try {
      if (typeof num === 'number') {
        return true
      }

      if (!num) {
        return false
      }

      // Check for multiple words. If so, do not attempt parse
      const words = num.split(' ')
      if (words && words.length > 1) {
        return false
      }

      // If just one word, strip everything but numbers
      const strippedSymbolsStr = parseNum(num)
      return !isNaN(Number(strippedSymbolsStr))
    } catch (error) {
      return false
    }
  }

  isComplete = () => {
    return !!this.state.input1Value?.length && !!this.state.input2Value?.length
  }

  isValid = () => {
    return true
  }

  userSelectedSuggestionHandler = (userSelectedValueFromSuggestionBox) => {
    if (userSelectedValueFromSuggestionBox && userSelectedValueFromSuggestionBox.name) {
      this.userSelectedValue = userSelectedValueFromSuggestionBox.name
      this.userSelectedSuggestion = true
      this.setState({ inputValue: userSelectedValueFromSuggestionBox.name })
    }
  }

  onSuggestionsFetchRequested = ({ value }) => {
    if (this.autoCompleteTimer) {
      clearTimeout(this.autoCompleteTimer)
    }

    this.autoCompleteTimer = setTimeout(() => {
      fetchAutocomplete({
        ...getAuthentication(this.props.authentication),
        ...getAutoQLConfig(this.props.autoQLConfig),
        suggestion: value,
      })
        .then((response) => {
          const body = response.data

          const sortingArray = []
          let suggestionsMatchArray = []
          const autoCompleteArray = []
          suggestionsMatchArray = body.matches
          for (let i = 0; i < suggestionsMatchArray.length; i++) {
            sortingArray.push(suggestionsMatchArray[i])

            if (i === 4) {
              break
            }
          }

          sortingArray.sort((a, b) => b.length - a.length)
          for (let idx = 0; idx < sortingArray.length; idx++) {
            const anObject = {
              name: sortingArray[idx],
            }
            autoCompleteArray.push(anObject)
          }

          this.setState({
            suggestions: autoCompleteArray,
          })
        })
        .catch((error) => {
          console.error(error)
        })
    }, 500)
  }

  onSuggestionsClearRequested = () => {
    this.setState({
      suggestions: [],
    })
  }

  getSupportedSecondTermTypes = (queryResponse) => {
    if (isSingleValueResponse(queryResponse)) {
      return ['constant']
    }
  }

  renderReadOnlyRule = () => {
    const operator = this.state.selectedOperator
    return (
      <ErrorBoundary>
        <div>
          <span className='read-only-rule-term'>{`${capitalizeFirstChar(this.state.input1Value)}`}</span>
          <span className='read-only-rule-term'>{DATA_ALERT_OPERATORS[operator].displayName}</span>
          <span className='read-only-rule-term'>{capitalizeFirstChar(this.state.input2Value)}</span>
          {this.props.andOrValue && <span className='read-only-rule-term'>{this.props.andOrValue}</span>}
        </div>
      </ErrorBoundary>
    )
  }

  renderValidationError = () => {
    return (
      <div className='expression-term-validation-error'>
        <Icon type='warning-triangle' /> That query is invalid. Try entering a different query.
      </div>
    )
  }

  renderOperatorSelector = () => {
    const options = this.supportedOperators?.map((operator) => {
      const operatorObj = DATA_ALERT_OPERATORS[operator]
      const symbol = operatorObj.symbol ? `(${operatorObj.symbol})` : ''
      return {
        value: operator,
        listLabel: `${operatorObj.displayName} ${symbol}`,
        label: operatorObj.displayName,
      }
    })

    return (
      <Select
        options={options}
        value={this.state.selectedOperator}
        className='react-autoql-rule-condition-select'
        onChange={(value) => {
          this.setState({ selectedOperator: value })
        }}
      />
    )
  }

  renderRule = () => {
    return (
      <ErrorBoundary>
        <div className='react-autoql-notification-rule-container' data-test='rule'>
          <div className='react-autoql-rule-first-input-container'>
            <div className='react-autoql-rule-input-label'>Query</div>
            <div className='react-autoql-rule-input'>
              <Input
                placeholder='Type a query'
                value={this.state.input1Value}
                onChange={(e) => this.setState({ input1Value: e.target.value })}
              />
              {!this.state.isFirstTermValid && this.renderValidationError()}
            </div>
          </div>
        </div>
        <div className='react-autoql-notification-rule-container' data-test='rule'>
          {this.state.selectedOperator !== 'EXISTS' && (
            <>
              <div className='react-autoql-rule-condition-select-input-container'>
                <div className='react-autoql-rule-input-label'>Condition</div>
                {this.renderOperatorSelector()}
              </div>
              <div className='react-autoql-rule-second-input-container'>
                <div className='react-autoql-rule-input-label'>Threshold</div>
                <div className='react-autoql-rule-input'>
                  <Input
                    ref={(r) => (this.secondInput = r)}
                    placeholder='Type a query or number'
                    value={this.state.input2Value}
                    onChange={(e) => this.setState({ input2Value: e.target.value })}
                  />
                  {!this.state.isSecondTermValid && this.renderValidationError()}
                </div>
              </div>
            </>
          )}
        </div>
      </ErrorBoundary>
    )
  }

  render = () => {
    if (this.props.readOnly) {
      return this.renderReadOnlyRule()
    }

    return this.renderRule()
  }
}
