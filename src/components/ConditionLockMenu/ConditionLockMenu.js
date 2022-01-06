import React, { Fragment } from 'react'
import PropTypes from 'prop-types'
import Autosuggest from 'react-autosuggest'
import { lang } from '../../js/Localization'
import uuid from 'uuid'
import _get from 'lodash.get'
import _uniq from 'lodash.uniq'
import _some from 'lodash.some'
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
import { Button } from '../Button'

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
              value: conditions[i].value,
              show_message: conditions[i].show_message,
              key: conditions[i].key,
              lock_flag: conditions[i].lock_flag,
            })
          }
          if(JSON.parse(sessionStorage.getItem("conditions")) !== null) {
            var sessionConditions = JSON.parse(sessionStorage.getItem("conditions"));
            for (let i = 0; i < sessionConditions.length; i++) {
              array.push({
                id: sessionConditions[i].id,
                keyword: sessionConditions[i].value,
                value: sessionConditions[i].value,
                show_message: sessionConditions[i].show_message,
                key: sessionConditions[i].key,
                lock_flag: sessionConditions[i].lock_flag,
              })
            }
          }
          this.setState({ selectedConditions: array.sort(), inputValue: '' })
        }
      )
    } catch (error) {
      console.error(error)
    }
  }

  /**
   * When suggestion is clicked, Autosuggest populates the input
   * based on the clicked suggestion. Teach Autosuggest how to calculate the
   * input value for every given suggestion.
   * @param {*} suggestion
   */
  getSuggestionValue = (suggestion) => {
    let array = this.state.selectedConditions

    if(array.some(item => item.key === suggestion.name.canonical)){
      var el = document.getElementById(
        'condition-selection-error'
      )
      el.className = 'show'
      setTimeout(() => {
        el.className = el.className.replace('show', '')
      }, 3000)
      this.setState({ inputValue: '' })
    } else {
      array.push({
        keyword: suggestion.name.keyword,
        value: suggestion.name.keyword,
        show_message: suggestion.name.show_message,
        key: suggestion.name.canonical,
        lock_flag: 1 // persist by default
      })
      this.setState({ selectedConditions: array, inputValue: '' })
      setConditions({
        ...getAuthentication(this.props.authentication),
        conditions: array,
      })
    }
  }

  onInputChange = (e) => {
    if (e.keyCode === 38 || e.keyCode === 40) {
      // keyup or keydown
      return // return to let the component handle it...
    }

    if (e && e.target && (e.target.value || e.target.value === '')) {
      this.setState({ inputValue: e.target.value })
    }
  }

  /**
   * Removes condition from the list.
   * @param {*} item
   */
  removeCondition = (item, index) => {
    var sessionConditions = JSON.parse(sessionStorage.getItem("conditions"));
    var sessionIndex = sessionConditions.findIndex(condition => condition.key === item.key)
    
    if(sessionIndex !== -1) {
      sessionConditions.splice(sessionIndex, 1)
      sessionStorage.setItem('conditions', JSON.stringify(sessionConditions));
    } else {
      unsetCondition({
        ...getAuthentication(this.props.authentication),
        condition: item,
      })
    }

    const array = this.state.selectedConditions
    array.splice(index, 1)
    this.setState({ selectedConditions: array })
  }

  /**
   * WIP: Session Locking
   * @param {*} item
   */
  handlePersistConditionToggle = (item) => {
    var index = this.state.selectedConditions.findIndex(condition => condition.key === item.key);
    var sessionConditions = JSON.parse(sessionStorage.getItem("conditions"));

    if (index === -1){
      // handle error
    } else {
        this.setState({
          selectedConditions: [
            ...this.state.selectedConditions.slice(0,index),
            Object.assign({}, this.state.selectedConditions[index], item.lock_flag === 1 ? this.state.selectedConditions[index].lock_flag = 0 : this.state.selectedConditions[index].lock_flag = 1),
            ...this.state.selectedConditions.slice(index+1)
          ]
        }, () => {
          setConditions({
            ...getAuthentication(this.props.authentication),
            conditions: this.state.selectedConditions,
          })
          if(item.lock_flag === 0) {
            if(sessionConditions == null) sessionConditions = [];
            sessionConditions.push(item);
            sessionStorage.setItem("conditions", JSON.stringify(sessionConditions));
          } else {
            var sessionIndex = sessionConditions.findIndex(condition => condition.key === item.key)
            sessionConditions.splice(sessionIndex, 1)
            sessionStorage.setItem('conditions', JSON.stringify(sessionConditions));
          }
      });
    }
  }

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


  renderShowSuccessMessage = () => (
    <div id="condition-selection-error">
      <Icon type="warning" /> This condition has already been applied.
    </div>
  )

  renderAcceptConditionsButton = () => (
    <div
      key="accept-conditions-btn"
      className="react-autoql-accept-conditions-button"
    >
      <span
        onClick={() => {
          setConditions({
            ...getAuthentication(this.props.authentication),
            conditions: this.state.selectedConditions,
          })
            .then(() => {
              this.props.onClose(true)
            })
            .catch((e) => {
              //WIP showErrorMessage
              console.error(e)
            })
        }}
      >
        <Icon type="lock" style={{ verticalAlign: 'middle' }} /> Save
      </span>
    </div>
  )

  render = () => {
    const { containerWidth } = this.props

    return (
      <ErrorBoundary>
        <div
          className="react-autoql-condition-lock-menu"
          style={{ width: containerWidth }}
        >
          {this.renderShowSuccessMessage()}
          <div className="react-autoql-condition-lock-header">
            <div className="autoql-condition-locking-menu-container">
              <button
                onClick={() => {
                  this.props.onClose()
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
                  <Fragment>
                    <table>
                      <tr>
                        <td style={{ width: 300 }}>{suggestion.name.keyword}</td>
                        <td style={{ width: 300 }}>{suggestion.name.show_message}</td>
                      </tr>
                    </table>
                  </Fragment>
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
                  specific location, vendor or item without the need to type
                  it out for every query.
                </p>
                <p>
                  You currently have no conditions locked. Use the search bar to
                  find a condition you would like to track.
                </p>
              </div>
            ) : (
              <div>
                <div style={{ minHeight: 150 }}>
                  <table className="condition-table">
                    <thead>
                        <th scope="col">Condition</th>
                        <th scope="col">Column</th>
                        <th scope="col">State</th>
                        <th
                          scope="col"
                          style={{
                            display: 'table-cell',
                            verticalAlign: 'middle',
                            textAlign: 'right',
                          }}
                        >
                          Action
                        </th>
                    </thead>
                    <tbody>
                      {this.state.selectedConditions.map((item, index) => {
                        return (
                          <tr key={index} onClick={() => this.handlePersistConditionToggle(item, index)}>
                            <td>{item.keyword}</td>
                            <td>{item.show_message}</td>
                            <td>
                              <ReactTooltip
                                className="react-autoql-chart-tooltip"
                                id="condition-lock-persist"
                                effect="solid"
                                html
                                getContent={() => {
                                  return item.lock_flag 
                                  ? 'Condition will be stored and available to you every time you come back' 
                                  : 'Condtition will be locked for this session only'
                                }}
                              />
                                <span 
                                  data-tip
                                  data-for="condition-lock-persist"
                                >
                                  <Icon type={"lock"} style={{ color: item.lock_flag === 1 ? '#2aca4d' : '#ffcc00' }} />
                                  {item.lock_flag ? 'Persistent' : 'Session'}
                                </span>
                            </td>
                            <td
                              style={{
                                display: 'table-cell',
                                verticalAlign: 'middle',
                                textAlign: 'right',
                              }}
                            >
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
                                onClick={() =>
                                  this.removeCondition(item, index)
                                }
                              />
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot></tfoot>
                  </table>
                </div>
              </div>
            )}
          </div>
          <Button 
            size="small"
            style={{ float: 'right', marginRight: 10, marginBottom: -40 }} 
            onClick={() => {
              this.props.onClose()
            }}
          >
            Done
          </Button>
        </div>
      </ErrorBoundary>
    )
  }
}
