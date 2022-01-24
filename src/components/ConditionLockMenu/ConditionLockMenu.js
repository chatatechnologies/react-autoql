import React, { Fragment } from 'react'
import PropTypes from 'prop-types'
import Autosuggest from 'react-autosuggest'
import { lang } from '../../js/Localization'
import uuid from 'uuid'
import _get from 'lodash.get'
import ReactTooltip from 'react-tooltip'
import Switch from 'react-switch'

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
import { LoadingDots } from '../LoadingDots'

import './ConditionLockMenu.scss'

let autoCompleteArray = []

export default class ConditionLockMenu extends React.Component {
  UNIQUE_ID = uuid.v4()
  static propTypes = {
    containerWidth: PropTypes.number,
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
    isFetchingConditions: false,
    isShowingInfo: false,
    isShowingSettingInfo: false,
    showMessage: {
      type: 'unlock',
      message: 'filter removed'
    }
  }

  componentDidMount = () => {
    try {
      this.setState({
        isFetchingConditions: true,
      })
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
          this.setState({ 
            selectedConditions: array.sort(), 
            inputValue: '',
            isFetchingConditions: false,
          })
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

    if(array.some(item => item.key === suggestion.name.canonical && item.value === suggestion.name.keyword)){
      this.handleShowMessage('warning', 'This condition has already been applied.')
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
    const sessionConditions = JSON.parse(sessionStorage.getItem("conditions"));
    let sessionIndex;
    if(sessionConditions) {
      sessionIndex = sessionConditions.findIndex(condition => _get(condition, 'key') === _get(item, 'key'))
    }
    
    if(sessionIndex !== -1 && sessionIndex !== undefined && sessionIndex !== null) {
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
    this.handleShowMessage('unlock', 'Filter removed.')
  }

  /**
   * WIP: Session Locking
   * @param {*} item
   */
  handlePersistConditionToggle = (item) => {
    var index = this.state.selectedConditions.findIndex(condition => condition.id === item.id);
    var sessionConditions = JSON.parse(sessionStorage.getItem("conditions"));

    if (index === -1){
      // handle error
    } else {
        this.setState({
          selectedConditions: [
            ...this.state.selectedConditions.slice(0,index),
            Object.assign({}, 
              this.state.selectedConditions[index], item.lock_flag === 1 
              ? this.state.selectedConditions[index].lock_flag = 0 
              : this.state.selectedConditions[index].lock_flag = 1),
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
            var sessionIndex = sessionConditions.findIndex(condition => condition.id === item.id)
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

            if (i === 5) {
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

  handleShowMessage(type, message) {
    var el = document.getElementById(
      'react-autoql-condition-show-message'
    )
    el.className = 'show'
    el.style.animation = 'none';
    setTimeout(function() {
        el.style.animation = '';
    }, 10);
    setTimeout(() => {
      el.className = el.className.replace('show', '')
    }, 3000)
    this.setState({ 
      inputValue: '',
      showMessage: {
        type: type,
        message: message
      } 
    })
  }

  renderShowMessage = () => (
    <div id="react-autoql-condition-show-message">
      <Icon type={this.state.showMessage.type} /> {this.state.showMessage.message}
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
          {this.renderShowMessage()}
          <div className="react-autoql-condition-lock-header">
            <div className="react-autoql-filter-locking-title-container">
              <h3>Filter Locking {' '} 
                <Icon 
                  type="info" 
                  onMouseEnter={() => setTimeout(() => {
                    this.setState({ isShowingInfo: true })
                  }, 1000)} 
                  onMouseLeave={() => this.setState({ isShowingInfo: false })} 
                />
              </h3>
              <button
                onClick={() => {
                  this.props.onClose()
                }}
                className="autoql-close-button"
                data-tip={lang.closeFilterLocking}
                data-for="react-autoql-header-tooltip"
              >
                <Icon type="close" />
              </button>
            </div>
            {this.state.isShowingInfo || (!this.state.isFetchingConditions && _get(this.state.selectedConditions, 'length') === 0) ? (
              <div className="react-autoql-filter-locking-empty-list">
                <Icon type="info" />
                <p>
                  Filters can be applied to narrow down your query results. Locking a 
                  filter ensures that only the specific data you wish to see is returned.
                </p>
              </div>
            ) : null}
            <div className="autoql-condition-locking-menu-container">
              <Autosuggest
                ref={(ref) => {
                  this.autoSuggest = ref
                }}
                highlightFirstSuggestion
                suggestions={this.state.suggestions}
                onSuggestionsFetchRequested={this.onSuggestionsFetchRequested}
                onSuggestionsClearRequested={this.onSuggestionsClearRequested}
                getSuggestionValue={this.getSuggestionValue}
                renderSuggestion={(suggestion) => (
                  <Fragment>
                    <table className="autoql-condition-locking-menu-list">
                      <tbody>
                        <tr>
                          <td style={{ width: 300 }}>{suggestion.name.keyword}</td>
                          <td>{suggestion.name.show_message}</td>
                        </tr>
                      </tbody>
                    </table>
                  </Fragment>
                )}
                inputProps={{
                  onChange: this.onInputChange,
                  value: this.state.inputValue,
                  disabled: this.state.isFetchingConditions,
                  placeholder: 'Search & select a filter',
                  className: 'react-autoql-condition-locking-input',
                }}
              />
              {this.state.isShowingSettingInfo ? (
                <div className="react-autoql-filter-setting-info-card">
                  <p>
                  <Icon type="info" />{' '}<strong>Persistent</strong> filters remain locked at all times, unless the filter is removed.
                    <br /> 
                  <Icon type="info" />{' '}<strong>Session</strong> filters remain locked until you end your browser session.
                  </p>
                </div>
              ) : null}
            </div>
          </div>
         {this.state.isFetchingConditions ? 
          <div className="condition-list-loading-container">
            <LoadingDots />
          </div> 
          : <div className="condition-list">
            {_get(this.state.selectedConditions, 'length') === 0 ? (
              <div className="empty-condition-list">
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
                        <th scope="col">Filter</th>
                        <th scope="col" style={{ minWidth: 154 }}>
                          Setting
                          <Icon 
                            type="info" 
                            onMouseEnter={() => setTimeout(() => {
                              this.setState({ isShowingInfo: true })
                            }, 800)}  
                            onMouseLeave={() => this.setState({ isShowingSettingInfo: false })} 
                          />
                        </th>
                        <th
                          scope="col"
                          style={{
                            display: 'table-cell',
                            verticalAlign: 'middle',
                            textAlign: 'right',
                          }}
                        >
                        </th>
                    </thead>
                    <tbody>
                      {this.state.selectedConditions.map((item, index) => {
                        return (
                          <tr key={index}>
                            <td className="condition-table-list-item">
                              {item.keyword}{' '}{`(${item.show_message})`}
                            </td>
                            <td>
                                <span>
                                  <Switch 
                                    onChange={() => this.handlePersistConditionToggle(item, index)} 
                                    checked={item.lock_flag}
                                    onColor="#86d3ff"
                                    onHandleColor="#2693e6"
                                    uncheckedIcon={false}
                                    checkedIcon={false}
                                    boxShadow="0px 1px 5px rgba(0, 0, 0, 0.6)"
                                    activeBoxShadow="0px 0px 1px 1px rgba(0, 0, 0, 0.2)"
                                    handleDiameter={16}
                                    height={18}
                                    width={34}
                                  />{' '}
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
                                data-tip="Remove filter"
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
         }
          <div className="react-autoql-condition-lock-menu-footer">
            <Button 
              size="small"
              disabled={this.state.isFetchingConditions}
              onClick={() => {
                this.props.onClose()
              }}
            >
              Done
            </Button>
          </div>
        </div>
      </ErrorBoundary>
    )
  }
}
