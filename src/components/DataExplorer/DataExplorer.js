import React from 'react'
import PropTypes from 'prop-types'
import ReactTooltip from 'react-tooltip'
import { v4 as uuid } from 'uuid'

import ErrorBoundary from '../../containers/ErrorHOC/ErrorHOC'
import DataExplorerInput from './DataExplorerInput'
import DataPreview from './DataPreview'
import DEConstants from './constants'

import { QuerySuggestionList } from '../ExploreQueries'
import { authenticationType, dataFormattingType } from '../../props/types'
import { CustomScrollbars } from '../CustomScrollbars'
import { TopicName } from './TopicName'
import { Icon } from '../Icon'
import { Card } from '../Card'

import './DataExplorer.scss'
import { dataFormattingDefault } from '../../props/defaults'

export default class DataExplorer extends React.Component {
  constructor(props) {
    super(props)

    this.querySuggestionsKey = uuid()

    this.state = {
      activeTopicType: null,
      selectedSubject: null,
      selectedVL: null,
      isQuerySuggestionSectionVisible: true,
      QuerySuggestionListToggleCollapseCounter: 0,
      DataPreviewToggleCollapseCounter: 0,
    }
  }

  static propTypes = {
    authentication: authenticationType,
    dataFormatting: dataFormattingType,
    shouldRender: PropTypes.bool,
    inputPlaceholder: PropTypes.string,
    introMessage: PropTypes.oneOfType([PropTypes.string, PropTypes.element]),
    rebuildTooltips: PropTypes.func,
    executeQuery: PropTypes.func,
  }

  static defaultProps = {
    authentication: {},
    dataFormatting: dataFormattingDefault,
    shouldRender: true,
    inputPlaceholder: undefined,
    introMessage: undefined,
    rebuildTooltips: undefined,
    executeQuery: () => {},
  }

  componentDidMount = () => {
    this._isMounted = true
  }

  componentWillUnmount = () => {
    this._isMounted = false
  }

  onInputSelection = (listItem, skipQueryValidation) => {
    if (listItem?.type === DEConstants.SUBJECT_TYPE) {
      this.setState({
        selectedSubject: listItem,
        selectedKeywords: null,
        activeTopicType: listItem?.type,
        skipQueryValidation: true,
      })
    } else if (listItem?.type === DEConstants.VL_TYPE) {
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
                {/* <p><Icon /> Explore value label categories</p> */}
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

  onValidationSuggestionClick = (text) => {
    this.querySuggestionsKey = uuid()
    this.animateDETextAndSubmit(text)
  }

  renderDataPreview = () => {
    if (!this.state.selectedSubject || this.state.activeTopicType !== DEConstants.SUBJECT_TYPE) {
      return null
    }

    return (
      <div className='data-explorer-section data-preview-section'>
        <DataPreview
          authentication={this.props.authentication}
          dataFormatting={this.props.dataFormatting}
          subject={this.state.selectedSubject}
          shouldRender={this.props.shouldRender}
          rebuildTooltips={this.props.rebuildTooltips}
          dataExplorerRef={this.dataExplorerPage}
          toggleCollapseCounter={this.props.isSmallScreen ? this.state.DataPreviewToggleCollapseCounter : undefined}
          onCollapse={() => {
            this.setState({
              QuerySuggestionListToggleCollapseCounter: this.state.QuerySuggestionListToggleCollapseCounter + 1,
            })
          }}
          defaultCollapsed={this.props.isSmallScreen ? false : undefined}
        />
      </div>
    )
  }

  renderVLSubjectList = () => {
    if (!this.state.selectedVL || this.activeTopicType !== DEConstants.VL_TYPE) {
      return null
    }

    return (
      <div>
        <h2>List of subjects for VL</h2>
        <p>list of subjects goes here</p>
      </div>
    )
  }

  renderQuerySuggestionCardTitle = (selectedTopic) => {
    return (
      <div>
        <Icon style={{ fontSize: '20px' }} type='react-autoql-bubbles-outlined' /> Query Suggestions for "
        {selectedTopic?.display_name}"
      </div>
    )
  }

  renderQuerySuggestions = () => {
    const selectedTopic = this.getSelectedTopic()
    if (!selectedTopic) {
      return null
    }

    let topicText = selectedTopic.display_name
    if (selectedTopic.type === DEConstants.SUBJECT_TYPE) {
      topicText = selectedTopic.name
    }
    const isDefaultCollapsed =
      !this.state.selectedSubject || this.state.activeTopicType !== DEConstants.SUBJECT_TYPE ? false : true
    return (
      <div className='data-explorer-section query-suggestions'>
        <Card
          title={this.renderQuerySuggestionCardTitle(selectedTopic)}
          subtitle={<em>Click on a query to run it in Data Messenger</em>}
          defaultCollapsed={this.props.isSmallScreen ? isDefaultCollapsed : undefined}
          toggleCollapseCounter={
            this.props.isSmallScreen ? this.state.QuerySuggestionListToggleCollapseCounter : undefined
          }
          onCollapse={() => {
            this.setState({
              DataPreviewToggleCollapseCounter: this.state.DataPreviewToggleCollapseCounter + 1,
            })
          }}
        >
          <div className='data-explorer-query-suggestion-list'>
            <QuerySuggestionList
              key={this.querySuggestionsKey}
              authentication={this.props.authentication}
              topicText={topicText}
              topic={selectedTopic}
              executeQuery={this.props.executeQuery}
              skipQueryValidation={this.state.skipQueryValidation}
              onValidationSuggestionClick={this.onValidationSuggestionClick}
              onSuggestionListResponse={() => this.setState({ skipQueryValidation: false })}
            />
          </div>
        </Card>
      </div>
    )
  }

  getSelectedTopic = () => {
    const activeType = this.state.activeTopicType
    if (activeType === DEConstants.SUBJECT_TYPE) {
      return this.state.selectedSubject
    }
    if (activeType === DEConstants.VL_TYPE) {
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

  renderSelectionTitle = () => {
    const selectedTopic = this.getSelectedTopic()
    if (!selectedTopic) {
      return null
    }

    return (
      <div className='data-explorer-title exploring-title'>
        <div
          key={`data-explorer-title exploring-title-${selectedTopic.name}`}
          className='data-explorer-title-animated-container'
        >
          Exploring "<TopicName topic={selectedTopic} />"
        </div>
      </div>
    )
  }

  renderDataExplorerContent = () => {
    if (!this.getSelectedTopic()) {
      return this.renderIntroMessage()
    }

    return (
      <div className='data-explorer-result-container'>
        <CustomScrollbars autoHide={false}>
          <div
            key={`data-explorer-sections-container-${this.state.selectedSubject?.name}`}
            className='data-explorer-sections-container'
          >
            {this.renderDataPreview()}
            {/* {this.renderVLSubjectList()} */}
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
          />
          {this.renderSelectionTitle()}
          {this.renderDataExplorerContent()}
          <ReactTooltip
            className='data-preview-tooltip'
            id='data-preview-tooltip'
            place='right'
            delayHide={200}
            delayUpdate={200}
            effect='solid'
            getContent={this.renderHeaderTooltipContent}
            clickable
          />
        </ErrorBoundary>
      </div>
    )
  }
}
