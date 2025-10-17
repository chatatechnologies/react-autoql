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
        responsiveLayout: false, // Disable responsive layout to allow horizontal scrolling
        responsiveLayoutCollapseStartOpen: false,
        scrollToColumnPosition: 'middle', // Better column scrolling behavior
        scrollToColumnIfVisible: false, // Prevent unnecessary scrolling
        // Ensure horizontal scrolling is enabled
        virtualDomHoz: false, // Disable horizontal virtual DOM which can interfere with touch scrolling
        layout: 'fitDataFill', // Force this layout on mobile to ensure horizontal scrolling
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
    // Add minimal touch handling to prevent parent container scrolling when actively interacting with table
    const setupHandlers = () => {
      const tableholder = this.tableRef?.querySelector('.tabulator-tableholder')
      if (tableholder) {
        // Track if user is currently actively touching the table (not just momentum scrolling)
        let isActivelyTouchingTable = false
        let touchStartTime = 0

        this.touchStartHandler = (e) => {
          // Only mark as actively touching if the touch is directly on the table
          const target = e.target
          const isTableElement = tableholder.contains(target)

          if (isTableElement) {
            isActivelyTouchingTable = true
            touchStartTime = Date.now()

            // Stop the event from bubbling to parent containers
            // but don't prevent default to allow native table scrolling
            e.stopPropagation()

            // Add a visual indicator that the table is active (optional)
            tableholder.style.outline = '1px solid rgba(0, 123, 255, 0.3)'
          }
        }

        this.touchMoveHandler = (e) => {
          // Only stop propagation if user is actively touching the table (not momentum scrolling)
          if (isActivelyTouchingTable) {
            const target = e.target
            const isTableElement = tableholder.contains(target)

            if (isTableElement) {
              // User is actively scrolling the table, prevent parent containers from scrolling
              e.stopPropagation()
            }
          }
        }

        this.touchEndHandler = (e) => {
          // Reset interaction flag immediately when touch ends
          isActivelyTouchingTable = false

          // Only stop propagation if this was a table interaction
          const target = e.target
          const isTableElement = tableholder.contains(target)

          if (isTableElement) {
            e.stopPropagation()
          }

          // Remove visual indicator after a short delay to account for momentum
          setTimeout(() => {
            tableholder.style.outline = 'none'
          }, 100)
        }

        // Also handle touch cancel events
        this.touchCancelHandler = (e) => {
          isActivelyTouchingTable = false
          tableholder.style.outline = 'none'
        }

        // Add global touch handler to detect touches outside the table
        this.globalTouchStartHandler = (e) => {
          const target = e.target
          const isTableElement = tableholder.contains(target)

          // If user touches outside the table, remove any visual indicators
          if (!isTableElement) {
            // Remove any visual indicators
            tableholder.style.outline = 'none'
          }
        }

        // Add event listeners with passive: true to allow native scrolling
        tableholder.addEventListener('touchstart', this.touchStartHandler, {
          passive: true,
          capture: false,
        })
        tableholder.addEventListener('touchmove', this.touchMoveHandler, {
          passive: true,
          capture: false,
        })
        tableholder.addEventListener('touchend', this.touchEndHandler, {
          passive: true,
          capture: false,
        })
        tableholder.addEventListener('touchcancel', this.touchCancelHandler, {
          passive: true,
          capture: false,
        })

        // Add global touch listener to detect touches outside table
        document.addEventListener('touchstart', this.globalTouchStartHandler, {
          passive: true,
          capture: true, // Use capture to catch events before they reach other elements
        })
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
      tableholder.removeEventListener('touchstart', this.touchStartHandler, { capture: false })
      tableholder.removeEventListener('touchmove', this.touchMoveHandler, { capture: false })
      tableholder.removeEventListener('touchend', this.touchEndHandler, { capture: false })
      tableholder.removeEventListener('touchcancel', this.touchCancelHandler, { capture: false })
    }

    // Remove global touch listener
    if (this.globalTouchStartHandler) {
      document.removeEventListener('touchstart', this.globalTouchStartHandler, { capture: true })
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
    if (!this.tabulator || !this.isInitialized) {
      return Promise.resolve()
    }

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
