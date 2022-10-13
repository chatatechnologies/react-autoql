import React from 'react'
import PropTypes from 'prop-types'
import _isEqual from 'lodash.isequal'
import { v4 as uuid } from 'uuid'
import _get from 'lodash.get'
import parseNum from 'parse-num'

import { Input } from '../../Input'
import { Select } from '../../Select'
import { Icon } from '../../Icon'
import { Button } from '../../Button'
import ErrorBoundary from '../../../containers/ErrorHOC/ErrorHOC'

import { authenticationType } from '../../../props/types'
import { authenticationDefault, getAuthentication } from '../../../props/defaults'
import { fetchAutocomplete } from '../../../js/queryService'
import { capitalizeFirstChar } from '../../../js/Util'

import './RuleSimple.scss'

const getInitialStateData = (initialData) => {
  if (initialData && initialData.length === 1) {
    return {
      input1Value: initialData[0].term_value,
      conditionSelectValue: 'EXISTS',
      isComplete: !!_get(initialData[0].term_value, 'length'),
    }
  } else if (initialData && initialData.length > 1) {
    const input1Value = `${_get(initialData, '[0].term_value', '')}`
    const input2Value = `${_get(initialData, '[1].term_value', '')}`

    return {
      input1Value,
      input2Value,
      conditionSelectValue: initialData[0].condition,
      secondTermType: initialData[1].term_type,
      isComplete: !!_get(input1Value, 'length') && !!_get(input2Value, 'length'),
    }
  }

  return {}
}

export default class RuleSimple extends React.Component {
  autoCompleteTimer = undefined

  constructor(props) {
    super(props)

    this.initialData = {}
    this.TERM_ID_1 = uuid()
    this.TERM_ID_2 = uuid()

    const { initialData } = props

    if (initialData && initialData.length === 1) {
      this.TERM_ID_1 = initialData[0].id
      this.TERM_ID_2 = uuid()
    } else if (initialData && initialData.length > 1) {
      this.TERM_ID_1 = initialData[0].id
      this.TERM_ID_2 = initialData[1].id
    }
  }

  static propTypes = {
    authentication: authenticationType,
    ruleId: PropTypes.string,
    onUpdate: PropTypes.func,
    initialData: PropTypes.arrayOf(PropTypes.shape({})),
    readOnly: PropTypes.bool,
  }

  static defaultProps = {
    authentication: authenticationDefault,
    ruleId: undefined,
    onUpdate: () => {},
    initialData: undefined,
    readOnly: false,
  }

  state = {
    input1Value: '',
    input2Value: '',
    conditionSelectValue: 'GREATER_THAN',
    secondTermType: 'query',
    isFirstTermValid: true,
    isSecondTermValid: true,
    ...getInitialStateData(this.props.initialData),
  }

  componentDidMount = () => {
    this.props.onUpdate(this.props.ruleId, this.isComplete(), this.isValid())
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
    if (initialData.length === 1) {
      this.TERM_ID_1 = initialData[0].id
      this.TERM_ID_2 = uuid()
      this.setState({
        input1Value: initialData[0].term_value,
        conditionSelectValue: 'EXISTS',
      })
    } else if (initialData.length > 1) {
      this.TERM_ID_1 = initialData[0].id
      this.TERM_ID_2 = initialData[1].id
      this.setState({
        input1Value: initialData[0].term_value,
        input2Value: `${initialData[1].term_value}`,
        conditionSelectValue: initialData[0].condition,
        secondTermType: initialData[1].term_type,
      })
    }
  }

  getJSON = () => {
    if (this.state.conditionSelectValue === 'EXISTS') {
      return [
        {
          id: this.TERM_ID_1,
          term_type: 'query',
          condition: this.state.conditionSelectValue,
          term_value: this.state.input1Value,
        },
      ]
    }

    const { input2Value } = this.state
    return [
      {
        id: this.TERM_ID_1,
        term_type: 'query',
        condition: this.state.conditionSelectValue,
        term_value: this.state.input1Value,
      },
      {
        id: this.TERM_ID_2,
        term_type: this.isNumerical(input2Value) ? 'constant' : 'query',
        condition: 'TERMINATOR',
        term_value: this.isNumerical(input2Value) ? parseNum(input2Value) : input2Value,
      },
    ]
  }

  isNumerical = (num) => {
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
  }

  isComplete = () => {
    if (this.state.conditionSelectValue === 'EXISTS') {
      return !!this.state.input1Value
    } else {
      return !!_get(this.state.input1Value, 'length') && !!_get(this.state.input2Value, 'length')
    }
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

  renderConditionOperator = (text) => {
    switch (text) {
      case 'GREATER_THAN': {
        return '>'
      }
      case 'LESS_THAN': {
        return '<'
      }
      case 'EQUAL_TO': {
        return '='
      }
      case 'EXISTS': {
        return 'Exists'
      }
    }
  }

  renderReadOnlyRule = () => {
    return (
      <ErrorBoundary>
        <div>
          <span className='read-only-rule-term'>{`${capitalizeFirstChar(this.state.input1Value)}`}</span>
          <span className='read-only-rule-term'>{`${this.renderConditionOperator(
            this.state.conditionSelectValue,
          )}`}</span>
          {this.state.conditionSelectValue !== 'EXISTS' && (
            <span className='read-only-rule-term'>{capitalizeFirstChar(this.state.input2Value)}</span>
          )}
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

  renderCompareBtn = () => {
    if (this.state.conditionSelectValue === 'EXISTS') {
      return (
        <Button
          onClick={() => {
            this.setState({ conditionSelectValue: 'GREATER_THAN' })
          }}
        >
          Compare
        </Button>
      )
    }
    return null
  }

  renderConditionSelector = () => {
    return (
      <Select
        options={[
          { value: 'GREATER_THAN', label: '>', tooltip: 'Greater Than' },
          { value: 'LESS_THAN', label: '<', tooltip: 'Less Than' },
          { value: 'EQUAL_TO', label: '=', tooltip: 'EQUAL_TO' },
          {
            value: 'EXISTS',
            label: 'Exists',
            tooltip: 'No Comparison',
          },
        ]}
        value={this.state.conditionSelectValue}
        className='react-autoql-rule-condition-select'
        onChange={(value) => {
          this.setState({ conditionSelectValue: value })
        }}
      />
    )
    return null
  }

  renderRule = () => {
    return (
      <ErrorBoundary>
        <div className='react-autoql-notification-rule-container' data-test='rule'>
          <div className='react-autoql-rule-first-input-container'>
            <div className='react-autoql-rule-input'>
              <Input
                placeholder='Type a query'
                value={this.state.input1Value}
                onChange={(e) => this.setState({ input1Value: e.target.value })}
              />
              {!this.state.isFirstTermValid && this.renderValidationError()}
            </div>
            {this.renderCompareBtn()}
          </div>
          <div
            className={`react-autoql-rule-second-input-container${
              this.state.conditionSelectValue === 'EXISTS' ? ' hidden' : ''
            }`}
          >
            {this.renderConditionSelector()}
            <div className='react-autoql-rule-input'>
              <Input
                placeholder='Type a query or number'
                value={this.state.input2Value}
                onChange={(e) => this.setState({ input2Value: e.target.value })}
              />
              {!this.state.isSecondTermValid && this.renderValidationError()}
            </div>
            <Icon
              className='react-autoql-delete-compare-btn'
              type='close'
              onClick={() => this.setState({ conditionSelectValue: 'EXISTS' })}
            />
          </div>
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
