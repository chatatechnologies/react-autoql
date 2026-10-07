import React from 'react'
import PropTypes from 'prop-types'
import { v4 as uuid } from 'uuid'
import _cloneDeep from 'lodash.clonedeep'
import { sanitizePivotOptions } from './pivotUtils'
import * as TabulatorModule from 'tabulator-tables' //import Tabulator library
const Tabulator = TabulatorModule?.TabulatorFull || TabulatorModule?.Tabulator || TabulatorModule
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
      height: this.props.height !== undefined && this.props.height !== false ? this.props.height : '100%',
      headerFilterLiveFilterDelay: 300,
      minHeight: 100,
      reactiveData: false,
      autoResize: this.props.isDrilldown ? false : this.props.scope === 'dashboards' ? true : false,
      rowHeight: 28,
      layout: this.props.isDrilldown ? 'fitDataFill' : this.props.scope === 'dashboards' ? 'fitColumns' : 'fitDataFill',
      clipboard: true,
      columnGroups: this.props.pivot, // Enable column groups for pivot tables to support grouped headers
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
    onColumnMoved: PropTypes.func,
    pivot: PropTypes.bool,
    scope: PropTypes.string,
    height: PropTypes.oneOfType([PropTypes.string, PropTypes.number, PropTypes.bool]),
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
    onColumnMoved: () => {},
    pivot: false,
    scope: undefined,
    height: undefined,
    isDrilldown: false,
  }

  componentDidMount = async () => {
    this._isMounted = true

    // Building off screen is the bug, not something to repair afterwards - so a table
    // with no box waits for one. See buildWhenVisible.
    this.buildDeferred = !this.isVisible()

    if (!this.buildDeferred) {
      this.instantiateTabulator()
    }

    window.addEventListener('resize', this.throttledHandleResize)
    this.observeFirstRealHeight()

    // Mobile touch handlers attach on `tableBuilt` - the tableholder they bind to is
    // Tabulator's, and a deferred table has no tableholder to find yet.
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

    // A table closed before it was ever revealed never built, so there is nothing to
    // destroy above - and nothing should build it now either.
    this.buildDeferred = false
    this.heightObserver?.disconnect()
    this.heightObserver = undefined
    cancelAnimationFrame(this.buildFrame)

    // Clean up mobile touch handlers
    this.cleanupMobileTouchHandlers()
  }

  /**
   * Don't build a table that has nowhere to be.
   *
   * The sizing here is circular: `.react-autoql-tabulator-container` is `flex: 1` with a
   * `min-height`, so it takes its height from its content, and Tabulator is configured
   * `height: '100%'`, so it takes its height from the container. Built while visible
   * that resolves upwards - the rows lay out, the container grows to fit them. Built
   * inside a `display: none` subtree it resolves downwards: Tabulator measures nothing,
   * settles on its own `minHeight`, and the container lands on its floor of 140px.
   *
   * There is no repairing that afterwards. `redraw(true)` re-measures the container, and
   * by then the container really is 138px tall - the collapse has become the truth. So
   * the table waits instead: no box, no build. `autoResize` is off in chat scope, which
   * is why nothing else was ever going to catch this.
   *
   * The observer is how it learns it has a box. It watches the container rather than
   * this element: this element stays 0px tall until Tabulator builds into it, so it
   * never reports a size change on the reveal and would leave the table deferred
   * forever. The container has a min-height, so it does change size when it is shown.
   * The callback doesn't trust the height it is given either - buildWhenVisible asks
   * the DOM. ChataTable.onBecameVisible drives the same method from the React update
   * that reveals the tab, but a consumer that hides the chat its own way (a `hidden`
   * attribute, its own tab panel) never triggers that, so this has to work alone.
   */
  observeFirstRealHeight = () => {
    if (typeof ResizeObserver === 'undefined' || !this.tableRef || !this.buildDeferred) {
      return
    }

    const target =
      this.tableRef.closest?.('.react-autoql-tabulator-container') ?? this.tableRef.parentElement ?? this.tableRef

    this.heightObserver = new ResizeObserver(() => {
      if (!this.buildDeferred) {
        return
      }

      // Building inside the callback is what trips the "ResizeObserver loop completed
      // with undelivered notifications" warning, so hand it to the next frame - by
      // which point the layout that woke us up has settled.
      cancelAnimationFrame(this.buildFrame)
      this.buildFrame = requestAnimationFrame(() => {
        this.buildWhenVisible()
      })
    })

    this.heightObserver.observe(target)
  }

  // Also called directly by ChataTable.onBecameVisible.
  buildWhenVisible = () => {
    if (!this._isMounted || !this.buildDeferred) {
      return
    }

    // Still off screen - whatever woke us up was not the reveal. Stay deferred.
    if (!this.isVisible()) {
      return
    }

    this.buildDeferred = false
    // Its only job was this build.
    this.heightObserver?.disconnect()
    this.heightObserver = undefined
    this.instantiateTabulator()
  }

  // A table behind another display type, or in a background session tab, is inside a
  // `display: none` subtree. Reading offsetParent costs one layout; reading a cell's
  // clientWidth in there costs one per cell and answers 0 anyway.
  isVisible = () => !!this.tableRef?.offsetParent

  // Alignment skipped while hidden, replayed by ChataTable on the way back on screen.
  flushPendingAlignment = () => {
    if (!this.needsAlignmentOnShow) {
      return
    }

    this.needsAlignmentOnShow = false
    this.handleWindowResizeForAlignment()
  }

  handleWindowResizeForAlignment = () => {
    if (!this.tabulator) return

    // Every cell below is measured, and each measurement in a hidden table is both a
    // forced reflow and a wrong answer: clientWidth reads 0, so a window resize while
    // eight tabs of tables sat in the background used to left-align all of them. Defer
    // to the transition back on screen, where the numbers are real - and where one
    // table pays the cost instead of every table the user has ever opened.
    if (!this.isVisible()) {
      this.needsAlignmentOnShow = true
      return
    }

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
    if (this.touchStartHandler) {
      return
    }

    // Add minimal touch handling to prevent parent container scrolling when actively interacting with table
    let retriesLeft = 10
    const setupHandlers = () => {
      if (!this._isMounted) {
        return
      }

      const tableholder = this.tableRef?.querySelector('.tabulator-tableholder')
      if (tableholder) {
        // Track if user is currently actively touching the table (not just momentum scrolling)
        let isActivelyTouchingTable = false
        let touchStartTime = 0

        this.touchStartHandler = (e) => {
          // Only mark as actively touching if the touch is directly on the table
          const target = e.target
          if (!tableholder.contains(target)) return

          isActivelyTouchingTable = true
          touchStartTime = Date.now()

          // Stop the event from bubbling to parent containers
          // but don't prevent default to allow native table scrolling
          e.stopPropagation()

          // Add a visual indicator that the table is active (optional)
          tableholder.style.outline = '1px solid rgba(0, 123, 255, 0.3)'
        }

        this.touchMoveHandler = (e) => {
          // Only stop propagation if user is actively touching the table (not momentum scrolling)
          if (!isActivelyTouchingTable) return
          if (!tableholder.contains(e.target)) return
          // User is actively scrolling the table, prevent parent containers from scrolling
          e.stopPropagation()
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
      } else if (retriesLeft-- > 0) {
        // If tableholder isn't ready yet, try again after a short delay. Bounded and
        // tracked - an unbounded loop here outlived the table it was waiting for.
        this.touchSetupTimeout = setTimeout(setupHandlers, 100)
      }
    }

    setupHandlers()
  }

  cleanupMobileTouchHandlers = () => {
    clearTimeout(this.touchSetupTimeout)

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

    // Pivot tables now use ajaxRequestFunc with progressive loading like regular tables
    const isPivot = !!this.props.pivot
    const passedOptions = sanitizePivotOptions(this.props.options, isPivot)

    const initialData = passedOptions?.ajaxRequestFunc ? [] : _cloneDeep(this.props.data)

    this.tabulator = new Tabulator(this.tableRef, {
      debugInvalidOptions: false,
      columns: _cloneDeep(this.props.columns),
      data: initialData,
      ...this.defaultOptions,
      ...passedOptions,
    })

    this.attachTabulatorEventHandlers(this.tabulator)
    this.silenceProgressiveLoadNextPageRejections(this.tabulator)

    this.tabulator.on('tableBuilt', async () => {
      this.isInitialized = true

      if (isMobile && this.tableRef) {
        this.setupMobileTouchHandlers()
      }

      if (this.props.options?.ajaxRequestFunc) {
        try {
          await this.tabulator.replaceData()

          // Two rAF frames ensure react-grid-layout has applied final tile dimensions before fitColumns runs.
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              if (this._isMounted && this.tabulator) {
                this.tabulator.redraw(true)
              }
            })
          })
        } catch (error) {
          console.error(error)
        }
      }

      this.props.onTableBuilt()
    })
  }

  // Tabulator's progressive-load nextPage() runs in an un-awaited setTimeout that rejects uncatchably if a reload changes pagination first
  silenceProgressiveLoadNextPageRejections = (tabulator) => {
    const pageModule = tabulator?.modules?.page
    if (!pageModule || pageModule.__nextPagePatched) return
    const originalNextPage = pageModule.nextPage.bind(pageModule)
    pageModule.nextPage = (...args) => originalNextPage(...args)?.catch?.(() => {})
    pageModule.__nextPagePatched = true
  }

  // Temporarily block Tabulator redraws; callers must call `restoreRedraw()` (use try/finally).
  blockRedraw = () => {
    if (this.isInitialized) {
      this.redrawRestored = false
      this.tabulator?.blockRedraw?.()
    }
  }

  // Restore Tabulator redraws if previously blocked (no-op if already enabled).
  restoreRedraw = () => {
    if (this.tabulator && this.isInitialized && !this.redrawRestored && this._isMounted) {
      this.redrawRestored = true
      this.tabulator?.restoreRedraw?.()
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

  attachTabulatorEventHandlers = (tabulator) => {
    tabulator.on('renderComplete', () => {
      // Leave autoResize enabled when clientWidth === 0 so tabulator reflows once the container reaches its final size.
      if (!this.tableRef || this.tableRef.clientWidth > 0) {
        tabulator.modules.layout.autoResize = false
        tabulator.modules.layout.columnAutoResize = false
      }
    })
    tabulator.on('dataLoadError', this.props.onDataLoadError)
    tabulator.on('dataProcessed', this.props.onDataProcessed)
    tabulator.on('cellClick', this.props.onCellClick)
    tabulator.on('dataSorting', this.props.onDataSorting)
    tabulator.on('dataSorted', this.props.onDataSorted)
    tabulator.on('dataFiltering', this.props.onDataFiltering)
    tabulator.on('dataFiltered', this.props.onDataFiltered)
    tabulator.on('scrollVertical', this.props.onScrollVertical)
    tabulator.on('columnMoved', this.props.onColumnMoved)
  }

  recreateTabulatorForPivot = (data) => {
    // Destroy and recreate the tabulator instance for pivot tables to ensure a clean state
    try {
      if (this.tabulator) {
        this.tabulator.destroy()
      }
    } catch (e) {
      console.error('TableWrapper.recreateTabulatorForPivot: error destroying tabulator', e)
    }

    // Defensive: sanitize options for pivot recreation
    const passedOptions = sanitizePivotOptions(this.props.options, true)

    const initialData = _cloneDeep(Array.isArray(data) ? data : [])

    this.tabulator = new Tabulator(this.tableRef, {
      debugInvalidOptions: false,
      columns: _cloneDeep(this.props.columns),
      data: initialData,
      ...this.defaultOptions,
      ...passedOptions,
    })

    this.attachTabulatorEventHandlers(this.tabulator)
    this.silenceProgressiveLoadNextPageRejections(this.tabulator)

    // Mark initialized and notify parent
    this.isInitialized = true
    try {
      this.props.onTableBuilt()
    } catch (e) {
      console.error('TableWrapper.recreateTabulatorForPivot: onTableBuilt threw', e)
    }
  }

  updateData = (data) => {
    if (!this.tabulator || !this.isInitialized) {
      return Promise.resolve()
    }

    if (this.props.hidden) {
      // This allows current tasks to finish first
      // Makes it seems much more responsive
      return new Promise((resolve) => {
        setTimeout(() => {
          this.restoreRedraw()
          resolve(this.tabulator?.setData(data))
        }, 0)
      })
    }

    this.restoreRedraw()

    // Pivot tables now use ajaxRequestFunc with progressive loading like regular tables
    // No need to recreate the tabulator - let ajaxRequestFunc handle data loading
    return this.tabulator?.setData(data)
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
