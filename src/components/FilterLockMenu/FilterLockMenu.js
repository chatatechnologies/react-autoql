import React, { Fragment, createRef } from 'react'
import PropTypes from 'prop-types'
import Autosuggest from 'react-autosuggest'
import { lang } from '../../js/Localization'
import uuid from 'uuid'
import _get from 'lodash.get'
import _isEqual from 'lodash.isequal'
import ReactTooltip from 'react-tooltip'
import Switch from 'react-switch'

import {
  fetchValueLabelAutocomplete,
  setConditions,
  unsetCondition,
  fetchConditions,
} from '../../js/queryService'

import { authenticationType, themeConfigType } from '../../props/types'
import { getAuthentication,  getThemeConfig, themeConfigDefault } from '../../props/defaults'
import { setCSSVars } from '../../js/Util'

import { Icon } from '../Icon'
import ErrorBoundary from '../../containers/ErrorHOC/ErrorHOC'
import { Button } from '../Button'
import { LoadingDots } from '../LoadingDots'
import { accentColorAssist } from './helpers'

import './FilterLockMenu.scss'

let autoCompleteArray = []

export default class FilterLockMenu extends React.Component {
  UNIQUE_ID = uuid.v4()
  mouseInfoRef = createRef();
  mouseSettingRef = createRef();
  
  static propTypes = {
    containerWidth: PropTypes.string,
    isOpen: PropTypes.bool,
    onClose: PropTypes.func,
    authentication: authenticationType,
    initFilterText: PropTypes.string,
    themeConfig: themeConfigType,
  }

  static defaultProps = {
    containerWidth: undefined,
    onClose: () => {},
    isOpen: false,
    authentication: undefined,
    initFilterText: undefined,
    themeConfig: themeConfigDefault,
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
          
          array.sort((a, b) => {
            return (a.keyword.toUpperCase() < b.keyword.toUpperCase()) ? -1 : (a.keyword > b.keyword) ? 1 : 0;
          })
          if(this.props.initFilterText && this.props.initFilterText !== '') {
            this.setState({ 
              selectedConditions: array, 
              isFetchingConditions: false,
            })
            for(let i = 0; i < array.length; i++) {
              if(array[i].keyword === this.props.initFilterText) {
                this.handleHighlightFilterRow(i)
                return
              }
            }
            this.animateInputTextAndSubmit(this.props.initFilterText)
          } else {
            this.setState({ 
              selectedConditions: array, 
              inputValue: '',
              isFetchingConditions: false,
            })
          }
        }
      )
    } catch (error) {
      console.error(error)
    }
  }

  componentDidUpdate = (prevProps, predState) => {
    if (
      !_isEqual(
        getThemeConfig(this.props.themeConfig),
        getThemeConfig(prevProps.themeConfig)
      )
    ) {
      setCSSVars(getThemeConfig(this.props.themeConfig))
    }
  }

  handleFetchFilteredList() {
    fetchConditions({ ...getAuthentication(this.props.authentication) }).then(
      (response) => {
        let conditions = _get(response, 'data.data.data')
        let array = [];
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
        
        array.sort((a, b) => {
          return (a.keyword.toUpperCase() < b.keyword.toUpperCase()) ? -1 : (a.keyword > b.keyword) ? 1 : 0;
        })
        this.setState({ 
          selectedConditions: array, 
          inputValue: '',
          isFetchingConditions: false,
        })
       })
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
      this.setState({ inputValue: '' })
      setConditions({
        ...getAuthentication(this.props.authentication),
        conditions: array,
      }).then(() => {
        this.handleShowMessage('lock', `${suggestion.name.keyword} has been locked`)
        this.handleFetchFilteredList()
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
    // this.setState({ selectedConditions: array })
    this.handleShowMessage('unlock', 'Filter removed.')
    ReactTooltip.hide()
  }

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
          }).then(() => {
            this.handleFetchFilteredList()
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

          sortingArray.sort((a, b) => {
            return (a.keyword.toUpperCase() < b.keyword.toUpperCase()) ? -1 : (a.keyword > b.keyword) ? 1 : 0;
          })
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

  handleHighlightFilterRow(index) {
    var el = document.getElementById(
      `react-autoql-condition-table-list-item-${index}`
    )
    if(el) {
      el.className = 'react-autoql-highlight-row'
      setTimeout(() => {
        el.className = el.className.replace('react-autoql-highlight-row', '')
      }, 1800)
    }
  }

  timer;
  onEnterFilterHeaderInfo = () => {
    var el = document.getElementById(
      'react-autoql-filter-description-id'
    )
    this.timer = setTimeout(() => {
      el.className = 'show'
    }, 500);
  }

  onLeaveFilterHeaderInfo = () => {
    var el = document.getElementById(
      'react-autoql-filter-description-id'
    )
    el.className = el.className.replace('show', '')
    clearTimeout(this.timer)
  }

  onEnterFilterSettingInfo = () => {
    var el = document.getElementById(
      'react-autoql-filter-setting-info-card'
    )
    this.timer = setTimeout(() => {
      el.className = 'show'
    }, 500);
  }

  onLeaveFilterSettingInfo = () => {
    var el = document.getElementById(
      'react-autoql-filter-setting-info-card'
    )
    el.className = el.className.replace('show', '')
    clearTimeout(this.timer)
  }

  animateInputTextAndSubmit = (text) => {
    if (typeof text === 'string' && _get(text, 'length')) {
      for (let i = 1; i <= text.length; i++) {
        setTimeout(() => {
          this.setState({
            inputValue: text.slice(0, i),
          })
          if (i === text.length) {
            setTimeout(() => {
              const input = document.querySelector('#react-autoql-filter-menu-input');
              input.focus();
            }, 300)
          }
        }, i * 50)
      }
    }
  }

  renderShowMessage = () => (
    <div id="react-autoql-condition-show-message">
      <Icon type={this.state.showMessage.type} /> {this.state.showMessage.message}
    </div>
  )

  render = () => {
    const { containerWidth } = this.props

    return (
      <ErrorBoundary>
        <div
          data-test="react-autoql-filter-menu-container"
          className="react-autoql-condition-lock-menu"
          style={{ width: containerWidth }}
        >
          {this.renderShowMessage()}
          <div className="react-autoql-condition-lock-header">
            <div className="react-autoql-filter-locking-title-container">
              <h3 className="react-autoql-filter-locking-title">{lang.filterLockingTitle} {' '} 
                <Icon 
                  type="info" 
                  ref={this.mouseInfoRef}
                  onMouseEnter={this.onEnterFilterHeaderInfo} 
                  onMouseLeave={this.onLeaveFilterHeaderInfo} 
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
            <div className="autoql-condition-locking-menu-container">
                <div id="react-autoql-filter-description-id" >
                  <Icon type="info" />
                  <p className="react-autoql-filter-info-text">
                    Filters can be applied to narrow down your query results. Locking a 
                    filter ensures that only the specific data you wish to see is returned.
                  </p>
                </div>
              <Autosuggest
                ref={(ref) => {
                  this.autoSuggest = ref
                }}
                id='react-autoql-filter-menu-input'
                highlightFirstSuggestion
                suggestions={this.state.suggestions}
                onSuggestionsFetchRequested={this.onSuggestionsFetchRequested}
                onSuggestionsClearRequested={this.onSuggestionsClearRequested}
                getSuggestionValue={this.getSuggestionValue}
                renderSuggestion={(suggestion) => (
                  <Fragment>
                    <span id="react-autoql-filter-table" className="autoql-condition-locking-menu-list">
                      <tr id="react-autoql-filter-table-row">
                        <td id="react-autoql-filter-table-data" style={{ width: 300 }}>{suggestion.name.keyword}</td>
                        <td id="react-autoql-filter-table-data">{suggestion.name.show_message}</td>
                      </tr>
                    </span>
                  </Fragment>
                )}
                inputProps={{
                  onChange: this.onInputChange,
                  value: this.state.inputValue,
                  disabled: this.state.isFetchingConditions,
                  placeholder: 'Search & select a filter',
                  className: 'react-autoql-condition-locking-input',
                  id: 'react-autoql-filter-menu-input',
                }}
              />
                <div id="react-autoql-filter-setting-info-card">
                  <p className="react-autoql-filter-info-text">
                  <Icon type="info" />{' '}<strong>Persistent</strong> filters remain locked at all times, unless the filter is removed.
                    <br /> 
                  <Icon type="info" />{' '}<strong>Session</strong> filters remain locked until you end your browser session.
                  </p>
                </div>
            </div>
          </div>
         {this.state.isFetchingConditions ? 
          <div className="react-autoql-condition-list-loading-container">
            <LoadingDots />
          </div> 
          : <div className="react-autoql-condition-list">
            {_get(this.state.selectedConditions, 'length') === 0 ? (
              <div className="react-autoql-empty-condition-list">
                <p>
                  <i>{lang.noFiltersLocked}</i>
                </p>
              </div>
            ) : (
              <div>
                <div>
                  <table className="react-autoql-condition-table">
                    <thead>
                      <tr>
                        <th style={{ width: '60%' }}>Filter</th>
                        <th>
                            Settings
                            <Icon
                              type="info"
                              ref={this.mouseSettingRef}
                              onMouseEnter={this.onEnterFilterSettingInfo}  
                              onMouseLeave={this.onLeaveFilterSettingInfo}
                              />
                        </th>
                        <th
                          style={{
                            display: 'table-cell',
                            verticalAlign: 'middle',
                            textAlign: 'right',
                            width: '35px'
                          }}
                        >
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {this.state.selectedConditions.map((item, index) => {
                        return (
                          <tr key={index} id={`react-autoql-condition-table-list-item-${index}`}>
                            <td className="react-autoql-condition-table-list-item">
                              {item.keyword}{' '}{`(${item.show_message})`}
                            </td>
                            <td>
                                <span>
                                  <Switch 
                                    onChange={() => this.handlePersistConditionToggle(item, index)} 
                                    checked={item.lock_flag}
                                    onColor={accentColorAssist(getThemeConfig(this.props.themeConfig).accentColor, 180)}
                                    onHandleColor={getThemeConfig(getThemeConfig(this.props.themeConfig)).accentColor}
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
                              id="react-autoql-remove-filter-container"
                              style={{
                                display: 'table-cell',
                                verticalAlign: 'middle',
                                textAlign: 'right',
                                width: '35px'
                              }}
                            >
                              <ReactTooltip
                                className="react-autoql-chart-tooltip"
                                id="react-autoql-remove-condition"
                                effect="solid"
                                html
                              />
                              <Icon
                                id="react-autoql-remove-filtered-condition-icon"
                                style={{
                                  paddingLeft: 5,
                                  color: 'red',
                                  cursor: 'pointer'
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
              Continue
            </Button>
          </div>
        </div>
      </ErrorBoundary>
    )
  }
}
