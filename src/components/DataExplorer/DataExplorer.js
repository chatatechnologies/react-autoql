import React from 'react'
import PropTypes from 'prop-types'
import ErrorBoundary from '../../containers/ErrorHOC/ErrorHOC'
import ReactTooltip from 'react-tooltip'
import _isEqual from 'lodash.isequal'

import DataExplorerInput from './DataExplorerInput'
import DataPreview from './DataPreview'
import DEConstants from './constants'
import { CustomScrollbars } from '../CustomScrollbars'
import { authenticationType } from '../../props/types'
import { QuerySuggestionList } from '../ExploreQueries'
import { LoadingDots } from '../LoadingDots'
import { Spinner } from '../Spinner'
import { Icon } from '../Icon'
import { TopicName } from './TopicName'
import { Chip } from '../Chip'
import { Card } from '../Card'

import {
  isColumnDateType,
  isColumnNumberType,
  isColumnStringType,
} from '../QueryOutput/columnHelpers'

import './DataExplorer.scss'

export default class DataExplorer extends React.Component {
  constructor(props) {
    super(props)
    this.state = {
      activeTopicType: null,
      selectedSubject: null,
      selectedVL: null,
      isQuerySuggestionSectionVisible: true,
    }
  }

  static propTypes = {
    authentication: authenticationType,
    shouldRender: PropTypes.bool,
    inputPlaceholder: PropTypes.string,
    rebuildTooltips: PropTypes.func,
  }

  static defaultProps = {
    authentication: {},
    shouldRender: true,
    inputPlaceholder: undefined,
    rebuildTooltips: () => {},
  }

  componentDidMount = () => {
    this._isMounted = true
  }

  componentDidUpdate = (prevProps, prevState) => {}

  componentWillUnmount = () => {
    this._isMounted = false
  }

  onInputSelection = (listItem) => {
    if (listItem?.type === DEConstants.SUBJECT_TYPE) {
      this.setState({
        selectedSubject: listItem,
        selectedKeywords: null,
        activeTopicType: listItem?.type,
      })
    } else if (listItem?.type === DEConstants.VL_TYPE) {
      this.setState({
        selectedVL: listItem,
        selectedKeywords: null,
        activeTopicType: listItem?.type,
      })
    } else if (listItem?.type === 'text') {
      this.setState({
        selectedSubject: null,
        selectedVL: null,
        selectedKeywords: listItem,
        activeTopicType: listItem?.type,
      })
    }

    this.inputRef?.blurInput()
  }

  renderIntroMessage = () => {
    return (
      <div className="data-explorer-intro-message">
        <h2>
          Welcome to <Icon type="data-search" />
          Data Explorer
        </h2>
        {this.props.introMessage ? (
          <p>{this.props.introMessage}</p>
        ) : (
          <div>
            <p>
              Explore your data and discover what you can ask AutoQL. Simply
              enter a topic in the search bar above and:
            </p>
            <div className="intro-message-list-container">
              <div>
                <p>
                  <Icon type="table" /> Preview available data in a snapshot
                </p>
                <p>
                  <Icon type="abacus" /> Explore data structure and column types
                </p>
                <p>
                  <Icon type="react-autoql-bubbles-outlined" /> View a variety
                  of query suggestions
                </p>
                {/* <p><Icon /> Explore value label categories</p> */}
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  onChipDelete = (topic) => {
    if (topic?.type === DEConstants.SUBJECT_TYPE) {
      this.setState({ selectedSubject: null })
    } else if (topic?.type === DEConstants.VL_TYPE) {
      this.setState({ selectedVL: null })
    }
  }

  onChipClick = (topic) => {
    if (topic?.type !== this.state.activeTopicType) {
      this.setState({ activeTopicType: topic?.type })
    }
  }

  renderTopicChip = (topic) => {
    if (!topic) {
      return null
    }

    return (
      <Chip
        onDelete={() => this.onChipDelete(topic)}
        onClick={() => this.onChipClick(topic)}
        selected={this.state.activeTopicType === topic.type}
      >
        <TopicName topic={topic} />
      </Chip>
    )
  }

  renderDataPreview = () => {
    if (
      !this.state.selectedSubject ||
      this.state.activeTopicType !== DEConstants.SUBJECT_TYPE
    ) {
      return null
    }

    return (
      <div className="data-explorer-section data-preview-section">
        <DataPreview
          authentication={this.props.authentication}
          themeConfig={this.props.themeConfig}
          dataFormatting={this.props.dataFormatting}
          subject={this.state.selectedSubject}
          shouldRender={this.props.shouldRender}
          rebuildTooltips={this.props.rebuildTooltips}
        />
      </div>
    )
  }

  renderVLSubjectList = () => {
    if (
      !this.state.selectedVL ||
      this.activeTopicType !== DEConstants.VL_TYPE
    ) {
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
        <Icon
          style={{ fontSize: '20px' }}
          type="react-autoql-bubbles-outlined"
        />{' '}
        Query Suggestions for "{selectedTopic?.name}"
      </div>
    )
  }

  renderQuerySuggestions = () => {
    const selectedTopic = this.getSelectedTopic()
    if (!selectedTopic) {
      return null
    }

    return (
      <div className="data-explorer-section query-suggestions">
        <Card
          title={this.renderQuerySuggestionCardTitle(selectedTopic)}
          subtitle={<em>Click on a query to run it in Data Messenger</em>}
        >
          <div className="data-explorer-query-suggestion-list">
            <QuerySuggestionList
              authentication={this.props.authentication}
              topicText={selectedTopic?.name}
              executeQuery={this.props.executeQuery}
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
    this.inputRef?.clearInput()
  }

  renderSelectionTitle = () => {
    const selectedTopic = this.getSelectedTopic()
    if (!selectedTopic) {
      return null
    }

    return (
      <div className="data-explorer-title exploring-title">
        <div>
          Exploring "<TopicName topic={selectedTopic} />"
        </div>
        <div className="clear-explorer-content-btn" onClick={this.clearContent}>
          <Icon type="close" /> <u>Clear</u>
        </div>
      </div>
    )
  }

  renderDataExplorerContent = () => {
    if (!this.getSelectedTopic()) {
      return this.renderIntroMessage()
    }

    return (
      <div className="data-explorer-result-container">
        <CustomScrollbars autoHide={false}>
          <div className="data-explorer-sections-container">
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
            <Icon type="calendar" /> Date
          </span>
        )
      }
      case 'DATE_STRING': {
        return (
          <span>
            <Icon type="calendar" /> Date
          </span>
        )
      }
      case 'STRING': {
        return (
          <span>
            <Icon type="note" /> Description
          </span>
        )
      }
      case 'DOLLAR_AMT': {
        return (
          <span>
            <Icon type="money" /> Currency
          </span>
        )
      }
      case 'QUANTITY': {
        return (
          <span>
            <Icon type="abacus" /> Quantity
          </span>
        )
      }
    }
  }

  renderColumnQuerySuggestions = (column) => {
    const subject = this.state.selectedSubject?.name || ''
    if (!subject) {
      return null
    }

    const lowerCaseSubject = subject.toLowerCase()
    const titleCaseSubject =
      lowerCaseSubject[0].toUpperCase() + lowerCaseSubject.substring(1)
    const lowerCaseColumn = column?.display_name?.toLowerCase()
    const suggestions = []

    if (column.type === 'STRING') {
      suggestions.push(`Total ${lowerCaseSubject} by ${lowerCaseColumn}`)
      suggestions.push(`List all ${lowerCaseColumn}s`)
    }

    if (column.type === 'DATE') {
      suggestions.push(`${titleCaseSubject} by month this year`)
      suggestions.push(`All ${lowerCaseSubject} in the last 2 weeks`)
      suggestions.push(`Total ${lowerCaseSubject} last year`)
      suggestions.push(`Number of ${lowerCaseSubject} yesterday`)
    }

    if (column.type === 'DOLLAR_AMT') {
      suggestions.push(`Top 5 ${lowerCaseSubject} ${lowerCaseColumn}`)
    }

    return (
      <>
        {suggestions.map((query, i) => {
          return (
            <div
              key={i}
              onClick={() => this.props.executeQuery(query)}
              className="data-explorer-tooltip-query"
            >
              <Icon type="react-autoql-bubbles-outlined" />
              {query}
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
        <div className="data-explorer-tooltip-title">
          {column?.display_name}
        </div>
        {!!formattedType && (
          <div className="data-explorer-tooltip-section">{formattedType}</div>
        )}
        <div className="data-explorer-tooltip-section">
          <strong>Query suggestions:</strong>
          <br />
          {this.renderColumnQuerySuggestions(column)}
        </div>
      </div>
    )
  }

  render = () => {
    if (!this.props.shouldRender) {
      return null
    }

    return (
      <ErrorBoundary>
        <div
          ref={(r) => (this.dataExplorerPage = r)}
          className="data-explorer-page-container"
          data-test="data-explorer-tab"
        >
          <DataExplorerInput
            ref={(r) => (this.inputRef = r)}
            authentication={this.props.authentication}
            inputPlaceholder={this.props.inputPlaceholder}
            onSelection={this.onInputSelection}
          />
          {this.renderSelectionTitle()}
          {this.renderDataExplorerContent()}
          <ReactTooltip
            className="data-preview-tooltip"
            id="data-preview-tooltip"
            place="right"
            delayHide={200}
            delayUpdate={200}
            effect="solid"
            getContent={this.renderHeaderTooltipContent}
            clickable
          />
        </div>
      </ErrorBoundary>
    )
  }
}
