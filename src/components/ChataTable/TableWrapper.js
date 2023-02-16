import React from 'react'
import PropTypes from 'prop-types'
import { v4 as uuid } from 'uuid'
import { TabulatorFull as Tabulator } from 'tabulator-tables' //import Tabulator library
import { deepEqual } from '../../js/Util'

// use Theme(s)
import 'tabulator-tables/dist/css/tabulator.min.css'
import 'tabulator-tables/dist/css/tabulator_bootstrap3.min.css'

export default class TableWrapper extends React.Component {
  tableRef = React.createRef()
  tabulator = null //variable to hold your table
  redrawBlocked = false
  hasInstantiated = false
  COMPONENT_KEY = uuid()

  defaultOptions = {
    // height: '90%',
    // maxHeight: '100%',
    // renderVerticalBuffer: 10,
    height: '100%',
    autoResize: false,
    rowHeight: 25,
    layout: 'fitDataFill',
    clipboard: true,
    downloadConfig: {
      columnGroups: false,
      rowGroups: false,
      columnCalcs: false,
    },
  }

  static propTypes = {
    tableKey: PropTypes.string,
    options: PropTypes.shape({}),
    onDataLoadError: PropTypes.func,
    onTableBuilt: PropTypes.func,
    onCellClick: PropTypes.func,
    onDataSorting: PropTypes.func,
    onDataSorted: PropTypes.func,
    onDataFiltering: PropTypes.func,
    onDataFiltered: PropTypes.func,
  }

  static defaultProps = {
    tableKey: undefined,
    options: {},
    onDataLoadError: () => {},
    onTableBuilt: () => {},
    onCellClick: () => {},
    onDataSorting: () => {},
    onDataSorted: () => {},
    onDataFiltering: () => {},
    onDataFiltered: () => {},
  }

  shouldComponentUpdate = (nextProps) => {
    if (!this.props.hidden && !deepEqual(this.props.columns, nextProps.columns)) {
      return true
    }

    if (this.props.hidden && !nextProps.hidden) {
      return true
    }

    return false
  }

  componentDidMount = async () => {
    if (!this.props.hidden) {
      this.instantiateTabulator()
    }
  }

  componentDidUpdate = (prevProps) => {
    if (!this.props.hidden && prevProps.hidden && !this.hasInstantiated) {
      this.instantiateTabulator()
    }

    if (!deepEqual(this.props.columns, prevProps.columns)) {
      this.tabulator?.setColumns(this.props.columns)
    }
  }

  instantiateTabulator = () => {
    this.hasInstantiated = true

    // Instantiate Tabulator when element is mounted
    this.tabulator = new Tabulator(this.tableRef, {
      // reactiveData: true, // Enable data reactivity
      columns: this.props.columns, // Define table columns
      ...this.defaultOptions,
      ...this.props.options,
    })

    this.tabulator.on('renderComplete', () => {
      // Block redraw after every update for performance
      // Restore redraw manually before updating table data
      if (this.isInitialized) {
        this.blockRedraw()
      }
    })
    this.tabulator.on('dataLoadError', this.props.onDataLoadError)
    this.tabulator.on('cellClick', this.props.onCellClick)
    this.tabulator.on('dataSorting', this.props.onDataSorting)
    this.tabulator.on('dataSorted', this.props.onDataSorted)
    this.tabulator.on('dataFiltering', this.props.onDataFiltering)
    this.tabulator.on('dataFiltered', this.props.onDataFiltered)
    this.tabulator.on('tableBuilt', () => {
      this.isInitialized = true
      if (!this.props.options?.ajaxRequestFunc) {
        this.tabulator.restoreRedraw()
        this.tabulator.setData(this.props.data).then(() => {
          this.props.onTableBuilt()
        })
      } else {
        this.props.onTableBuilt()
      }
    })
  }

  blockRedraw = () => {
    if (this.tabulator) {
      this.redrawBlocked = true
      this.tabulator.blockRedraw()
    }
  }

  restoreRedraw = () => {
    if (this.tabulator) {
      this.redrawBlocked = false
      this.tabulator.restoreRedraw()
    }
  }

  render = () => {
    return (
      <div
        ref={(el) => (this.tableRef = el)}
        className={`table-condensed ${this.props.className}`}
        id={`react-tabulator-id-${this.COMPONENT_KEY}`}
        key={this.COMPONENT_KEY}
      />
    )
  }
}
