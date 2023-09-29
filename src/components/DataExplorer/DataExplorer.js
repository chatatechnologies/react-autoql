import React from 'react'
import _isEqual from 'lodash.isequal'
import { v4 as uuid } from 'uuid'
import PropTypes from 'prop-types'

import { COLUMN_TYPES, DataExplorerTypes, dataFormattingDefault } from 'autoql-fe-utils'

import { Icon } from '../Icon'
import { Tooltip } from '../Tooltip'
import DataPreview from './DataPreview'
import DataExplorerInput from './DataExplorerInput'
import MultiSelect from '../MultiSelect/MultiSelect'
import { CustomScrollbars } from '../CustomScrollbars'
import SampleQueryList from './SampleQueryList'
import ErrorBoundary from '../../containers/ErrorHOC/ErrorHOC'

import { authenticationType, dataFormattingType } from '../../props/types'

import './DataExplorer.scss'

export default class DataExplorer extends React.Component {
  constructor(props) {
    super(props)

    this.querySuggestionsKey = uuid()
    this.ID = uuid()

    this.state = {
      selectedSubject: null,
      selectedColumns: [],
      isDataPreviewCollapsed: false,
      isQuerySuggestionCollapsed: false,
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
    this.setState({
      selectedSubject: listItem,
      skipQueryValidation,
    })

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
    if (this.state.selectedSubject?.type !== DataExplorerTypes.SUBJECT_TYPE) {
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
          defaultCollapsed={this.props.isSmallScreen ? false : undefined}
          tooltipID={`data-preview-tooltip-${this.ID}`}
          onColumnSelection={(selectedColumns) => {
            this.setState({ selectedColumns })
          }}
          onDataPreview={(dataPreview) => this.setState({ dataPreview })}
          data={this.state.dataPreview}
          selectedColumns={this.state.selectedColumns}
          onIsCollapsedChange={(isCollapsed) => {
            this.setState({
              isDataPreviewCollapsed: isCollapsed,
              isQuerySuggestionCollapsed: isCollapsed ? this.state.isQuerySuggestionCollapsed : true,
            })
          }}
        />
      </div>
    )
  }

  renderSampleQueriesHeader = () => {
    const columns = this.state.dataPreview?.data?.data?.columns

    return (
      <div className='react-autoql-data-explorer-title-text'>
        <span className='react-autoql-data-explorer-title-text-sample-queries'>Sample Queries</span>
        {columns?.length ? (
          <span className='react-autoql-data-preview-selected-columns-selector'>
            <MultiSelect
              title='FIELDS'
              size='small'
              align='middle'
              options={columns.map((col) => {
                return {
                  value: col.name,
                  label: col.display_name,
                }
              })}
              selected={this.state.selectedColumns.map((index) => columns[index]?.name)}
              onChange={(selectedColumnNames) => {
                const selectedColumnIndexes = selectedColumnNames.map((name) =>
                  columns.findIndex((col) => name === col.name),
                )
                this.setState({
                  selectedColumns: selectedColumnIndexes,
                })
              }}
            />
          </span>
        ) : null}
        {!!this.state.selectedColumns?.length && (
          <span
            className='react-autoql-data-preview-selected-columns-clear-btn'
            onClick={() => this.setState({ selectedColumns: [] })}
          >
            CLEAR
          </span>
        )}
      </div>
    )
  }

  renderQuerySuggestions = () => {
    const { selectedSubject } = this.state
    if (!selectedSubject) {
      return null
    }

    return (
      <div className='data-explorer-section query-suggestions'>
        {this.renderSampleQueriesHeader()}
        <div className='data-explorer-query-suggestion-list'>
          <SampleQueryList
            ref={(r) => (this.querySuggestionList = r)}
            key={this.querySuggestionsKey}
            authentication={this.props.authentication}
            columns={this.state.selectedColumns}
            context={this.state.selectedSubject?.context}
            valueLabel={this.state.selectedSubject?.valueLabel}
            searchText={this.state.selectedSubject?.text}
            executeQuery={this.props.executeQuery}
            skipQueryValidation={this.state.skipQueryValidation}
            userSelection={this.state.userSelection}
            tooltipID={this.props.tooltipID}
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

  clearContent = () => {
    this.setState({ selectedSubject: null })
  }

  renderHeaderTooltipContent = ({ content }) => {
    let column
    try {
      column = JSON.parse(content)
    } catch (error) {
      return null
    }

    if (!column) {
      return null
    }

    const name = column.displayName
    const type = COLUMN_TYPES[column.type]?.description
    const icon = COLUMN_TYPES[column.type]?.icon

    return (
      <div>
        <div className='data-explorer-tooltip-title'>{name}</div>
        {!!type && (
          <div className='data-explorer-tooltip-section'>
            {!!icon && <Icon type={icon} />}
            {type}
          </div>
        )}
      </div>
    )
  }

  renderDataExplorerContent = () => {
    const { selectedSubject } = this.state

    if (!selectedSubject) {
      return this.renderIntroMessage()
    }

    return (
      <div className='data-explorer-result-container'>
        <CustomScrollbars>
          <div
            key={`data-explorer-sections-container-${selectedSubject?.id}`}
            className='data-explorer-sections-container'
          >
            {!!selectedSubject?.displayName && (
              <div className='react-autoql-data-explorer-selected-subject-title'>
                <Icon
                  type='book'
                  data-tooltip-content={selectedSubject?.formattedType}
                  data-tooltip-id={selectedSubject?.formattedType ? this.props.tooltipID : undefined}
                />{' '}
                {selectedSubject?.displayName}
              </div>
            )}
            {this.renderDataPreview()}
            {this.renderQuerySuggestions()}
          </div>
        </CustomScrollbars>
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
        </ErrorBoundary>
        <Tooltip
          className='data-preview-tooltip'
          id={`data-preview-tooltip-${this.ID}`}
          render={this.renderHeaderTooltipContent}
          delayShow={500}
          effect='solid'
          place='top'
          clickable
          border
        />
      </div>
    )
  }
}
