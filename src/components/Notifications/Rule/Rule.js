import React, { Fragment } from 'react'
import PropTypes from 'prop-types'
import isEqual from 'lodash.isequal'
import Autosuggest from 'react-autosuggest'

import { Input } from '../../Input'
import { Select } from '../../Select'
import { Icon } from '../../Icon'

import { fetchSuggestions } from '../../../js/queryService'

import './Rule.scss'

export default class Rule extends React.Component {
  autoCompleteTimer = undefined

  static propTypes = {
    ruleId: PropTypes.string.isRequired,
    onAdd: PropTypes.func.isRequired,
    onDelete: PropTypes.func,
    onUpdate: PropTypes.func
  }

  static defaultProps = {
    onDelete: () => {},
    onUpdate: () => {}
  }

  state = {
    input1Value: '',
    input2Value: '',
    conditionSelectValue: 'GREATER_THAN',
    secondTermType: 'query',
    suggestions: []
  }

  componentDidUpdate = (prevProps, prevState) => {
    if (!isEqual(this.state, prevState)) {
      this.props.onUpdate(this.props.ruleId, this.isComplete(), this.getJSON())
    }
  }

  componentWillUnmount = () => {
    if (this.autoCompleteTimer) {
      clearTimeout(this.autoCompleteTimer)
    }
  }

  getJSON = () => {
    if (this.state.conditionSelectValue === 'EXISTS') {
      return [
        {
          term_type: 'query',
          condition: this.state.conditionSelectValue,
          term_value: this.state.input1Value
        }
      ]
    }

    return [
      {
        term_type: 'query',
        condition: this.state.conditionSelectValue,
        term_value: this.state.input1Value
      },
      {
        term_type: this.state.secondTermType,
        condition: 'TERMINATOR',
        term_value: this.state.input2Value
      }
    ]
  }

  isComplete = () => {
    if (this.state.conditionSelectValue === 'EXISTS') {
      return !!this.state.input1Value
    } else {
      return !!this.state.input1Value && !!this.state.input2Value
    }
  }

  userSelectedSuggestionHandler = userSelectedValueFromSuggestionBox => {
    if (
      userSelectedValueFromSuggestionBox &&
      userSelectedValueFromSuggestionBox.name
    ) {
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
      fetchSuggestions(
        value,
        true
        // this.props.demo,
        // this.props.domain,
        // this.props.apiKey,
        // this.props.customerId,
        // this.props.userId,
        // this.props.token
      )
        .then(response => {
          // const body = this.props.demo
          //   ? response.data
          //   : _get(response, 'data.data')
          const body = response.data

          const sortingArray = []
          let suggestionsMatchArray = []
          let autoCompleteArray = []
          suggestionsMatchArray = body.matches
          for (let i = 0; i < suggestionsMatchArray.length; i++) {
            sortingArray.push(suggestionsMatchArray[i])

            if (i === 4) {
              break
            }
          }

          console.log('match array')
          console.log(suggestionsMatchArray)

          sortingArray.sort((a, b) => b.length - a.length)
          for (let idx = 0; idx < sortingArray.length; idx++) {
            const anObject = {
              name: sortingArray[idx]
            }
            autoCompleteArray.push(anObject)
          }

          console.log('setting suggestions to')
          console.log(autoCompleteArray)

          this.setState({
            suggestions: autoCompleteArray
          })
        })
        .catch(() => {
          console.warn('Autocomplete operation cancelled by the user.')
        })
    }, 500)
  }

  onSuggestionsClearRequested = () => {
    this.setState({
      suggestions: []
    })
  }

  render = () => {
    let inputType = 'text'
    if (this.state.secondTermType === 'constant') {
      inputType = 'number'
    }

    return (
      <div className="chata-notification-rule-container" data-test="rule">
        <Input
          className="chata-rule-input"
          icon="chata-bubbles-outlined"
          placeholder="Query"
          value={this.state.input1Value}
          onChange={e => this.setState({ input1Value: e.target.value })}
        />
        {
          // <div className="chata-bar-container">
          //   <Autosuggest
          //   className="auto-complete-chata"
          //   onSuggestionsFetchRequested={this.onSuggestionsFetchRequested}
          //   onSuggestionsClearRequested={this.onSuggestionsClearRequested}
          //   getSuggestionValue={this.userSelectedSuggestionHandler}
          //   suggestions={this.state.suggestions}
          //   ref={ref => {
          //     this.autoSuggest = ref
          //   }}
          //   renderSuggestion={suggestion => (
          //     <Fragment>{suggestion.name}</Fragment>
          //   )}
          //   inputProps={{
          //     className: 'chata-rule-input chata-input',
          //     // icon:"chata-bubbles-outlined"
          //     placeholder: 'query',
          //     value: this.state.input1Value,
          //     onChange: e => this.setState({ input1Value: e.target.value })
          //   }}
          // />
          // </div>
        }
        <Select
          options={[
            { value: 'GREATER_THAN', label: '>', tooltip: 'Greater Than' },
            { value: 'LESS_THAN', label: '<', tooltip: 'Less Than' },
            { value: 'equals', label: '=', tooltip: 'Equals' },
            { value: 'EXISTS', label: <span>&#8707;</span>, tooltip: 'EXISTS' }
          ]}
          value={this.state.conditionSelectValue}
          className="chata-rule-condition-select"
          onOptionClick={option => {
            this.setState({ conditionSelectValue: option.value })
          }}
        />
        <div
          className={`chata-rule-second-input-container${
            this.state.conditionSelectValue === 'EXISTS' ? ' hidden' : ''
          }`}
        >
          <Input
            className="chata-rule-input"
            icon="chata-bubbles-outlined"
            type={inputType}
            placeholder={inputType === 'number' ? 'Constant' : 'Query'}
            value={this.state.input2Value}
            onChange={e => this.setState({ input2Value: e.target.value })}
          />
          <Select
            options={[
              {
                value: 'query',
                label: (
                  <Icon
                    type="chata-bubbles-outlined"
                    className="rule-input-select-bubbles-icon"
                  />
                ),
                tooltip: 'Query'
              },
              {
                value: 'constant',
                // label: <Icon type="numbers" style={{ fontSize: '20px' }} />
                label: <div style={{ fontSize: '9px' }}>123</div>,
                tooltip: 'Constant'
              }
              // { value: 'equation', label: 'Eq' }
            ]}
            value={this.state.secondTermType}
            className="chata-rule-term-type-selector"
            onOptionClick={option => {
              this.setState({ secondTermType: option.value })
            }}
          />
        </div>
        <Icon
          className="chata-rule-delete-btn"
          type="close"
          onClick={() => {
            this.props.onDelete(this.props.ruleId)
          }}
        />
        {
          //   <Icon
          //   className="chata-rule-add-btn"
          //   type="plus"
          //   onClick={this.props.onAdd}
          // />
        }
      </div>
    )
  }
}
