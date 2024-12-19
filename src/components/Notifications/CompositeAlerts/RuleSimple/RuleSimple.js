import React from 'react'
import PropTypes from 'prop-types'
import _isEqual from 'lodash.isequal'
import { v4 as uuid } from 'uuid'
import dayjs from '../../../../js/dayjsWithPlugins'
import { CustomList } from '../CustomList'
import {
  COMPARE_TYPE,
  EXISTS_TYPE,
  NUMBER_TERM_TYPE,
  QUERY_TERM_TYPE,
  getSupportedConditionTypes,
  isISODate,
  authenticationDefault,
  getAuthentication,
  dataFormattingDefault,
  fetchFilters,
} from 'autoql-fe-utils'

import { LoadingDots } from '../../../LoadingDots'
import { Icon } from '../../../Icon'
import { Chip } from '../../../Chip'
import { Input } from '../../../Input'
import { ErrorBoundary } from '../../../../containers/ErrorHOC'
import { SelectableTable } from '../../../SelectableTable'
import { authenticationType, dataFormattingType } from '../../../../props/types'

import './RuleSimple.scss'

export default class RuleSimple extends React.Component {
  autoCompleteTimer = undefined

  constructor(props) {
    super(props)
    this.secondFieldSelectionGridRef = React.createRef()
    const { initialData, queryResponse } = props

    this.TERM_ID_1 = uuid()
    this.TERM_ID_2 = uuid()

    this.SUPPORTED_CONDITION_TYPES = getSupportedConditionTypes(initialData, queryResponse)
    this.SUPPORTED_OPERATORS = []

    this.SUPPORTED_OPERATORS = Object.keys({
      INTERSECT: {
        displayName: `
      <span>
        Is <strong>intersect</strong>
      </span>
    `,
        symbol: '∩',
        conditionText: 'exceeds',
        conditionTextPast: 'exceeded',
      },
    })

    let selectedOperator = this.getInitialSelectedOperator()

    let secondTermMultiplicationFactorType = 'multiply-percent-higher'
    let secondTermMultiplicationFactorValue = '0'

    if (initialData?.[1]?.result_adjustment) {
      let type = initialData[1].result_adjustment.operation
      let value = initialData[1].result_adjustment.value

      if (type === 'multiply' && value.includes('%')) {
        value = value.replace(/%/g, '')
        if (value > 100) {
          type = 'multiply-percent-higher'
          value = `${value - 100}`
        } else if (value < 100) {
          type = 'multiply-percent-lower'
          value = `${100 - value}`
        }
      }

      secondTermMultiplicationFactorType = type
      secondTermMultiplicationFactorValue = value
    }

    const state = {
      storedInitialData: props.initialData,
      columnSelectionType: 'any-column',
      selectedOperator: selectedOperator,
      selectedConditionType:
        (initialData[0]?.condtion ?? selectedOperator) === EXISTS_TYPE ? EXISTS_TYPE : COMPARE_TYPE,
      inputValue: queryResponse?.data?.data?.text ?? '',
      secondInputValue: '',
      secondTermType: NUMBER_TERM_TYPE,
      secondQueryValidating: false,
      secondQueryValidated: false,
      secondQueryInvalid: false,
      secondQueryError: '',
      isEditingQuery: false,
      queryFilters: this.getFilters(props),
      secondQueryResponse: {},
      isSecondQueryListQuery: true,
      firstQuerySelectedColumns: [],
      firstQueryGroupableColumnIndex: 0,
      secondQuerySelectedColumns: [],
      secondQueryGroupableColumnIndex: 0,
      secondQueryAmountOfNumberColumns: 0,
      secondQueryAllColumnsAmount: 0,
      secondQueryGroupableColumnsAmount: 0,
      secondTermMultiplicationFactorType,
      secondTermMultiplicationFactorValue,
      firstQueryResult: props.queryResponse ? props.queryResponse : null,
      secondQueryResult: null,
      isLoadingFirstQuery: false,
      isLoadingSecondQuery: false,
      showJoinColumnSelection: false,
      firstQueryFirstValue: '',
      firstQuerySecondValue: '',
      secondQueryFirstValue: '',
      secondQuerySecondValue: '',
    }

    if (initialData?.length) {
      this.TERM_ID_1 = initialData[0].id
      this.TERM_ID_2 = initialData.length > 1 ? initialData[1].id : uuid()
      state.selectedConditionType = state.selectedOperator === EXISTS_TYPE ? EXISTS_TYPE : COMPARE_TYPE
      state.inputValue = initialData[0].term_value ?? ''
      state.secondInputValue = initialData[1]?.term_value ?? ''
      state.secondTermType = initialData[1]?.term_type?.toUpperCase() ?? NUMBER_TERM_TYPE
      state.secondQueryValidated = true
    }

    this.state = state
  }

  static propTypes = {
    authentication: authenticationType,
    ruleId: PropTypes.string,

    initialData: PropTypes.arrayOf(PropTypes.shape({})),
    queryResponse: PropTypes.shape({}),

    dataFormatting: dataFormattingType,
    dataAlert: PropTypes.object,
    baseDataAlertColumns: PropTypes.array,
    baseDataAlertQueryResponse: PropTypes.object,
    isLoadingBaseDataAlertQueryResponse: PropTypes.bool,
    onCustomFiltersChange: PropTypes.func,
    customFilters: PropTypes.array,
  }

  static defaultProps = {
    authentication: authenticationDefault,
    ruleId: undefined,

    initialData: undefined,
    queryResponse: undefined,
    queryResultMetadata: undefined,

    dataFormatting: dataFormattingDefault,
    dataAlert: {},
    baseDataAlertColumns: [],
    baseDataAlertQueryResponse: {},
    isLoadingBaseDataAlertQueryResponse: false,
    onCustomFiltersChange: () => {},
    customFilters: [],
  }

  componentDidMount = () => {
    this._isMounted = true
    this.initialize()
    this.secondInput?.focus()
  }

  componentWillUnmount = () => {
    this._isMounted = false
    if (this.autoCompleteTimer) {
      clearTimeout(this.autoCompleteTimer)
    }
  }

  getInitialSelectedOperator = () => {
    return this.SUPPORTED_OPERATORS[0]
  }

  getFormattedDate = (filter) => {
    let isDate = false
    let dateText
    let dateArray = []
    try {
      const textArray = filter.value.split(',')
      const textWithDatesArray = textArray.map((str) => {
        if (isISODate(str)) {
          const dateDayJS = dayjs(str).utc()
          const formattedDate = dateDayJS.format('ll')
          if (formattedDate !== 'Invalid Date') {
            isDate = true
            dateArray.push(dateDayJS)
            return formattedDate
          }
        }
        return str
      })
      const startDate = textWithDatesArray[0]
      const endDate = textWithDatesArray[1]
      dateText = `Between ${startDate} and ${endDate}`
      if (startDate === endDate) {
        dateText = `${startDate}`
      }
    } catch (error) {
      console.error(error)
      isDate = false
    }
    if (isDate) {
      return dateText
    }
    return undefined
  }
  getFormattedDataAlertText = ({ sentenceCase = true } = {}) => {
    try {
      let dataAlertText = this.props.dataAlert.title

      if (!dataAlertText) {
        return ''
      }

      if (sentenceCase) {
        dataAlertText = dataAlertText[0].toUpperCase() + dataAlertText.substring(1)
      }

      return dataAlertText
    } catch (error) {
      console.error(error)
      return ''
    }
  }

  renderFormattedQuery = () => {
    return
  }

  getFilters = (props = this.props) => {
    let lockedFilters = []
    let tableFilters = []

    if (!props.queryResponse) {
      lockedFilters = props.initialData[0]?.session_filter_locks ?? []
      tableFilters = props.initialData[0]?.filters ?? []
    } else {
      const persistentFilters = props.queryResponse?.data?.data?.fe_req?.persistent_filter_locks ?? []
      const sessionFilters = props.queryResponse?.data?.data?.fe_req?.session_filter_locks ?? []
      lockedFilters = [...persistentFilters, ...sessionFilters] ?? []
      tableFilters = props.filters ?? []
    }

    const tableFiltersFormatted =
      tableFilters.map((filter) => ({
        ...filter,
        value: filter?.displayValue ?? filter?.value,
        type: 'table',
      })) ?? []

    const lockedFiltersFormatted = lockedFilters.map((filter) => ({
      ...filter,
      type: 'locked',
    }))

    const allFilters = [...tableFiltersFormatted, ...lockedFiltersFormatted]

    return allFilters
  }

  removeFilter = (filter) => {
    const newFilterList = this.state.queryFilters?.filter((f) => !_isEqual(f, filter))
    this.setState({ queryFilters: newFilterList })
  }

  renderFilterChips = () => {
    const filters = this.state.queryFilters

    if (filters?.length) {
      return (
        <div className='react-autoql-data-alert-filters-container'>
          {filters.map((filter, i) => {
            if (filter) {
              let chipContent = null
              if (filter.type === 'table') {
                let operatorDisplay = ' ' + filter.operator ?? 'like'

                if (filter.operator === 'between' && !filter.value.includes(' and ')) {
                  operatorDisplay = ':'
                }

                let dateText
                if (filter.column_type !== 'AMOUNT') {
                  dateText = this.getFormattedDate(filter)
                }

                let value = filter.value
                if (filter.operator === 'like') {
                  value = `"${filter.value}"`
                }
                if (dateText) {
                  value = dateText
                }

                chipContent = (
                  <span>
                    <strong>
                      <Icon type='table' /> {filter.columnName}
                    </strong>
                    {operatorDisplay} <em>{value}</em>
                  </span>
                )
              } else if (filter.type === 'locked') {
                chipContent = (
                  <span>
                    <strong>
                      <Icon type='lock' /> {filter.show_message ?? 'Value'}
                    </strong>
                    {filter.filter_type?.toLowerCase() === 'exclude' ? (
                      <span>
                        {' '}
                        <u>not</u>{' '}
                      </span>
                    ) : (
                      ': '
                    )}
                    {filter.value}
                  </span>
                )
              }

              if (chipContent) {
                return (
                  <Chip
                    key={`filter-chip-${i}`}
                    onDelete={() => this.removeFilter(filter)}
                    confirmDelete
                    confirmText='Remove this filter?'
                    tooltip={`This ${filter.type} filter is currently applied to your query data. It will also be applied to your Data Alert unless you remove it by hitting "x".`}
                    tooltipID={this.props.tooltipID}
                    popoverPadding={10}
                  >
                    {chipContent}
                  </Chip>
                )
              }
            }

            return null
          })}
        </div>
      )
    }
    return null
  }

  renderBaseQuery = () => {
    return (
      <div className='react-autoql-rule-input'>
        <div>
          <span
            className='data-alert-rule-query-readonly-container'
            data-tooltip-id={this.props.tooltipID}
            data-tooltip-content='Editing this data alert is not permitted.'
          >
            <Input label='Data Alert' value={this.getFormattedDataAlertText()} readOnly disabled fullWidth />
          </span>

          <div className='react-autoql-rule-field-selection-first-query' data-test='rule'>
            <div className='react-autoql-rule-field-selection-grid-container'>{this.renderPreviewGrid()}</div>
          </div>

          {this.renderFilterChips()}
        </div>
      </div>
    )
  }

  shouldRenderValidationSection = () => {
    return this.allowOperators() && this.state.secondTermType === QUERY_TERM_TYPE
  }

  renderPreviewGrid = () => {
    if (this.props.isLoadingBaseDataAlertQueryResponse) {
      return <LoadingDots />
    }
    if (!this.props.baseDataAlertQueryResponse) {
      return <div className='error-message'>Error loading data alert data. Please try again.</div>
    }
    const queryResponse = this.props.baseDataAlertQueryResponse
    return (
      <SelectableTable
        dataFormatting={this.props.dataFormatting}
        queryResponse={queryResponse}
        radio={false}
        showEndOfPreviewMessage={true}
        tooltipID={this.props.tooltipID}
        rowLimit={20}
        disableCheckboxes={true}
      />
    )
  }

  allowOperators = () => {
    return this.SUPPORTED_CONDITION_TYPES.includes(COMPARE_TYPE)
  }
  transformTermValueToFilters = (termValue) => {
    if (!termValue?.rows || !termValue?.columns?.[0]?.name) {
      return []
    }
    const columnName = termValue.columns[0].name
    const showMessage = termValue.columns[0].display_name
    return termValue.rows.map((row) => ({
      value: row[0],
      column_name: columnName,
      show_message: showMessage,
    }))
  }

  initialize = () => {
    this.setState({ isFetchingFilters: true })
    const termValue = this.state.storedInitialData?.[1]?.term_value
    if (termValue) {
      const initialFilters = this.transformTermValueToFilters(termValue)
      if (this._isMounted) {
        this.setState({ initialFilters, isFetchingFilters: false })
      }
    } else {
      fetchFilters(getAuthentication(this.props.authentication))
        .then((response) => {
          const initialFilters = response?.data?.data?.data || []
          this.props.onChange(initialFilters)
          if (this._isMounted) {
            this.setState({ initialFilters, isFetchingFilters: false })
          }
        })
        .catch((error) => {
          console.error(error)
          if (this._isMounted) {
            this.setState({ isFetchingFilters: false })
          }
        })
    }
  }
  renderCustomList = () => {
    return (
      <CustomList
        authentication={this.props.authentication}
        initialFilters={this.state.initialFilters}
        baseDataAlertColumns={this.props.baseDataAlertColumns}
        onCustomFiltersChange={this.props.onCustomFiltersChange}
        customFilters={this.props.customFilters}
        storedInitialData={this.state.storedInitialData}
        tooltipID={this.props.tooltipID}
      />
    )
  }

  render = () => {
    if (this.props.conditionStatementOnly) {
      return null
    }

    return (
      <ErrorBoundary>
        <div
          className={`react-autoql-custom-filtered-alert-rule-simple
        ${this.shouldRenderValidationSection() ? 'with-query-validation' : ''}`}
          style={this.props.style}
        >
          <div className='react-autoql-rule-simple-first-query' data-test='rule'>
            <div className='react-autoql-rule-first-input-container'>{this.renderBaseQuery()}</div>
          </div>

          <div>{this.renderCustomList()}</div>
        </div>
      </ErrorBoundary>
    )
  }
}
