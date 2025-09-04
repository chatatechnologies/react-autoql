import React from 'react'
import PropTypes from 'prop-types'
import { v4 as uuid } from 'uuid'
import _cloneDeep from 'lodash.clonedeep'
import { TabulatorFull as Tabulator } from 'tabulator-tables' //import Tabulator library
import throttle from 'lodash.throttle'
import { isMobile } from 'react-device-detect'

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
      autoResize: this.props.isDrilldown ? false : this.props.scope === 'dashboards' ? true : false,
      rowHeight: 25,
      layout: this.props.isDrilldown ? 'fitDataFill' : this.props.scope === 'dashboards' ? 'fitColumns' : 'fitDataFill',
      clipboard: true,
      downloadConfig: {
        columnGroups: false,
        rowGroups: false,
        columnCalcs: false,
      },
      // Mobile-specific optimizations
      ...(isMobile && {
        responsiveLayout: 'hide', // Hide columns that don't fit instead of collapsing
        responsiveLayoutCollapseStartOpen: false,
        touchUi: true, // Enable touch-friendly UI
        scrollToColumnPosition: 'middle', // Better column scrolling behavior
        scrollToColumnIfVisible: false, // Prevent unnecessary scrolling
      }),
    }
    this.throttledHandleResize = throttle(this.handleWindowResizeForAlignment, 100)
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
    onScrollVertical: PropTypes.func,
    pivot: PropTypes.bool,
    scope: PropTypes.string,
    isDrilldown: PropTypes.bool,
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
    onScrollVertical: () => {},
    pivot: false,
    scope: undefined,
    isDrilldown: false,
  }

  componentDidMount = async () => {
    this._isMounted = true
    this.instantiateTabulator()
    window.addEventListener('resize', this.throttledHandleResize)

    // Add touch event listeners for better mobile scrolling
    if (isMobile && this.tableRef) {
      this.setupMobileTouchHandlers()
    }
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
    window.removeEventListener('resize', this.throttledHandleResize)

    // Clean up mobile touch handlers
    if (isMobile && this.tableRef) {
      this.cleanupMobileTouchHandlers()
    }
  }

  handleWindowResizeForAlignment = () => {
    if (!this.tabulator) return
    this.tabulator.getColumns().forEach((column) => {
      const colDef = column.getDefinition()
      const columnMinWidth = 90
      column.getCells().forEach((cell) => {
        const cellElement = cell.getElement()
        if (!cellElement) return
        if (cellElement.clientWidth < columnMinWidth) {
          cellElement.style.textAlign = 'left'
        } else {
          cellElement.style.textAlign = colDef.hozAlign || 'right'
        }
      })
    })
  }

  setupMobileTouchHandlers = () => {
    // Find the tabulator tableholder element once it's created
    const setupHandlers = () => {
      const tableholder = this.tableRef?.querySelector('.tabulator-tableholder')
      if (tableholder) {
        // Store initial touch position to distinguish between scrolling and tapping
        let initialTouchPos = null
        let isScrolling = false

        this.touchStartHandler = (e) => {
          // Store initial touch position
          initialTouchPos = {
            x: e.touches[0].clientX,
            y: e.touches[0].clientY,
            timestamp: Date.now(),
          }
          isScrolling = false

          // Stop propagation to prevent parent containers from handling the event
          e.stopPropagation()

          // Force focus on the table container to ensure it receives subsequent touch events
          tableholder.focus({ preventScroll: true })
        }

        this.touchMoveHandler = (e) => {
          if (initialTouchPos) {
            const currentTouch = e.touches[0]
            const deltaX = Math.abs(currentTouch.clientX - initialTouchPos.x)
            const deltaY = Math.abs(currentTouch.clientY - initialTouchPos.y)

            // If user has moved more than 10px, consider it scrolling
            if (deltaX > 10 || deltaY > 10) {
              isScrolling = true
            }
          }

          // Stop propagation to prevent parent containers from handling the event
          e.stopPropagation()
        }

        this.touchEndHandler = (e) => {
          // Reset touch tracking
          initialTouchPos = null
          isScrolling = false

          // Stop propagation to prevent parent containers from handling the event
          e.stopPropagation()
        }

        // Add event listeners with proper options
        tableholder.addEventListener('touchstart', this.touchStartHandler, {
          passive: true,
          capture: true,
        })
        tableholder.addEventListener('touchmove', this.touchMoveHandler, {
          passive: true,
          capture: true,
        })
        tableholder.addEventListener('touchend', this.touchEndHandler, {
          passive: true,
          capture: true,
        })

        // Also prevent parent containers from capturing touch events
        const tableContainer = this.tableRef?.querySelector('.react-autoql-tabulator-container')
        if (tableContainer) {
          const preventParentCapture = (e) => {
            // Only prevent if the touch started within the tableholder
            if (tableholder.contains(e.target)) {
              e.stopPropagation()
            }
          }

          tableContainer.addEventListener('touchstart', preventParentCapture, {
            passive: true,
            capture: false,
          })
          tableContainer.addEventListener('touchmove', preventParentCapture, {
            passive: true,
            capture: false,
          })
        }
      } else {
        // If tableholder isn't ready yet, try again after a short delay
        setTimeout(setupHandlers, 100)
      }
    }

    setupHandlers()
  }

  cleanupMobileTouchHandlers = () => {
    const tableholder = this.tableRef?.querySelector('.tabulator-tableholder')
    if (tableholder && this.touchStartHandler) {
      tableholder.removeEventListener('touchstart', this.touchStartHandler, { capture: true })
      tableholder.removeEventListener('touchmove', this.touchMoveHandler, { capture: true })
      tableholder.removeEventListener('touchend', this.touchEndHandler, { capture: true })
    }
  }

  instantiateTabulator = () => {
    // Instantiate Tabulator when element is mounted
    this.tabulator = new Tabulator(this.tableRef, {
      debugInvalidOptions: false,
      columns: _cloneDeep(this.props.columns),
      data: this.props.options?.ajaxRequestFunc ? [] : _cloneDeep(this.props.data),
      ...this.defaultOptions,
      ...this.props.options,
    })

    this.tabulator.on('renderComplete', () => {
      this.tabulator.modules.layout.autoResize = false // Manually disable auto-resize after render
      this.tabulator.modules.layout.columnAutoResize = false

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
    this.tabulator.on('scrollVertical', this.props.onScrollVertical)

    this.tabulator.on('tableBuilt', async () => {
      this.isInitialized = true
      if (this.props.options?.ajaxRequestFunc) {
        try {
          await this.tabulator.replaceData()

          setTimeout(() => {
            // After table is built, sometimes the resize handles do not show. If we redraw the table they show up
            this.tabulator.redraw()
          }, 500)
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
