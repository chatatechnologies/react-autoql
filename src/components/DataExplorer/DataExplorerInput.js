import React from 'react'
import PropTypes from 'prop-types'
import ErrorBoundary from '../../containers/ErrorHOC/ErrorHOC'
import Autosuggest from 'react-autosuggest'
import { v4 as uuid } from 'uuid'
import _cloneDeep from 'lodash.clonedeep'
import _isEqual from 'lodash.isequal'

import DEConstants from './constants'
import { authenticationType } from '../../props/types'
import { fetchVLAutocomplete, fetchSubjectList } from '../../js/queryService'
import { Icon } from '../Icon'
import { TopicName } from './TopicName'

import './DataExplorerInput.scss'

export default class DataExplorerInput extends React.Component {
  constructor(props) {
    super(props)

    this.componentKey = uuid()
    this.userTypedValue = null
    this.userSelectedValue = null

    this.state = {
      inputValue: '',
      loadingAutocomplete: false,
      recentSuggestions: [],
      suggestions: [],
      allSubjects: [],
    }
  }

  static propTypes = {
    authentication: authenticationType,
    inputPlaceholder: PropTypes.string,
    onSelection: PropTypes.func,
  }

  static defaultProps = {
    authentication: {},
    // inputPlaceholder: 'Search subjects or values...',
    inputPlaceholder: 'Search subjects...',
    onSelection: () => {},
  }

  componentDidMount = () => {
    this._isMounted = true
    this.fetchAllSubjects()
  }

  componentWillUnmount = () => {
    this._isMounted = false
    clearTimeout(this.autoCompleteTimer)
  }

  fetchAllSubjects = () => {
    fetchSubjectList({ ...this.props.authentication }).then((response) => {
      const allSubjects = response?.data?.data?.subjects || []

      if (this._isMounted) {
        this.setState({
          allSubjects,
        })
      }
    })
  }

  focusInput = () => {
    this.autoSuggest?.input?.focus()
  }

  blurInput = () => {
    this.autoSuggest?.input?.blur()
  }

  getNewRecentSuggestions = (subject) => {
    const recentSuggestions = _cloneDeep(this.state.recentSuggestions)

    // If value already exists in recent list, move it to the top
    const index = recentSuggestions.findIndex((subj) => _isEqual(subj, subject))
    if (index > -1) {
      recentSuggestions.splice(index, 1)
    }

    // Maximum length of list should be 5
    if (recentSuggestions.length === 5) {
      recentSuggestions.splice(-1)
    }

    recentSuggestions.unshift(subject)
    return recentSuggestions
  }

  selectSubject = (subject) => {
    if (this._isMounted) {
      this.userSelectedValue = null
      this.setState({
        inputValue: subject.name,
        recentSuggestions: this.getNewRecentSuggestions(subject),
      })
      this.props.onSelection(subject)
    }
  }

  onInputChange = (e) => {
    if (this._isMounted) {
      if (
        !!this.userSelectedValue &&
        (e.key === 'ArrowDown' || e.key === 'ArrowUp')
      ) {
        // keyup or keydown
        return // return to let the component handle it...
      }

      if ((e?.target?.value || e?.target?.value === '') && e.key !== 'Enter') {
        this.userSelectedValue = null
        this.userTypedValue = e.target.value
        this.setState({ inputValue: e.target.value })
      } else {
        // User clicked on autosuggest item
        this.selectSubject(this.userSelectedValue)
      }
    }
  }

  onInputFocus = () => {
    if (this._isMounted) {
      this.setState({ inputFocused: true })
    }
  }

  onInputBlur = () => {
    if (this._isMounted) {
      this.setState({ inputFocused: false })
    }
  }

  onKeyPress = (e) => {
    if (e.key == 'Enter') {
      if (this.userSelectedValue) {
        this.selectSubject(this.userSelectedValue)
      } else if (!!this.state.inputValue) {
        const subject = {
          type: 'text',
          name: this.state.inputValue,
        }
        this.props.onSelection(subject)
        this.setState({
          recentSuggestions: this.getNewRecentSuggestions(subject),
        })
      }
      this.blurInput()
    }
  }

  clearInput = () => {
    if (this._isMounted) {
      this.setState({ inputValue: '' })
      this.userTypedValue = null
      this.userSelectedValue = null
    }
  }

  userSelectedSuggestionHandler = (selectedItem) => {
    this.userSelectedValue = selectedItem
    if (selectedItem?.name && this._isMounted) {
      this.setState({ inputValue: selectedItem.name })
    }
  }

  requestSuggestions = (value) => {
    this.setState({ loadingAutocomplete: true })

    clearTimeout(this.autoCompleteTimer)
    this.autoCompleteTimer = setTimeout(() => {
      fetchVLAutocomplete({
        suggestion: value,
        ...this.props.authentication,
      })
        .then((oldResponse) => {
          // ----- remove this once the new endpoint is ready -----
          const response = _cloneDeep(oldResponse)
          if (response?.data?.data?.matches) {
            response.data.data.matches = response.data.data.matches.map(
              (match) => {
                return {
                  ...match,
                  name: `${match.keyword} (${match.show_message})`,
                  type: DEConstants.VL_TYPE,
                }
              }
            )
          }

          // -------------------------------------------------------
          const sortedMatches = _cloneDeep(response?.data?.data?.matches)?.sort(
            (a, b) => b.name.length - a.name.length
          )

          this.setState({
            suggestions: sortedMatches || [],
            loadingAutocomplete: false,
          })
        })
        .catch((error) => {
          console.error(error)
          this.setState({ suggestions: [], loadingAutocomplete: false })
        })
    }, 300)
  }

  onSuggestionsFetchRequested = ({ value }) => {
    if (!value) {
      return
    }

    if (this._isMounted) {
      this.requestSuggestions(value)
    }
  }

  onSuggestionsClearRequested = () => {
    if (this._isMounted) {
      this.setState({
        suggestions: [],
      })
    }
  }

  renderSectionTitle = (section) => {
    return (
      <>
        <strong>{section.title}</strong>
        {section.emptyState ? (
          <div className="data-explorer-no-suggestions">
            <em>No results</em>
          </div>
        ) : null}
      </>
    )
  }

  getSectionSuggestions = (section) => {
    return section.suggestions
  }

  hasNoSuggestions = () => {
    return (
      !this.state.suggestions?.length &&
      !this.state.loadingAutocomplete &&
      !!this.userTypedValue
    )
  }

  getSuggestions = () => {
    const sections = []
    const hasRecentSuggestions = !!this.state.recentSuggestions?.length
    const inputIsEmpty = !this.userTypedValue
    const doneLoading = !this.state.loadingAutocomplete
    const hasSuggestions = !!this.state.suggestions?.length && doneLoading
    const noSuggestions = !this.state.suggestions?.length && doneLoading

    // Recently used
    if (hasRecentSuggestions) {
      sections.push({
        title: 'Recently used',
        suggestions: this.state.recentSuggestions,
      })
    }

    // Suggestion list
    if (inputIsEmpty) {
      sections.push({
        title: 'All Subjects',
        suggestions: this.state.allSubjects,
      })
    } else if (hasSuggestions) {
      sections.push({
        title: `Related to "${this.userTypedValue}"`,
        suggestions: this.state.suggestions,
      })
    } else if (noSuggestions) {
      sections.push({
        title: `Related to "${this.userTypedValue}"`,
        suggestions: [{ name: '' }],
        emptyState: true,
      })
    }

    return sections
  }

  renderSuggestion = (suggestion) => {
    return <TopicName topic={suggestion} />
  }

  renderInputIcon = () => {
    return (
      <div className="chat-bar-input-icon">
        <Icon
          type="search"
          style={{
            width: '19px',
            height: '20px',
            color: 'var(--react-autoql-text-color-placeholder)',
          }}
        />
      </div>
    )
  }

  renderClearInputBtn = () => {
    return (
      <div
        className={`chat-bar-clear-btn ${
          this.state.inputValue ? 'visible' : ''
        }`}
        data-for="explore-queries-tooltips"
        data-tip="Clear Search"
      >
        <Icon type="close" onClick={this.clearInput} />
      </div>
    )
  }

  render = () => {
    return (
      <ErrorBoundary>
        <div
          className={`react-autoql-chatbar-input-container data-explorer ${
            this.hasNoSuggestions() ? 'no-suggestions' : ''
          }`}
          data-test="data-explorer-autocomplete"
        >
          <Autosuggest
            id={`data-explorer-autosuggest-${this.componentKey}`}
            onSuggestionsFetchRequested={this.onSuggestionsFetchRequested}
            onSuggestionsClearRequested={this.onSuggestionsClearRequested}
            getSuggestionValue={this.userSelectedSuggestionHandler}
            suggestions={this.getSuggestions()}
            multiSection={true}
            renderSectionTitle={this.renderSectionTitle}
            getSectionSuggestions={this.getSectionSuggestions}
            shouldRenderSuggestions={() => true}
            ref={(ref) => (this.autoSuggest = ref)}
            renderSuggestion={this.renderSuggestion}
            focusInputOnSuggestionClick={false}
            inputProps={{
              className: `react-autoql-chatbar-input`,
              placeholder: this.props.inputPlaceholder,
              'data-test': 'data-explorer-input-component',
              value: this.state.inputValue,
              onChange: this.onInputChange,
              onKeyPress: this.onKeyPress,
              onFocus: this.onInputFocus,
              onBlur: this.onInputBlur,
            }}
          />
          {this.renderInputIcon()}
          {this.renderClearInputBtn()}
        </div>
      </ErrorBoundary>
    )
  }
}
