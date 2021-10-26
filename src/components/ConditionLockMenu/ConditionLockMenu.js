import React, { Fragment } from 'react'
import PropTypes from 'prop-types'
import Autosuggest from 'react-autosuggest'
import { lang } from '../../js/Localization'
import uuid from 'uuid'
import _get from 'lodash.get'
import ReactTooltip from 'react-tooltip'

import { authenticationType } from '../../props/types'
import {
  fetchValueLabelAutocomplete,
  setConditions,
  unsetCondition,
  fetchConditions,
} from '../../js/queryService'

import { getAuthentication } from '../../props/defaults'

import { Icon } from '../Icon'
import ErrorBoundary from '../../containers/ErrorHOC/ErrorHOC'

import './ConditionLockMenu.scss'

let autoCompleteArray = []

export default class ConditionLockMenu extends React.Component {
  UNIQUE_ID = uuid.v4()
  static propTypes = {
    containerWidth: PropTypes.string,
    isOpen: PropTypes.bool,
    onClose: PropTypes.func,
    authentication: authenticationType,
  }

  static defaultProps = {
    containerWidth: undefined,
    onClose: () => {},
  }

  state = {
    inputValue: '',
    lastQuery: '',
    suggestions: [],
    selectedConditions: [],
  }

  componentDidMount = () => {
    try {
      fetchConditions({ ...getAuthentication(this.props.authentication) }).then(
        (response) => {
          let conditions = _get(response, 'data.data.data')
          let array = this.state.selectedConditions
          for (let i = 0; i < conditions.length; i++) {
            array.push({
              id: conditions[i].id,
              keyword: conditions[i].value,
              value: conditions[i].value.toLowerCase(),
              show_message: conditions[i].show_message,
              key: conditions[i].key,
              lock_flag: conditions[i].lock_flag,
            })
          }
          this.setState({ selectedConditions: array, inputValue: '' })
        }
      )
    } catch (error) {
      console.error(error)
    }
  }

  // Teach Autosuggest how to calculate suggestions for any given input value.
  getSuggestions = (value) => {
    const inputValue = value.trim().toLowerCase()
    const inputLength = inputValue.length

    return inputLength === 0
      ? []
      : languages.filter(
          (lang) => lang.name.toLowerCase().slice(0, inputLength) === inputValue
        )
  }

  // When suggestion is clicked, Autosuggest needs to populate the input
  // based on the clicked suggestion. Teach Autosuggest how to calculate the
  // input value for every given suggestion.
  getSuggestionValue = (suggestion) => {
    let array = this.state.selectedConditions
    array.push({
      keyword: suggestion.name.keyword,
      value: suggestion.name.keyword.toLowerCase(),
      show_message: suggestion.name.show_message,
      key: suggestion.name.canonical,
      lock_flag: suggestion.name.lock_flag,
    })
    this.setState({ selectedConditions: array, inputValue: '' })
  }

  renderSuggestion = (suggestion) => (
    <div>{_get(suggestion, 'name.keyword')}</div>
  )

  onInputChange = (e) => {
    if (e.keyCode === 38 || e.keyCode === 40) {
      // keyup or keydown
      return // return to let the component handle it...
    }

    if (e && e.target && (e.target.value || e.target.value === '')) {
      this.setState({ inputValue: e.target.value })
    }
  }

  removeCondition = (item) => {
    unsetCondition({
      ...getAuthentication(this.props.authentication),
      condition: item,
    })
      .then(() => {
        const array = [...this.state.selectedConditions]
        array.splice(item, 1)
        this.setState({ selectedConditions: array })
      })
      .catch((e) => {
        // WIP: error handling
      })
  }

  /**
   * WIP: Session Locking
   * @param {*} item
   */
  // handleConditionCheckbox = (item) => {
  // this.setState(prevState => ({
  //   selectedConditions: prevState.selectedConditions.map(el => (el.key === item.key ? { ...el, lock_flag = 0 } : el))
  // }))
  // }

  onSuggestionsFetchRequested = ({ value }) => {
    if (this.autoCompleteTimer) {
      clearTimeout(this.autoCompleteTimer)
    }
    this.autoCompleteTimer = setTimeout(() => {
      fetchValueLabelAutocomplete({
        suggestion: value,
        ...getAuthentication(this.props.authentication),
      })
        .then((response) => {
          const body = _get(response, 'data.data')

          const sortingArray = []
          let suggestionsMatchArray = []
          autoCompleteArray = []
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
    }, 300)
  }

  onSuggestionsClearRequested = () => {
    this.setState({
      suggestions: [],
    })
  }

  render = () => {
    const { containerWidth } = this.props

    return (
      <ErrorBoundary>
        <div
          className="react-autoql-condition-lock-menu"
          style={{ width: containerWidth }}
        >
          <div className="react-autoql-condition-lock-header">
            <div className="autoql-condition-locking-menu-container">
              <button
                onClick={() => {
                  this.props.onClose()
                  setConditions({
                    ...getAuthentication(this.props.authentication),
                    conditions: this.state.selectedConditions,
                  })
                }}
                className="autoql-close-button"
                data-tip={lang.closeConditionLocking}
                data-for="react-autoql-header-tooltip"
              >
                <Icon type="close" />
              </button>
              <Autosuggest
                ref={(ref) => {
                  this.autoSuggest = ref
                }}
                suggestions={this.state.suggestions}
                onSuggestionsFetchRequested={this.onSuggestionsFetchRequested}
                onSuggestionsClearRequested={this.onSuggestionsClearRequested}
                getSuggestionValue={this.getSuggestionValue}
                renderSuggestion={(suggestion) => (
                  <Fragment>{suggestion.name.keyword}</Fragment>
                )}
                inputProps={{
                  onChange: this.onInputChange,
                  value: this.state.inputValue,
                  placeholder: 'Search for a condition.',
                  className: 'react-autoql-condition-locking-input',
                }}
              />
            </div>
          </div>
          <div className="condition-list">
            {_get(this.state.selectedConditions, 'length') === 0 ? (
              <div className="empty-condition-list">
                <p>
                  Condition locking is a tool to help you track a condition
                  across many queries. This is useful if you want to focus on a
                  specific location or timeframe but don't want to have to type
                  it out for every query.
                </p>
                <p>
                  You currently have no conditions locked. Use the search bar to
                  find a condition you would like to track.
                </p>
              </div>
            ) : (
              <table className="condition-table">
                <thead>
                  <th scope="col">Condition</th>
                  <th scope="col">Category</th>
                  <th
                    scope="col"
                    style={{
                      display: 'table-cell',
                      verticalAlign: 'middle',
                      textAlign: 'right',
                    }}
                  >
                    Actions
                  </th>
                </thead>
                <tbody>
                  {this.state.selectedConditions.map((item, index) => {
                    return (
                      <tr key={index}>
                        <td>{item.keyword}</td>
                        <td>{item.show_message}</td>
                        <td
                          style={{
                            display: 'table-cell',
                            verticalAlign: 'middle',
                            textAlign: 'right',
                          }}
                        >
                          <ReactTooltip
                            className="react-autoql-chart-tooltip"
                            id="condition-lock-persist"
                            effect="solid"
                            html
                          />
                          {/* {item.lock_flag ? 'Persistent' : 'Session'}
                          <input
                            type="checkbox"
                            data-tip="Lock this condition across sessions"
                            data-for="condition-lock-persist"
                            checked={item.lock_flag}
                            onClick={() => this.handleConditionCheckbox(item)}
                          ></input> */}
                          <ReactTooltip
                            className="react-autoql-chart-tooltip"
                            id="react-autoql-remove-condition"
                            effect="solid"
                            html
                          />
                          <Icon
                            style={{
                              paddingLeft: 5,
                              color: 'red',
                            }}
                            data-tip="Remove this condition"
                            data-for="react-autoql-remove-condition"
                            type="trash"
                            onClick={() => this.removeCondition(item, index)}
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot></tfoot>
              </table>
            )}
          </div>
        </div>
      </ErrorBoundary>
    )
  }
}
