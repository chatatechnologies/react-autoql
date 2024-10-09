import React from 'react'
import PropTypes from 'prop-types'
import { v4 as uuid } from 'uuid'
import { cloneDeep } from 'lodash'
import { TabulatorFull as Tabulator } from 'tabulator-tables' //import Tabulator library

// use Theme(s)
import 'tabulator-tables/dist/css/tabulator.min.css'
import 'tabulator-tables/dist/css/tabulator_bootstrap3.min.css'

export default class TableWrapper extends React.Component {
  constructor(props) {
    super(props)

    this.COMPONENT_KEY = uuid()

    this.tableRef = React.createRef()
    this.tabulator = null //variable to hold your table
    this.redrawRestored = true
    this.defaultOptions = {
      // renderVerticalBuffer: 10, // Change this to help with performance if needed in the future
      // renderHorizontal: 'virtual', // Todo: test this to see if it helps with performance
      height: this.props.height || '100%',
      headerFilterLiveFilterDelay: 300,
      minHeight: 100,
      reactiveData: false,
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
    onDataProcessed: PropTypes.func,
  }

  static defaultProps = {
    tableKey: undefined,
    options: {},
    data: [],
    onDataLoadError: () => {},
    onTableBuilt: () => {},
    onCellClick: () => {},
    onDataSorting: () => {},
    onDataSorted: () => {},
    onDataFiltering: () => {},
    onDataFiltered: () => {},
    onDataProcessed: () => {},
  }

  componentDidMount = async () => {
    this._isMounted = true
    this.instantiateTabulator()
  }

  shouldComponentUpdate = () => {
    // This component should never update, or else it causes an enormous amount of redraws
    return false
  }

  componentWillUnmount = () => {
    this._isMounted = false
    this.isInitialized = false
    setTimeout(() => {
      // We must destroy the table to remove it from memory
      this.tabulator?.destroy()
    }, 1000)
  }

  instantiateTabulator = () => {
    // Instantiate Tabulator when element is mounted
    this.tabulator = new Tabulator(this.tableRef, {
      debugInvalidOptions: false,
      columns: cloneDeep(this.props.columns),
      data: this.props.options?.ajaxRequestFunc ? [] : cloneDeep(this.props.data),
      ...this.defaultOptions,
      ...this.props.options,
      // selectableRows:true, //Enable Row Selection - make rows selectable from selectable:true
      // selectableRowsRollingSelection:false, //Rolling Row Selection - disable rolling selection from selectableRollingSelection:false,
      // selectableRowsRangeMode:"click", //Range Mode - select row range on click from selectableRangeMode:"click",
      // selectableRowsPersistence:false, //Persistent Selection - disable selection peristence from selectablePersistence:false,
      // selectableRowsCheck:function(row){ // Persistent Selection - allow selection of rows where the age is greater than 18 - from selectableCheck
      //   //row - row component
      //   return row.getData().age > 18; //allow selection of rows where the age is greater than 18
      // }
    })

    this.tabulator.on('renderComplete', () => {
      // Remove this for now, since it is causing bugs with the cell click event
      // Block redraw after every update for performance
      // Restore redraw manually before updating table data
      // setTimeout(() => {
      //   this.blockRedraw()
      // }, 1000)
    })
    this.tabulator.on('dataLoadError', this.props.onDataLoadError)
    this.tabulator.on('dataProcessed', this.props.onDataProcessed)
    this.tabulator.on('cellClick', this.props.onCellClick)
    this.tabulator.on('dataSorting', this.props.onDataSorting)
    this.tabulator.on('dataSorted', this.props.onDataSorted)
    this.tabulator.on('dataFiltering', this.props.onDataFiltering)
    this.tabulator.on('dataFiltered', this.props.onDataFiltered)

    this.tabulator.on('tableBuilt', async () => {
      this.isInitialized = true
      if (this.props.options?.ajaxRequestFunc) {
        try {
          await this.tabulator.replaceData()
        } catch (error) {
          console.error(error)
        }
      }

      this.props.onTableBuilt()
    })
  }

  blockRedraw = () => {
    if (this.isInitialized) {
      this.redrawRestored = false
      this.tabulator?.blockRedraw()
    }
  }

  restoreRedraw = () => {
    if (this.tabulator && this.isInitialized && !this.redrawRestored && this._isMounted) {
      this.redrawRestored = true
      this.tabulator.restoreRedraw()
    }
  }

  addColumn = (column, before, position) => {
    if (this.tabulator) {
      return this.tabulator
        .addColumn(column, before, position)
        .then((column) => {
          this.ref?.refreshData(false, 'all')
        })
        .catch((error) => {
          console.error(error)
        })
    }
  }

  updateColumn = (name, params) => {
    return this.tabulator?.updateColumnDefinition(name, params)
  }

  updateData = (data) => {
    if (this.props.hidden) {
      // This allows current tasks to finish first
      // Makes it seems much more responsive
      return setTimeout(() => {
        this.restoreRedraw()
        return this.tabulator?.setData(data)
      }, 0)
    } else {
      this.restoreRedraw()
      return this.tabulator?.setData(data)
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
