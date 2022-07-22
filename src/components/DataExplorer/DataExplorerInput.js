import React from 'react'
import PropTypes from 'prop-types'
import ErrorBoundary from '../../containers/ErrorHOC/ErrorHOC'
import Autosuggest from 'react-autosuggest'
import { v4 as uuid } from 'uuid'
import _cloneDeep from 'lodash.clonedeep'

import { authenticationType } from '../../props/types'
import { fetchVLAutocomplete } from '../../js/queryService'
import { Icon } from '../Icon'

const mockSubjectRequest = () => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve([
        'Sales',
        'Bills',
        'Accounts Receivable',
        'Accounts Payable',
        'Customers',
      ])
    }, 1000)
  })
}

export default class DataExplorerInput extends React.Component {
  constructor(props) {
    super(props)

    this.componentKey = uuid()
    this.userSelectedValue = null
    this.subjectType = 'subject'
    this.VLType = 'VL'

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
    inputPlaceholder: 'Find a subject...',
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
    mockSubjectRequest().then((subjects) => {
      const allSubjects = subjects?.length
        ? subjects.map((subject) => ({
            name: subject,
            type: this.subjectType,
          }))
        : []

      if (this._isMounted) {
        this.setState({
          allSubjects,
        })
      }
    })
  }

  focusInput = () => {
    this.inputRef?.focus()
  }

  getNewRecentSuggestions = (subject) => {
    const recentSuggestions = _cloneDeep(this.state.recentSuggestions)

    // If value already exists in recent list, move it to the top
    const index = recentSuggestions.findIndex(
      (subj) => subj.name === subject.name
    )
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
        inputValue: '',
        recentSuggestions: this.getNewRecentSuggestions(subject),
      })
      this.props.onSelection(subject)
    }
  }

  onInputChange = (e) => {
    if (this._isMounted) {
      if (!!this.userSelectedValue && (e.keyCode === 38 || e.keyCode === 40)) {
        // keyup or keydown
        // return // return to let the component handle it...
        // DO NOTHING
      }

      if (e.key === 'Enter') {
        console.log('enter pressed')
      }

      if (e?.target?.value || e?.target?.value === '') {
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
    console.log(
      'on key press.. this is the user selected value:',
      this.userSelectedValue
    )
    if (e.key == 'Enter' && this.userSelectedValue) {
      console.log('just selected by hitting enter')
      this.selectSubject(this.userSelectedValue)
    }
  }

  clearInput = () => {
    if (this._isMounted) {
      this.setState({ inputValue: '' })
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
                  type: this.VLType,
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
      !!this.state.inputValue
    )
  }

  getSuggestions = () => {
    const sections = []
    const hasRecentSuggestions = !!this.state.recentSuggestions?.length
    const inputIsEmpty = !this.state.inputValue
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
        title: `Related to "${this.state.inputValue}"`,
        suggestions: this.state.suggestions,
      })
    } else if (noSuggestions) {
      sections.push({
        title: `Related to "${this.state.inputValue}"`,
        suggestions: [{ name: '' }],
        emptyState: true,
      })
    }

    return sections
  }

  renderSuggestion = (suggestion) => {
    let iconType = null
    if (suggestion.type === this.subjectType) {
      iconType = 'book'
    } else if (suggestion.type === this.VLType) {
      iconType = 'bookmark'
    }

    return (
      <span>
        <Icon className="data-explorer-autocomplete-icon" type={iconType} />
        {suggestion.name}
      </span>
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
