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
import { animateInputText } from '../../js/Util'
import { CustomScrollbars } from '../CustomScrollbars'

import './DataExplorerInput.scss'

const toSentenceCase = (str) => {
  return str.toLowerCase().charAt(0).toUpperCase() + str.slice(1)
}

export const formatSubjectName = (query) => {
  if (query.toLowerCase().startsWith('all ')) {
    query = query.substring(4)
  } else if (query.toLowerCase().startsWith('show ')) {
    query = query.substring(5)
  }

  return toSentenceCase(query)
}

export default class DataExplorerInput extends React.Component {
  constructor(props) {
    super(props)

    this.componentKey = uuid()
    this.userTypedValue = null
    this.userSelectedValue = null
    this.isDirty = false

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
    onClearInputClick: PropTypes.func,
    onSelection: PropTypes.func,
  }

  static defaultProps = {
    authentication: {},
    inputPlaceholder: 'Search subjects',
    onClearInputClick: () => {},
    onSelection: () => {},
  }

  componentDidMount = () => {
    this._isMounted = true
    this.fetchAllSubjects()
  }

  componentWillUnmount = () => {
    this._isMounted = false
    clearTimeout(this.autoCompleteTimer)
    clearTimeout(this.inputAnimationTimeout)
  }

  fetchAllSubjects = () => {
    fetchSubjectList({ ...this.props.authentication }).then((response) => {
      const subjects = response?.data?.data?.subjects || []
      let allSubjects = []
      if (subjects.length) {
        allSubjects = subjects
          .map((subject) => {
            return {
              ...subject,
              name: formatSubjectName(subject.query),
              type: DEConstants.SUBJECT_TYPE,
            }
          })
          .sort((a, b) => a.name.localeCompare(b.name))
      }

      if (this._isMounted) {
        this.setState({
          allSubjects,
        })
      }
    })
  }

  blurInput = () => {
    this.autoSuggest?.input?.blur()
  }

  subjectAutocompleteMatch = (input) => {
    if (input == '') {
      return []
    }

    var reg = new RegExp(`^${input.toLowerCase()}`)
    return this.state.allSubjects.filter((subject) => {
      const term = subject.name.toLowerCase()
      if (term.match(reg)) {
        return subject
      }
    })
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

  submitRawText = (text, skipQueryValidation) => {
    const subject = {
      type: 'text',
      name: text,
    }
    this.props.onSelection(subject, skipQueryValidation)
    this.setState({
      recentSuggestions: this.getNewRecentSuggestions(subject),
    })
  }

  animateTextAndSubmit = (text) => {
    animateInputText({
      text,
      inputRef: this.inputRef,
      callback: () => this.submitRawText(text, true),
    })
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
        this.isDirty = true
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
        this.submitRawText(this.state.inputValue)
      }
      this.blurInput()
    }
  }

  clearInput = () => {
    if (this._isMounted) {
      this.setState({ inputValue: '' })
      this.userTypedValue = null
      this.userSelectedValue = null
      this.props.onClearInputClick()
    }
  }

  userSelectedSuggestionHandler = (selectedItem) => {
    this.userSelectedValue = selectedItem
    if (selectedItem?.name && this._isMounted) {
      this.setState({ inputValue: selectedItem.name })
    }
  }

  requestSuggestions = () => {
    this.setState({ loadingAutocomplete: true })

    const value = this.userTypedValue
    const subjectMatches = this.subjectAutocompleteMatch(value) || []

    clearTimeout(this.autoCompleteTimer)
    this.autoCompleteTimer = setTimeout(() => {
      fetchVLAutocomplete({
        suggestion: value,
        ...this.props.authentication,
      })
        .then((response) => {
          // ----- remove this once the new endpoint is ready -----
          let vlMatches = []
          if (response?.data?.data?.matches?.length) {
            vlMatches = response.data.data.matches.map((match) => {
              return {
                ...match,
                name: `${match.keyword} (${match.show_message})`,
                type: DEConstants.VL_TYPE,
              }
            })
          }
          // -------------------------------------------------------

          const allMatches = [...subjectMatches, ...vlMatches]

          this.setState({
            suggestions: allMatches,
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
    if (!value || !this.isDirty) {
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
        title: 'Recent',
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

  renderSuggestionsContainer = ({ containerProps, children }) => {
    let maxHeight = 250
    const dataExplorerHeight = this.props.dataExplorerRef?.clientHeight - 200
    if (!isNaN(dataExplorerHeight) && dataExplorerHeight > 250) {
      maxHeight = dataExplorerHeight
    }

    return (
      <div {...containerProps}>
        <div className="react-autoql-data-explorer-suggestion-container">
          <CustomScrollbars
            autoHeight
            autoHeightMin={0}
            autoHeightMax={maxHeight}
            autoHide={false}
          >
            {children}
          </CustomScrollbars>
        </div>
      </div>
    )
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
            className="react-autoql-data-explorer-autosuggest"
            onSuggestionsFetchRequested={this.onSuggestionsFetchRequested}
            onSuggestionsClearRequested={this.onSuggestionsClearRequested}
            getSuggestionValue={this.userSelectedSuggestionHandler}
            renderSuggestionsContainer={this.renderSuggestionsContainer}
            suggestions={this.getSuggestions()}
            multiSection={true}
            renderSectionTitle={this.renderSectionTitle}
            getSectionSuggestions={this.getSectionSuggestions}
            shouldRenderSuggestions={() => true}
            ref={(ref) => (this.autoSuggest = ref)}
            renderSuggestion={this.renderSuggestion}
            focusInputOnSuggestionClick={false}
            inputProps={{
              ref: (r) => (this.inputRef = r),
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
