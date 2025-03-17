import React from 'react'
import axios from 'axios'
import { v4 as uuid } from 'uuid'
import { median } from 'd3-array'
import PropTypes from 'prop-types'
import _isEqual from 'lodash.isequal'
import _cloneDeep from 'lodash.clonedeep'
import { isMobile } from 'react-device-detect'

import {
  isColumnDateType,
  DataExplorerTypes,
  getAuthentication,
  fetchSubjectListV2,
  runQueryValidation,
  isColumnNumberType,
  dataFormattingDefault,
  REQUEST_CANCELLED_ERROR,
} from 'autoql-fe-utils'

import DataPreview from './DataPreview'
import SampleQueryList from './SampleQueryList'
import DataExplorerInput from './DataExplorerInput'

import { Icon } from '../Icon'
import { Cascader } from '../Cascader'
import { SubjectName } from './SubjectName'
import { LoadingDots } from '../LoadingDots'
import { MultiSelect } from '../MultiSelect'
import { CustomScrollbars } from '../CustomScrollbars'
import { ErrorBoundary } from '../../containers/ErrorHOC'
import { QueryValidationMessage } from '../QueryValidationMessage'
import { authenticationType, dataFormattingType } from '../../props/types'

import './DataExplorer.scss'

export default class DataExplorer extends React.Component {
  constructor(props) {
    super(props)

    this.ID = uuid()
    this.QUERY_SUGGESTIONS_KEY = uuid()

    this.defaultState = {
      selectedSubject: null,
      dataPreview: undefined,
      selectedColumns: [],
      subjectList: [],
      selectedTopic: undefined,
      loadingSubjects: false,
      subjectListError: undefined,
      validating: false,
      validationResponse: undefined,
      validationError: undefined,
      skipQueryValidation: false,
    }

    this.state = _cloneDeep(this.defaultState)
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
      !_isEqual(this.state.selectedSubject, prevState.selectedSubject) &&
      this.state.selectedSubject?.type === DataExplorerTypes.VL_TYPE
    ) {
      if (this.state.selectedSubject?.valueLabel?.canonical) {
        this.setState({ loadingSubjects: true, subjectListError: undefined })
        fetchSubjectListV2({
          ...this.props.authentication,
          valueLabel: this.state.selectedSubject.valueLabel.canonical,
          cancelToken: this.axiosSourceSubjectList?.token,
        })
          .then((subjects) => {
            const subjectList = []

            subjects.forEach((subject) => {
              const foundSubject = this.getSubjectObject(subject.subject)
              if (foundSubject) {
                subjectList.push(foundSubject)
              }
            })

            if (this._isMounted) {
              this.setState({ subjectList, loadingSubjects: false })
            }
          })
          .catch((error) => {
            console.error(error)
            if (this.state.selectedSubject && error?.data?.message !== REQUEST_CANCELLED_ERROR) {
              this.setState({ loadingSubjects: false, subjectListError: error })
            }
          })
      }
    }
  }

  componentWillUnmount = () => {
    this._isMounted = false
  }

  getSubjectObject = (context) => {
    return this.inputRef?.state?.allSubjects?.find((subj) => subj.context === context)
  }

  resetState = (newState = {}) => {
    // If validation is progress, cancel it
    this.cancelValidation()

    this.setState({ ...this.defaultState, ...newState })
  }

  cancelValidation = () => {
    this.axiosSourceValidation?.cancel(REQUEST_CANCELLED_ERROR)
    this.axiosSourceValidation = undefined
  }

  cancelFetchSubjectList = () => {
    this.axiosSourceSubjectList?.cancel(REQUEST_CANCELLED_ERROR)
    this.axiosSourceSubjectList = undefined
  }

  validateSearchTerm = (term) => {
    this.axiosSourceValidation = axios.CancelToken?.source?.()

    this.setState({ validating: true })

    runQueryValidation({
      ...getAuthentication(this.props.authentication),
      text: term.displayName,
      cancelToken: this.axiosSourceValidation?.token,
    })
      .then((response) => {
        if (this._isMounted) {
          const newStateAfterValidation = { validating: false }
          if (response?.data?.data?.replacements?.length > 0) {
            newStateAfterValidation.validationResponse = response
          }
          this.setState(newStateAfterValidation)
        }
      })
      .catch((error) => {
        console.error(error)
        if (this._isMounted && error?.data?.message !== REQUEST_CANCELLED_ERROR) {
          this.setState({ validating: false, validationError: error })
        }
      })
      .finally(() => {
        this.axiosSourceValidation = undefined
      })
  }

  onInputSelection = async (searchTerm) => {
    if (_isEqual(searchTerm, this.state.selectedSubject)) {
      return
    }

    this.resetState({ selectedSubject: searchTerm })

    if (searchTerm?.type === DataExplorerTypes.TEXT_TYPE) {
      this.validateSearchTerm(searchTerm)
    }

    this.inputRef?.blurInput()
  }

  renderIntroMessage = () => {
    const commonContent = this.props.introMessage ? (
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
              <Icon type='react-autoql-bubbles-outlined' /> View and customize a sample of query suggestions
            </p>
          </div>
        </div>
      </div>
    )

    if (isMobile) {
      return (
        <div className='data-explorer-intro-message mobile'>
          <h3>
            <Icon type='data-search' /> Explore Your Data
          </h3>
          {commonContent}
        </div>
      )
    }

    return (
      <div className='data-explorer-intro-message'>
        <h2>
          Welcome to <Icon type='data-search' />
          Data Explorer
        </h2>
        {commonContent}
      </div>
    )
  }

  animateDETextAndSubmit = (text) => {
    if (this.inputRef?._isMounted) {
      this.inputRef.animateTextAndSubmit(text)
    }
  }

  onValidationSuggestionClick = ({ query, userSelection }) => {
    this.QUERY_SUGGESTIONS_KEY = uuid()
    this.animateDETextAndSubmit(query)
    this.setState({ userSelection })
  }

  reloadScrollbars = () => {
    this.scrollbars?.update()
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
        subject={this.getSubjectObject(context)}
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

  getValueFilter = (column, index) => {
    const columnData = this.state.dataPreview?.data?.data?.rows?.map((row) => row[index]).filter((value) => !!value)

    let defaultValue = ''
    if (isColumnNumberType(column)) {
      // Use median value from dataset (median not avg, so it is guaranteed to conform with the dataset)
      defaultValue = median(columnData)
    }

    // This will restrict sample queries with groupbys to only show "filter" queries and not "groupby" queries
    // ie. It will not show "total sales by customer", instead it will always show "total sales for __VL_CUSTOMER__"
    // There may be work that needs to be done in the querybuilder service to show both types of queries regardless
    // of a provided VL default value or not
    else if (isColumnDateType(column)) {
      // Use first value that exists
      defaultValue = columnData.find((date) => !!date)
    } else {
      // Find any value that exists
      defaultValue = columnData.find((str) => !!str)
    }

    if (defaultValue !== null && defaultValue !== undefined) {
      return `${defaultValue}`
    }

    return ''
  }

  getColumnsForSuggestions = () => {
    let columns
    if (this.state.selectedSubject?.valueLabel?.column_name) {
      columns = {
        [this.state.selectedSubject.valueLabel.column_name]: {
          value: this.state.selectedSubject.valueLabel.keyword,
        },
      }
    }

    if (this.state.selectedColumns?.length) {
      this.state.selectedColumns?.forEach((columnIndex) => {
        if (!columns) {
          columns = {}
        }

        const column = this.state.dataPreview?.data?.data?.columns[columnIndex]
        if (!columns[column.name]) {
          const value = this.getValueFilter(column, columnIndex) ?? ''
          columns[column.name] = { value }

          if (column.alt_name) {
            columns[column.name].alternative_column_names = [column.alt_name]
          }
        }
      })
    }

    return columns
  }

  renderTopicsListForVL = () => {
    if (this.state.selectedSubject?.type !== DataExplorerTypes.VL_TYPE) {
      return null
    }

    if (this.state.loadingSubjects) {
      const placeholderHeight = '15px'

      return (
        <div className='data-explorer-section-placeholder-loading-container'>
          <div className='data-explorer-section-placeholder-loading-item'>
            <div className='react-autoql-placeholder-loader' style={{ width: '60%', height: placeholderHeight }} />
          </div>
          <div className='data-explorer-section-placeholder-loading-item'>
            <div className='react-autoql-placeholder-loader' style={{ width: '80%', height: placeholderHeight }} />
          </div>
          <div className='data-explorer-section-placeholder-loading-item'>
            <div className='react-autoql-placeholder-loader' style={{ width: '40%', height: placeholderHeight }} />
          </div>
          <div className='data-explorer-section-placeholder-loading-item'>
            <div className='react-autoql-placeholder-loader' style={{ width: '50%', height: placeholderHeight }} />
          </div>
        </div>
      )
    }

    if (this.state.subjectListError) {
      return (
        <div className='data-explorer-section-error-container'>
          <p>
            {this.state.subjectListError?.message ||
              'Uh oh.. an error occurred while trying to retrieve the topics list. Please try again.'}
          </p>
          {this.state.subjectListError?.reference_id ? (
            <p>Error ID: {this.state.subjectListError.reference_id}</p>
          ) : null}
        </div>
      )
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
              // key={this.state.selectedSubject?.displayName}
              // key={uuid()}
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
          Select additional fields of interest from <em>"{this.state.selectedSubject?.displayName}"</em> to generate
          more queries.
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
    if (!selectedSubject || this.state.validating) {
      return null
    }

    const context =
      this.state.selectedSubject?.type === DataExplorerTypes.VL_TYPE
        ? this.state.selectedTopic?.context
        : this.state.selectedSubject?.context

    let searchText = ''
    if (this.state.selectedSubject?.type === DataExplorerTypes.TEXT_TYPE) {
      searchText = this.state.selectedSubject?.displayName
    }

    const columns = this.getColumnsForSuggestions()

    return (
      <div className='data-explorer-section query-suggestions'>
        {this.renderSampleQueriesHeader()}
        <div className='data-explorer-query-suggestion-list'>
          <CustomScrollbars ref={(r) => (this.scrollbars = r)} autoHide>
            <SampleQueryList
              ref={(r) => (this.querySuggestionList = r)}
              key={this.QUERY_SUGGESTIONS_KEY}
              authentication={this.props.authentication}
              columns={columns}
              context={context}
              valueLabel={this.state.selectedSubject?.valueLabel}
              searchText={searchText}
              executeQuery={this.props.executeQuery}
              skipQueryValidation={this.state.skipQueryValidation}
              userSelection={this.state.userSelection}
              tooltipID={this.props.tooltipID}
              scope={this.props.scope}
              shouldRender={this.props.shouldRender}
              onSuggestionListResponse={() => {
                this.reloadScrollbars()
                this.setState({ skipQueryValidation: false })
              }}
            />
          </CustomScrollbars>
        </div>
      </div>
    )
  }

  renderLoadingDots = () => {
    return (
      <div className='data-explorer-section-loading-container'>
        <LoadingDots />
      </div>
    )
  }

  renderQueryValidationResponse = () => {
    return (
      <div className='data-explorer-section query-validation-response'>
        <QueryValidationMessage
          response={this.state.validationResponse}
          onSuggestionClick={this.onValidationSuggestionClick}
          autoSelectSuggestion={true}
          submitText='Search'
          submitIcon='search'
          scope={this.props.scope}
        />
      </div>
    )
  }

  renderDataExplorerContent = () => {
    if (this.state.validating) {
      return this.renderLoadingDots()
    }

    if (this.state.validationResponse) {
      return this.renderQueryValidationResponse()
    }

    const { selectedSubject } = this.state

    if (!selectedSubject) {
      return this.renderIntroMessage()
    }

    return (
      <div className='data-explorer-result-container'>
        <div
          key={`data-explorer-sections-container-${selectedSubject?.id}`}
          className='data-explorer-sections-container'
        >
          {selectedSubject?.displayName && selectedSubject?.type !== DataExplorerTypes.TEXT_TYPE ? (
            <div className='react-autoql-data-explorer-selected-subject-title'>
              <SubjectName subject={selectedSubject} />
            </div>
          ) : null}
          {this.renderDataPreview()}
          {this.renderTopicsListForVL()}
          {this.renderQuerySuggestions()}
        </div>
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
            onClearInputClick={this.resetState}
            tooltipID={this.props.tooltipID}
          />
          {this.renderDataExplorerContent()}
        </ErrorBoundary>
      </div>
    )
  }
}
