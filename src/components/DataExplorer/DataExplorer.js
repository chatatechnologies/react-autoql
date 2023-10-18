import React from 'react'
import { v4 as uuid } from 'uuid'
import PropTypes from 'prop-types'
import _isEqual from 'lodash.isequal'

import { COLUMN_TYPES, DataExplorerTypes, dataFormattingDefault, fetchSubjectList } from 'autoql-fe-utils'

import { Icon } from '../Icon'
import { Tooltip } from '../Tooltip'
import DataPreview from './DataPreview'
import { SubjectName } from './SubjectName'
import Cascader from '../Cascader/Cascader'
import SampleQueryList from './SampleQueryList'
import DataExplorerInput from './DataExplorerInput'
import MultiSelect from '../MultiSelect/MultiSelect'
import { CustomScrollbars } from '../CustomScrollbars'
import ErrorBoundary from '../../containers/ErrorHOC/ErrorHOC'

import { authenticationType, dataFormattingType } from '../../props/types'

import './DataExplorer.scss'

export default class DataExplorer extends React.Component {
  constructor(props) {
    super(props)

    this.querySuggestionsKey = uuid()
    this.ID = uuid()

    this.state = {
      subjectList: [],
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

  componentDidUpdate = (prevProps, prevState) => {
    if (
      this.state.selectedSubject?.type !== prevState.selectedSubject?.type &&
      this.state.selectedSubject?.type === DataExplorerTypes.VL_TYPE
    ) {
      if (this.state.selectedSubject.valueLabel.canonical) {
        fetchSubjectList({ ...this.props.authentication, valueLabel: this.state.selectedSubject.valueLabel.canonical })
          .then((subjectList) => {
            const filteredSubjects = subjectList.filter((subj) => !subj.isAggSeed())
            if (this._isMounted) {
              this.setState({ subjectList: filteredSubjects })
            }
          })
          .catch((error) => console.error(error))
      }
    }
  }

  componentWillUnmount = () => {
    this._isMounted = false
  }

  onInputSelection = (listItem, skipQueryValidation) => {
    this.setState({
      selectedSubject: listItem,
      dataPreview: undefined,
      selectedTopic: undefined,
      selectedColumns: [],
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

  getDataPreview = (props = {}) => {
    const context = props.subject?.context ?? this.state.selectedSubject?.context
    const dataPreviewID = context?.replaceAll?.(' ', '-') ?? uuid()

    return (
      <DataPreview
        key={`data-preview-${dataPreviewID}`}
        authentication={this.props.authentication}
        dataFormatting={this.props.dataFormatting}
        shouldRender={this.props.shouldRender}
        dataExplorerRef={this.dataExplorerPage}
        isCollapsed={this.props.isSmallScreen ? this.state.isDataPreviewCollapsed : undefined}
        defaultCollapsed={this.props.isSmallScreen ? false : undefined}
        tooltipID={`data-preview-tooltip-${this.ID}`}
        onColumnSelection={(columns) => this.setState({ selectedColumns: columns })}
        onDataPreview={(dataPreview) => this.setState({ dataPreview })}
        data={this.state.dataPreview}
        selectedColumns={this.state.selectedColumns}
        onIsCollapsedChange={(isCollapsed) => {
          this.setState({
            isDataPreviewCollapsed: isCollapsed,
            isQuerySuggestionCollapsed: isCollapsed ? this.state.isQuerySuggestionCollapsed : true,
          })
        }}
        {...props}
      />
    )
  }

  renderTopicsListForVL = () => {
    if (this.state.selectedSubject?.type !== DataExplorerTypes.VL_TYPE) {
      return null
    }

    const options = this.state.subjectList?.map((subject) => ({
      value: subject.context,
      label: subject.displayName,
      action: <Icon type='caret-right' />,
      children: [
        {
          value: 'data-preview',
          customContent: () => this.getDataPreview({ subject }),
        },
      ],
      subject,
    }))

    return (
      <div className='data-explorer-section topic-dropdown-section'>
        {options?.length ? (
          <>
            <div className='react-autoql-input-label'>
              Select a Topic related to <em>"{this.state.selectedSubject?.displayName}"</em>:
            </div>
            <Cascader
              options={options}
              onBackClick={() => this.setState({ selectedTopic: undefined, selectedColumns: [] })}
              onOptionClick={(option) => {
                if (option.subject?.context !== this.state.selectedTopic?.context) {
                  this.setState({ selectedTopic: option.subject, selectedColumns: [], dataPreview: undefined })
                }
              }}
            />
          </>
        ) : null}
      </div>
    )
  }

  renderDataPreview = () => {
    if (this.state.selectedSubject?.type !== DataExplorerTypes.SUBJECT_TYPE) {
      return null
    }

    return (
      <div className='data-explorer-section data-preview-section'>
        <div className='react-autoql-input-label'>
          Select all fields of interest from <em>"{this.state.selectedSubject?.displayName}"</em>:
        </div>
        {this.getDataPreview({ subject: this.state.selectedSubject })}
      </div>
    )
  }

  renderFieldSelector = () => {
    const columns = this.state.dataPreview?.data?.data?.columns

    if (!columns?.length) {
      return null
    }

    let fieldsDropdownTitle = 'Select fields of interest'
    if (this.state.selectedSubject?.type === DataExplorerTypes.VL_TYPE) {
      if (!this.state.selectedTopic) {
        return null
      }

      fieldsDropdownTitle = (
        <span>
          Select fields from <SubjectName subject={this.state.selectedTopic} />
        </span>
      )
    }

    return (
      <>
        <span className='react-autoql-data-preview-selected-columns-selector'>
          <MultiSelect
            title='FIELDS'
            size='small'
            align='start'
            popupClassname='react-autoql-sample-queries-filter-dropdown'
            options={columns.map((col) => {
              return {
                value: col.name,
                label: col.display_name,
              }
            })}
            listTitle={fieldsDropdownTitle}
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
        {!!this.state.selectedColumns?.length && (
          <span
            className='react-autoql-data-preview-selected-columns-clear-btn'
            onClick={() => this.setState({ selectedColumns: [] })}
          >
            CLEAR
          </span>
        )}
      </>
    )
  }

  renderSampleQueriesHeader = () => {
    return (
      <div className='react-autoql-data-explorer-title-text'>
        <span className='react-autoql-data-explorer-title-text-sample-queries'>Sample Queries</span>
        {this.renderFieldSelector()}
      </div>
    )
  }

  renderQuerySuggestions = () => {
    const { selectedSubject } = this.state
    if (!selectedSubject) {
      return null
    }

    const context =
      this.state.selectedSubject?.type === DataExplorerTypes.VL_TYPE
        ? this.state.selectedTopic
        : this.state.selectedSubject?.context

    return (
      <div className='data-explorer-section query-suggestions'>
        {this.renderSampleQueriesHeader()}
        <div className='data-explorer-query-suggestion-list'>
          <SampleQueryList
            ref={(r) => (this.querySuggestionList = r)}
            key={this.querySuggestionsKey}
            authentication={this.props.authentication}
            columns={this.state.selectedColumns}
            context={context}
            valueLabel={this.state.selectedSubject?.valueLabel}
            searchText={this.state.selectedSubject?.text}
            executeQuery={this.props.executeQuery}
            skipQueryValidation={this.state.skipQueryValidation}
            userSelection={this.state.userSelection}
            tooltipID={this.props.tooltipID}
            scope={this.props.scope}
            shouldRender={this.props.shouldRender}
            onValidationSuggestionClick={this.onValidationSuggestionClick}
            onSuggestionListResponse={() => {
              this.reloadScrollbars()
              this.setState({ skipQueryValidation: false })
            }}
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

    const name = column.display_name
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
                <SubjectName subject={selectedSubject} />
              </div>
            )}
            {this.renderDataPreview()}
            {this.renderTopicsListForVL()}
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
