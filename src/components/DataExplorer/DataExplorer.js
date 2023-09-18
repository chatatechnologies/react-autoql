import React from 'react'
import PropTypes from 'prop-types'
import { Tooltip } from '../Tooltip'
import { v4 as uuid } from 'uuid'
import { DataExplorerTypes } from 'autoql-fe-utils'

import ErrorBoundary from '../../containers/ErrorHOC/ErrorHOC'
import DataExplorerInput from './DataExplorerInput'
import DataPreview from './DataPreview'

import { QuerySuggestionList } from '../ExploreQueries'
import { authenticationType, dataFormattingType } from '../../props/types'
import { CustomScrollbars } from '../CustomScrollbars'
import { dataFormattingDefault } from '../../props/defaults'
import { Icon } from '../Icon'

import './DataExplorer.scss'

export default class DataExplorer extends React.Component {
  constructor(props) {
    super(props)

    this.querySuggestionsKey = uuid()

    this.state = {
      activeTopicType: null,
      selectedSubject: null,
      selectedVL: null,
      isQuerySuggestionSectionVisible: true,
      isQuerySuggestionCollapsed: true,
      isDataPreviewCollapsed: false,
    }
  }

  static propTypes = {
    authentication: authenticationType,
    dataFormatting: dataFormattingType,
    shouldRender: PropTypes.bool,
    inputPlaceholder: PropTypes.string,
    introMessage: PropTypes.oneOfType([PropTypes.string, PropTypes.element]),

    executeQuery: PropTypes.func,
    isSmallScreen: PropTypes.bool,
  }

  static defaultProps = {
    authentication: {},
    dataFormatting: dataFormattingDefault,
    shouldRender: true,
    inputPlaceholder: undefined,
    introMessage: undefined,
    rebuildTooltips: undefined,
    executeQuery: () => {},
    isSmallScreen: false,
  }

  componentDidMount = () => {
    this._isMounted = true
  }

  componentWillUnmount = () => {
    this._isMounted = false
  }

  onInputSelection = (listItem, skipQueryValidation) => {
    if (listItem?.type === DataExplorerTypes.SUBJECT_TYPE) {
      this.setState({
        selectedSubject: listItem,
        selectedKeywords: null,
        selectedVL: null,
        activeTopicType: listItem?.type,
        skipQueryValidation: true,
      })
    } else if (listItem?.type === DataExplorerTypes.VL_TYPE) {
      this.setState({
        selectedVL: listItem,
        selectedKeywords: null,
        activeTopicType: listItem?.type,
        skipQueryValidation: true,
      })
    } else if (listItem?.type === 'text') {
      this.setState({
        selectedSubject: null,
        selectedVL: null,
        selectedKeywords: listItem,
        activeTopicType: listItem?.type,
        skipQueryValidation,
      })
    }

    this.inputRef?.blurInput()
  }

  renderIntroMessage = () => {
    return (
      <div className='data-explorer-intro-message'>
        <h2>
          Welcome to <Icon type='data-search' />
          Data Explorer
        </h2>
        {this.props.introMessage ? (
          <p>{this.props.introMessage}</p>
        ) : (
          <div>
            <p>Explore your data and discover what you can ask AutoQL. Simply enter a term or topic above and:</p>
            <div className='intro-message-list-container'>
              <div>
                <p>
                  <Icon type='table' /> Preview available data in a snapshot
                </p>
                <p>
                  <Icon type='abacus' /> Explore data structure and column types
                </p>
                <p>
                  <Icon type='react-autoql-bubbles-outlined' /> View a variety of query suggestions
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  animateDETextAndSubmit = (text) => {
    if (this.inputRef?._isMounted) {
      this.inputRef.animateTextAndSubmit(text)
    }
  }

  onValidationSuggestionClick = ({ query, userSelection }) => {
    this.querySuggestionsKey = uuid()
    this.animateDETextAndSubmit(query)
    this.setState({ userSelection })
  }

  reloadScrollbars = () => {
    this.querySuggestionList?.updateScrollbars()
  }

  renderDataPreview = () => {
    if (!this.state.selectedSubject || this.state.activeTopicType !== DataExplorerTypes.SUBJECT_TYPE) {
      return null
    }

    return (
      <div className='data-explorer-section data-preview-section'>
        <DataPreview
          authentication={this.props.authentication}
          dataFormatting={this.props.dataFormatting}
          subject={this.state.selectedSubject}
          shouldRender={this.props.shouldRender}
          dataExplorerRef={this.dataExplorerPage}
          isCollapsed={this.props.isSmallScreen ? this.state.isDataPreviewCollapsed : undefined}
          tooltipID={this.props.tooltipID}
          onIsCollapsedChange={(isCollapsed) => {
            this.setState({
              isDataPreviewCollapsed: isCollapsed,
              isQuerySuggestionCollapsed: isCollapsed ? this.state.isQuerySuggestionCollapsed : true,
            })
          }}
          defaultCollapsed={this.props.isSmallScreen ? false : undefined}
        />
      </div>
    )
  }

  renderQuerySuggestionCardTitle = (selectedTopic) => {
    return (
      <div className='react-autoql-data-explorer-title-text'>
        <span>Query Builder</span>
      </div>
    )
  }

  renderQuerySuggestions = () => {
    const selectedTopic = this.getSelectedTopic()
    if (!selectedTopic) {
      return null
    }

    return (
      <div className='data-explorer-section query-suggestions'>
        {this.renderQuerySuggestionCardTitle(selectedTopic)}
        <div className='data-explorer-query-suggestion-list'>
          <QuerySuggestionList
            ref={(r) => (this.querySuggestionList = r)}
            key={this.querySuggestionsKey}
            authentication={this.props.authentication}
            context={this.state.selectedSubject?.name}
            valueLabel={this.state.selectedVL}
            searchText={this.state.selectedKeywords?.display_name}
            selectedType={this.state.activeTopicType}
            executeQuery={this.props.executeQuery}
            skipQueryValidation={this.state.skipQueryValidation}
            userSelection={this.state.userSelection}
            onValidationSuggestionClick={this.onValidationSuggestionClick}
            onSuggestionListResponse={() => {
              this.reloadScrollbars()
              this.setState({ skipQueryValidation: false })
            }}
            scope={this.props.scope}
          />
        </div>
      </div>
    )
  }

  getSelectedTopic = () => {
    const activeType = this.state.activeTopicType
    if (activeType === DataExplorerTypes.SUBJECT_TYPE) {
      return this.state.selectedSubject
    }
    if (activeType === DataExplorerTypes.VL_TYPE) {
      return this.state.selectedVL
    }
    if (activeType === 'text') {
      return this.state.selectedKeywords
    }

    return null
  }

  clearContent = () => {
    this.setState({
      activeTopicType: null,
      selectedSubject: null,
      selectedVL: null,
      selectedKeywords: null,
    })
  }

  renderDataExplorerContent = () => {
    if (!this.getSelectedTopic()) {
      return this.renderIntroMessage()
    }

    return (
      <div className='data-explorer-result-container'>
        <CustomScrollbars>
          <div
            key={`data-explorer-sections-container-${this.state.selectedSubject?.name}`}
            className='data-explorer-sections-container'
          >
            <div className='react-autoql-data-explorer-selected-subject-title'>
              <Icon style={{ fontSize: '20px' }} type='book' /> {this.state.selectedSubject?.display_name}
            </div>
            {this.renderDataPreview()}
            {this.renderQuerySuggestions()}
          </div>
        </CustomScrollbars>
      </div>
    )
  }

  formatColumnType = (type) => {
    switch (type) {
      case 'DATE': {
        return (
          <span>
            <Icon type='calendar' /> Date
          </span>
        )
      }
      case 'DATE_STRING': {
        return (
          <span>
            <Icon type='calendar' /> Date
          </span>
        )
      }
      case 'STRING': {
        return (
          <span>
            <Icon type='note' /> Description
          </span>
        )
      }
      case 'DOLLAR_AMT': {
        return (
          <span>
            <Icon type='money' /> Currency
          </span>
        )
      }
      case 'QUANTITY': {
        return (
          <span>
            <Icon type='abacus' /> Quantity
          </span>
        )
      }
    }
  }

  renderColumnQuerySuggestions = (column) => {
    const subject = this.state.selectedSubject?.display_name || ''
    if (!subject) {
      return null
    }

    const lowerCaseSubject = subject.toLowerCase()
    const titleCaseSubject = lowerCaseSubject[0].toUpperCase() + lowerCaseSubject.substring(1)
    const lowerCaseColumn = column?.display_name?.toLowerCase()
    const suggestions = []

    if (column.type === 'STRING') {
      suggestions.push(`Show ${lowerCaseSubject} by ${lowerCaseColumn}`)
      suggestions.push(`List all ${lowerCaseColumn}`)
    }

    if (column.type === 'DATE') {
      suggestions.push(`${titleCaseSubject} by month this year`)
      suggestions.push(`Show ${lowerCaseSubject} in the last 2 weeks`)
    }

    if (column.type === 'DATE_STRING') {
      suggestions.push(`Show ${lowerCaseSubject} by ${lowerCaseColumn}`)
    }

    if (column.type === 'DOLLAR_AMT') {
      suggestions.push(`Total ${lowerCaseColumn} ${lowerCaseSubject}`)
      suggestions.push(`Highest ${lowerCaseColumn} ${lowerCaseSubject}`)
    }

    if (column.type === 'QUANTITY') {
      suggestions.push(`Average ${lowerCaseColumn} ${lowerCaseSubject}`)
      suggestions.push(`Lowest ${lowerCaseColumn} ${lowerCaseSubject}`)
    }

    return (
      <>
        {suggestions.map((query, i) => {
          return (
            <div key={i} onClick={() => this.props.executeQuery(query)} className='data-explorer-tooltip-query'>
              <Icon type='react-autoql-bubbles-outlined' /> {query}
            </div>
          )
        })}
      </>
    )
  }

  renderHeaderTooltipContent = (dataTip = '') => {
    const column = JSON.parse(dataTip)
    if (!column) {
      return null
    }

    const formattedType = this.formatColumnType(column?.type)

    return (
      <div>
        <div className='data-explorer-tooltip-title'>{column?.display_name}</div>
        {!!formattedType && <div className='data-explorer-tooltip-section'>{formattedType}</div>}
        {/* Disable this until we have a better way to get query suggestions for columns
        <div className="data-explorer-tooltip-section">
          <strong>Query suggestions:</strong>
          <br />
          {this.renderColumnQuerySuggestions(column)}
        </div> */}
      </div>
    )
  }

  render = () => {
    let display
    if (!this.props.shouldRender) {
      display = 'none'
    }

    return (
      <div
        ref={(r) => (this.dataExplorerPage = r)}
        className='data-explorer-page-container'
        data-test='data-explorer-tab'
        style={{ display }}
      >
        <ErrorBoundary>
          <DataExplorerInput
            ref={(r) => (this.inputRef = r)}
            authentication={this.props.authentication}
            inputPlaceholder={this.props.inputPlaceholder}
            onSelection={this.onInputSelection}
            dataExplorerRef={this.dataExplorerPage}
            onClearInputClick={this.clearContent}
            tooltipID={this.props.tooltipID}
          />
          {this.renderDataExplorerContent()}
          {!this.props.tooltipID && (
            <Tooltip
              className='data-preview-tooltip'
              id='data-preview-tooltip'
              place='right'
              delayHide={200}
              delayUpdate={200}
              effect='solid'
              getContent={this.renderHeaderTooltipContent}
              clickable
            />
          )}
        </ErrorBoundary>
      </div>
    )
  }
}
