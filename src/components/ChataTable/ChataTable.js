import React from 'react'
import PropTypes from 'prop-types'
import uuid from 'uuid'
import _get from 'lodash.get'
import _isEqual from 'lodash.isequal'
import { ReactTabulator } from 'react-tabulator'

import ErrorBoundary from '../../containers/ErrorHOC/ErrorHOC'
import { setCSSVars, isAggregation } from '../../js/Util'
import { themeConfigType } from '../../props/types'
import { themeConfigDefault, getThemeConfig } from '../../props/defaults'

import 'react-tabulator/lib/styles.css' // default theme
import 'react-tabulator/css/bootstrap/tabulator_bootstrap.min.css' // use Theme(s)
import './ChataTable.scss'

export default class ChataTable extends React.Component {
  constructor(props) {
    super(props)

    this.TABLE_ID = uuid.v4()
    this.DEFAULT_TABLE_HEIGHT = '98%'
    this.firstRender = true
    this.ref = null

    setCSSVars(getThemeConfig(props.themeConfig))
  }

  static propTypes = {
    themeConfig: themeConfigType,
    data: PropTypes.arrayOf(PropTypes.array),
    columns: PropTypes.arrayOf(PropTypes.shape({})),
    onFilterCallback: PropTypes.func,
  }

  static defaultProps = {
    themeConfig: themeConfigDefault,
    data: undefined,
    columns: undefined,
    onFilterCallback: () => {},
    onCellClick: () => {},
    onErrorCallback: () => {},
  }

  state = {
    columns: this.props.columns,
  }

  componentDidMount = () => {
    this.firstRender = false
    this.setTableHeaderValues = setTimeout(() => {
      this.setInitialHeaderFilters()
      this.setFilterTags({ isFilteringTable: false })
    }, 100)
  }

  shouldComponentUpdate = (nextProps, nextState) => {
    // Tabulator takes care of updates in these cases
    // No need to re-render after filter changes
    const thisPropsFiltered = {
      ...this.props,
      data: undefined,
      headerFilters: undefined,
    }
    const nextPropsFiltered = {
      ...nextProps,
      data: undefined,
      headerFilters: undefined,
    }

    if (!_isEqual(thisPropsFiltered, nextPropsFiltered)) {
      return true
    } else if (!_isEqual(this.state, nextState)) {
      return true
    }
    return false
  }

  componentDidUpdate = (prevProps) => {
    if (
      !_isEqual(
        getThemeConfig(this.props.themeConfig),
        getThemeConfig(prevProps.themeConfig)
      )
    ) {
      setCSSVars(getThemeConfig(this.props.themeConfig))
    }
  }

  componentWillUnmount = () => {
    clearTimeout(this.setTableHeaderValues)
    this.existingFilterTag = undefined
  }

  setInitialHeaderFilters = () => {
    if (_get(this.props, 'headerFilters.length') && _get(this.ref, 'table')) {
      this.props.headerFilters.forEach((filter) => {
        this.ref.table.setHeaderFilterValue(filter.field, filter.value)
      })
    }
  }

  cellClick = (e, cell) => {
    this.props.onCellClick(cell)
  }

  copyToClipboard = () => {
    if (this.ref && this.ref.table) {
      this.ref.table.copyToClipboard('active', true)
    }
  }

  setFilterTags = ({ isFilteringTable } = {}) => {
    const filterValues = this.ref.table.getHeaderFilters()

    if (filterValues) {
      filterValues.forEach((filter) => {
        try {
          this.existingFilterTag = document.querySelector(
            `#react-autoql-table-container-${this.TABLE_ID} .tabulator-col[tabulator-field="${filter.field}"] .filter-tag`
          )

          if (!isFilteringTable) {
            // Only add a filter tag if there isn't already one there
            if (!this.existingFilterTag) {
              const filterTagEl = document.createElement('span')
              filterTagEl.innerText = 'F'
              filterTagEl.setAttribute('class', 'filter-tag')

              const columnTitleEl = document.querySelector(
                `#react-autoql-table-container-${this.TABLE_ID} .tabulator-col[tabulator-field="${filter.field}"] .tabulator-col-title`
              )
              columnTitleEl.insertBefore(filterTagEl, columnTitleEl.firstChild)
            }
          } else if (isFilteringTable && this.existingFilterTag) {
            this.existingFilterTag.parentNode.removeChild(
              this.existingFilterTag
            )
          }
        } catch (error) {
          console.error(error)
          this.props.onErrorCallback(error)
        }
      })
    }
  }

  selectTableElements = () => {
    const filterHeaderElems = document.querySelectorAll(
      `#react-autoql-table-${this.TABLE_ID} .tabulator-header-filter`
    )
    const colHeaderElements = document.querySelectorAll(
      `#react-autoql-table-${this.TABLE_ID} .tabulator-col`
    )
    const tableContainer = document.querySelector(
      `#react-autoql-table-container-${this.TABLE_ID}`
    )
    const tableBody = document.querySelector(
      `#react-autoql-table-container-${this.TABLE_ID} .tabulator-tableHolder`
    )

    return {
      filterHeaderElems,
      colHeaderElements,
      tableContainer,
      tableBody,
    }
  }

  showFilterFields = () => {
    const {
      filterHeaderElems,
      colHeaderElements,
      tableContainer,
      tableBody,
    } = this.selectTableElements()

    this.prevContainerHeight = tableContainer.style.height
    this.prevElemDisplay = _get(filterHeaderElems, '[0].style.display')
    this.prevElemHeight = _get(colHeaderElements, '[0].style.height')
    const containerHeight = `${tableContainer.offsetHeight}px`

    this.applyStyleToElement(tableContainer, 'height', containerHeight)
    this.applyStylesToArray(filterHeaderElems, 'display', 'inline')
    this.applyStylesToArray(colHeaderElements, 'height', '72px !important')
    this.applyStyleToElement(tableBody, 'min-height', 'calc(100%-74px)')
    this.applyStyleToElement(tableBody, 'height', 'calc(100%-74px)')
    this.applyStyleToElement(tableBody, 'max-height', 'calc(100%-74px)')
  }

  hideFilterFields = () => {
    const {
      filterHeaderElems,
      colHeaderElements,
      tableContainer,
      tableBody,
    } = this.selectTableElements()

    this.applyStyleToElement(tableContainer, 'height', this.prevContainerHeight)
    this.applyStylesToArray(filterHeaderElems, 'display', this.prevElemDisplay)
    this.applyStylesToArray(colHeaderElements, 'height', this.prevElemHeight)
    this.applyStyleToElement(tableBody, 'min-height', 'calc(100%-40px)')
    this.applyStyleToElement(tableBody, 'height', 'calc(100%-40px)')
    this.applyStyleToElement(tableBody, 'max-height', 'calc(100%-40px)')
  }

  applyStyleToElement = (element, styleAttribute, styleValue) => {
    if (element) {
      element.style[styleAttribute] = styleValue
    }
  }

  applyStylesToArray = (elementArray, styleAttribute, styleValue) => {
    if (_get(elementArray, 'length')) {
      elementArray.forEach((element) => {
        this.applyStyleToElement(element, styleAttribute, styleValue)
      })
    }
  }

  toggleTableFilter = ({ isFilteringTable }) => {
    try {
      if (isFilteringTable) {
        this.showFilterFields()
        this.setFilterTags({ isFilteringTable: true })
      } else {
        this.hideFilterFields()
        this.setFilterTags({ isFilteringTable: false })
      }
    } catch (error) {
      console.error(error)
      this.props.onErrorCallback(error)
    }
  }

  render = () => {
    const options = {
      // layout: 'fitDataStretch',
      layout: 'fitDataFill',
      textSize: '9px',
      movableColumns: true,
      progressiveRender: true,
      progressiveRenderSize: 5,
      progressiveRenderMargin: 100,
      downloadConfig: {
        columnGroups: false,
        rowGroups: false,
        columnCalcs: false,
      },
      dataFiltering: (filters) => {
        // The filters provided to this function don't include header filters
        // We only use header filters so we have to use the function below
        if (this.ref && !this.firstRender) {
          const tableFilters = this.ref.table.getHeaderFilters()
          this.props.onFilterCallback(tableFilters)
        }
      },
      downloadReady: (fileContents, blob) => blob,
    }

    const supportsDrilldown = isAggregation(this.props.columns)

    return (
      <ErrorBoundary>
        <div
          id={`react-autoql-table-container-${this.TABLE_ID}`}
          data-test="react-autoql-table"
          className={`react-autoql-table-container 
          ${supportsDrilldown ? 'supports-drilldown' : ''}`}
          style={this.props.style}
        >
          {this.props.data && this.props.columns && (
            <ReactTabulator
              ref={(ref) => (this.ref = ref)}
              id={`react-autoql-table-${this.TABLE_ID}`}
              columns={this.state.columns}
              data={this.props.data}
              cellClick={this.cellClick}
              options={options}
              data-custom-attr="test-custom-attribute"
              className="react-autoql-table"
              height={this.DEFAULT_TABLE_HEIGHT}
              clipboard
              download
            />
          )}
        </div>
      </ErrorBoundary>
    )
  }
}
