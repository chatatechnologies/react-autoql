import React from 'react'
import { v4 as uuid } from 'uuid'
import PropTypes from 'prop-types'
import _isEqual from 'lodash.isequal'
import _cloneDeep from 'lodash.clonedeep'
import RGL, { WidthProvider } from 'react-grid-layout'
import pako from 'pako'

import {
  deepEqual,
  mergeSources,
  authenticationDefault,
  autoQLConfigDefault,
  dataFormattingDefault,
  getAutoQLConfig,
} from 'autoql-fe-utils'

import { Tooltip } from '../Tooltip'
import DrilldownModal from './DrilldownModal'
import { DashboardToolbar } from '../DashboardToolbar'
import { DashboardTile } from './DashboardTile'
import { ErrorBoundary } from '../../containers/ErrorHOC'

import { withTheme } from '../../theme'
import { authenticationType, autoQLConfigType, dataFormattingType } from '../../props/types'

import './Dashboard.scss'
import 'react-grid-layout/css/styles.css'
import 'react-splitter-layout/lib/index.css'

const ReactGridLayout = WidthProvider(RGL)

class DashboardWithoutTheme extends React.Component {
  constructor(props) {
    super(props)

    this.COMPONENT_KEY = uuid()
    this.SOURCE = mergeSources(props.source, 'dashboards')
    this.TOOLTIP_ID = `react-autoql-dashboard-toolbar-btn-tooltip-${this.COMPONENT_KEY}`
    this.CHART_TOOLTIP_ID = `react-autoql-dashboard-chart-tooltip-${this.COMPONENT_KEY}`
    this.tileRefs = {}
    this.debounceTime = 50
    this.onChangeTiles = null
    this.callbackSubsciptions = []
    this.tileLog = [props.tiles]
    this.currentLogIndex = 0
    this.isResettingTile = false
    this.resettingTileId = null

    if (props.enableAjaxTableData !== undefined) {
      console.warn(
        'enableAjaxtableData is deprecated - the provided prop will be ignored and the default value of "true" will be used instead.',
      )
    }

    // initialSlicers comes from API and is in format: [{ type: "VL", data: {...} }]
    const getSlicersArray = () => {
      if (Array.isArray(props.initialSlicers)) {
        return props.initialSlicers
      }
      return []
    }

    this.state = {
      isDragging: false,
      isReportProblemOpen: false,
      isResizingDrilldown: false,
      uneditedDashboardTiles: null,
      dashboardSlicers: getSlicersArray(),
    }
  }

  static propTypes = {
    // Global
    authentication: authenticationType,
    autoQLConfig: autoQLConfigType,
    dataFormatting: dataFormattingType,

    tiles: PropTypes.arrayOf(PropTypes.shape({})),
    executeOnMount: PropTypes.bool,
    dataPageSize: PropTypes.number,
    executeOnStopEditing: PropTypes.bool,
    disableAggregationMenu: PropTypes.bool,
    allowCustomColumnsOnDrilldown: PropTypes.bool,
    isEditing: PropTypes.bool,
    isEditable: PropTypes.bool,
    notExecutedText: PropTypes.oneOfType([PropTypes.string, PropTypes.element]),
    onChange: PropTypes.func,
    enableDynamicCharting: PropTypes.bool,
    onErrorCallback: PropTypes.func,
    onSuccessCallback: PropTypes.func,
    autoChartAggregations: PropTypes.bool,
    onCSVDownloadStart: PropTypes.func,
    onCSVDownloadProgress: PropTypes.func,
    onCSVDownloadFinish: PropTypes.func,
    onPNGDownloadFinish: PropTypes.func,
    cancelQueriesOnUnmount: PropTypes.bool,
    startEditingCallback: PropTypes.func,
    stopEditingCallback: PropTypes.func,
    onSaveCallback: PropTypes.func,
    onDeleteCallback: PropTypes.func,
    showToolbar: PropTypes.bool,
    refreshInterval: PropTypes.number,
    dashboardId: PropTypes.string,
    enableAutoRefresh: PropTypes.bool,
    slicerSuggestion: PropTypes.string,
    initialSlicers: PropTypes.arrayOf(
      PropTypes.shape({
        type: PropTypes.string,
        data: PropTypes.shape({}),
      }),
    ),
    enableSlicers: PropTypes.bool,
    enableCyclicalDates: PropTypes.bool,
    enableMagicWand: PropTypes.bool,
    showMagicWandQuoteButton: PropTypes.bool,
  }

  static defaultProps = {
    // Global
    authentication: authenticationDefault,
    autoQLConfig: autoQLConfigDefault,
    dataFormatting: dataFormattingDefault,

    tiles: [],
    executeOnMount: false,
    dataPageSize: undefined,
    executeOnStopEditing: false,
    isEditing: false,
    isEditable: true,
    notExecutedText: undefined,
    enableDynamicCharting: true,
    autoChartAggregations: true,
    cancelQueriesOnUnmount: false,
    showToolbar: false,
    refreshInterval: 60,
    enableCyclicalDates: false,
    onErrorCallback: () => {},
    onSuccessCallback: () => {},
    onChange: () => {},
    onCSVDownloadStart: () => {},
    onCSVDownloadProgress: () => {},
    onCSVDownloadFinish: () => {},
    startEditingCallback: () => {},
    stopEditingCallback: () => {},
    onSaveClick: () => {},
    onDeleteCallback: () => {},
    dashboardId: undefined,
    enableAutoRefresh: false,
    slicerSuggestion: undefined,
    enableSlicers: false,
    enableMagicWand: false,
    showMagicWandQuoteButton: false,
  }

  static getDerivedStateFromProps(nextProps, prevState) {
    if (!prevState.wasEditing && nextProps.isEditing) {
      return {
        wasEditing: true,
        uneditedDashboardTiles: _cloneDeep(nextProps.tiles),
      }
    }
    if (prevState.wasEditing && !nextProps.isEditing) {
      return { wasEditing: false }
    }
    return null
  }

  componentDidMount = () => {
    this._isMounted = true
    if (this.props.executeOnMount) {
      // Execute only tiles that don't have queryResponse
      // Use requestAnimationFrame to ensure tile refs are set
      requestAnimationFrame(() => {
        if (!this._isMounted) return

        const tiles = this.props.tiles || []
        const tilesToExecute = tiles.filter((tile) => !tile.queryResponse && !tile.secondQueryResponse)

        if (tilesToExecute.length > 0) {
          const promises = []
          tilesToExecute.forEach((tile) => {
            const tileRef = this.tileRefs[tile.key] || this.tileRefs[tile.i]
            if (tileRef && tileRef.processTile) {
              promises.push(tileRef.processTile())
            }
          })

          if (promises.length > 0) {
            Promise.all(promises).catch((error) => {
              console.error('Error executing tiles:', error)
            })
          }
        }
      })
    }
    window.addEventListener('resize', this.onWindowResize)
  }

  getSlicersArrayFromProps = (props) => {
    if (Array.isArray(props.initialSlicers)) {
      return props.initialSlicers
    }
    return []
  }

  shouldComponentUpdate = (nextProps, nextState) => {
    return !deepEqual(this.props, nextProps) || !deepEqual(this.state, nextState)
  }

  componentDidUpdate = (prevProps, prevState) => {
    // Update slicers if initialSlicers prop changes, but preserve state slicers when entering edit mode
    const currentSlicers = this.getSlicersArrayFromProps(this.props)
    const prevSlicers = this.getSlicersArrayFromProps(prevProps)
    const isEnteringEditMode = !prevProps.isEditing && this.props.isEditing

    // Only update from props if:
    // 1. initialSlicers prop actually changed
    // 2. We're not entering edit mode (preserve user's slicer selections)
    // 3. State slicers are empty (don't override user changes)
    // Never update from props when entering edit mode to preserve any slicers user added
    if (
      !deepEqual(currentSlicers, prevSlicers) &&
      !isEnteringEditMode &&
      this.state.dashboardSlicers.length === 0
    ) {
      this.setState({ dashboardSlicers: currentSlicers })
    }

    // Re-run dashboard once exiting edit mode (if prop is set to true).
    // Skip when a single-tile reset is in flight — the parent's onSaveCallback
    // commonly toggles isEditing as a side effect, and we don't want that to
    // trigger a full-dashboard refresh on top of the single-tile reset.
    if (
      prevProps.isEditing &&
      !this.props.isEditing &&
      this.props.executeOnStopEditing &&
      !this.isResettingTile
    ) {
      this.executeDashboard()
    }

    if (!prevProps.isEditing && this.props.isEditing) {
      this.refreshTileLayouts()
      this.setState({ uneditedDashboardTiles: _cloneDeep(this.props.tiles) })
    }

    // Re-execute dashboard when slicers change (force execution to rerun all tiles)
    if (!deepEqual(prevState.dashboardSlicers, this.state.dashboardSlicers)) {
      this.props.enableAutoRefresh ? this.executeCachedDashboard() : this.executeDashboard(true)
      // Notify parent of slicer changes via onChange callback
      const tiles = this.getMostRecentTiles()
      this.debouncedOnChange(tiles, true, [])
    }

    if (this.props.isEditing !== prevProps.isEditing) {
      this.resetTileStateLog()
      this.setState({ isDragging: true }, () => {
        this.setState({ isDragging: false })
      })
    }
  }

  handleSlicerChange = (slicer) => {
    // Add new slicer to array
    if (slicer) {
      // Check if slicer already exists (by key or canonical_key)
      const slicerKey = slicer.key || slicer.canonical_key
      const exists = this.state.dashboardSlicers.some(
        (s) => (s.data?.key || s.data?.canonical_key) === slicerKey && (s.data?.value || '') === (slicer.value || '')
      )
      
      if (!exists) {
        const newSlicer = {
          type: 'VL',
          data: slicer,
        }
        this.setState({
          dashboardSlicers: [...this.state.dashboardSlicers, newSlicer],
        })
      }
    }
  }

  handleRemoveSlicer = (slicerToRemove) => {
    // Remove slicer from array
    const slicerKey = slicerToRemove.key || slicerToRemove.canonical_key
    const slicerValue = slicerToRemove.value || ''
    
    this.setState({
      dashboardSlicers: this.state.dashboardSlicers.filter(
        (s) => !((s.data?.key || s.data?.canonical_key) === slicerKey && (s.data?.value || '') === slicerValue)
      ),
    })
  }

  componentWillUnmount = () => {
    try {
      this._isMounted = false
      window.removeEventListener('resize', this.onWindowResize)
      clearTimeout(this.scrollToNewTileTimeout)
      clearTimeout(this.stopDraggingTimeout)
      clearTimeout(this.animationTimeout)
      clearTimeout(this.resetGuardTimer)
    } catch (error) {
      console.error(error)
    }
  }

  resetTileStateLog = () => {
    if (this.tileLog?.[0]) {
      this.tileLog = [this.tileLog[0]]
    } else {
      this.tileLog = [this.getMostRecentTiles()]
    }

    this.currentLogIndex = 0
  }

  getMostRecentTiles = () => {
    if (this.onChangeTiles) {
      return this.onChangeTiles
    }
    return this.props.tiles
  }

  subscribeToCallback = (callbackArray) => {
    this.callbackSubsciptions = [...this.callbackSubsciptions, ...callbackArray]
  }

  debouncedOnChange = (tiles, saveInLog = true, callbackArray = []) => {
    this.onChangeTiles = _cloneDeep(tiles)
    const debouncedPromise = new Promise((resolve, reject) => {
      try {
        this.subscribeToCallback([resolve])
        if (callbackArray?.length) {
          this.subscribeToCallback(callbackArray)
        }

        if (saveInLog) {
          this.addTileStateToLog(this.onChangeTiles)
        }

        if (this.onChangeTimer) {
          clearTimeout(this.onChangeTimer)
        }

        this.onChangeTimer = setTimeout(() => {
          if (this.onChangeTiles) {
            // Always use state slicers (even if empty) to reflect user changes
            // If state is explicitly set to empty array, send empty array, not initialSlicers
            // If slicers are disabled, always send empty array
            const slicers =
              this.props.enableSlicers && Array.isArray(this.state.dashboardSlicers) ? this.state.dashboardSlicers : []
            this.props.onChange(this.onChangeTiles, slicers)
            this.onChangeTiles = null
            if (this.callbackSubsciptions?.length) {
              const callbackArray = _cloneDeep(this.callbackSubsciptions)
              this.callbackSubsciptions = []
              callbackArray.forEach((callback, i) => {
                this.callbackSubsciptionTimer = setTimeout(() => {
                  callback()
                }, (i + 1) * 50)
              })
              return
            }
            return resolve()
          }
          return resolve()
        }, this.debounceTime)
      } catch (error) {
        console.error(error)
        this.callbackSubsciptions = []
        return reject()
      }
    })

    return debouncedPromise
  }

  onWindowResize = (e) => {
    if (!this.currentWindowWidth) {
      this.currentWindowWidth = window.innerWidth
    }

    const hasWidthChanged = e.target.innerWidth !== this.currentWindowWidth
    if (!hasWidthChanged) {
      return
    }

    if (this._isMounted) {
      if (!this.state.isWindowResizing) {
        this.currentWindowWidth = window.innerWidth
        this.setState({ isWindowResizing: true })
      }

      // Only re-render if width changed
      if (hasWidthChanged) {
        this.windowResizeTimer = setTimeout(() => {
          if (hasWidthChanged && this._isMounted) {
            this.currentWindowWidth = undefined
            this.setState({ isWindowResizing: false })
          }
        }, 500)
      }
    }
  }

  refreshTileLayouts = () => {
    try {
      for (var dashboardTile in this.tileRefs) {
        if (this.tileRefs[dashboardTile]) {
          this.tileRefs[dashboardTile].refreshLayout()
        }
      }
    } catch (error) {
      console.error(error)
    }
  }

  executeDashboard = (forceExecution = false) => {
    try {
      const promises = []
      const tiles = this.getMostRecentTiles()

      for (var dashboardTile in this.tileRefs) {
        if (this.tileRefs[dashboardTile]) {
          // Find the corresponding tile to check if it already has data
          const tile = tiles.find((t) => t.key === dashboardTile || t.i === dashboardTile)

          // If we're in the middle of a single-tile reset, skip the tile being
          // reset — resetTile already calls processTile on it directly.
          if (
            this.isResettingTile &&
            this.resettingTileId &&
            (tile?.i === this.resettingTileId || tile?.key === this.resettingTileId)
          ) {
            continue
          }

          // Only execute tiles that don't already have queryResponse, unless forceExecution is true
          if (forceExecution || (!tile?.queryResponse && !tile?.secondQueryResponse)) {
            promises.push(this.tileRefs[dashboardTile].processTile())
          }
        }
      }

      if (promises.length === 0) {
        return Promise.resolve()
      }

      return Promise.all(promises).catch(() => {
        return Promise.reject(new Error('There was an error processing this dashboard. Please try again.'))
      })
    } catch (error) {
      console.error(error)
      return undefined
    }
  }

  executeCachedDashboard = () => {
    try {
      const promises = []
      for (var dashboardTile in this.tileRefs) {
        if (this.tileRefs[dashboardTile]) {
          promises.push(this.tileRefs[dashboardTile].processTile({ isCachedRefresh: true }))
        }
      }

      return Promise.all(promises).catch(() => {
        return Promise.reject(new Error('There was an error processing this dashboard. Please try again.'))
      })
    } catch (error) {
      console.error(error)
      return undefined
    }
  }

  executeSingleTile = (tileId) => {
    const directRef = this.tileRefs?.[tileId] || this.tileRefs?.[String(tileId)]
    if (directRef?.processTile) {
      return this.props.enableAutoRefresh
        ? directRef.processTile({ isCachedRefresh: true })
        : directRef.processTile()
    }

    const tiles = this.getMostRecentTiles() || []
    const tile = tiles.find(
      (t) =>
        t?.i === tileId ||
        t?.key === tileId ||
        String(t?.i) === String(tileId) ||
        String(t?.key) === String(tileId),
    )

    const fallbackRef = this.tileRefs?.[tile?.key] || this.tileRefs?.[tile?.i]
    if (fallbackRef?.processTile) {
      return this.props.enableAutoRefresh
        ? fallbackRef.processTile({ isCachedRefresh: true })
        : fallbackRef.processTile()
    }

    return Promise.resolve()
  }

  unExecuteDashboard = () => {
    try {
      for (var dashboardTile in this.tileRefs) {
        if (this.tileRefs[dashboardTile]) {
          this.tileRefs[dashboardTile].clearQueryResponses()
        }
      }
    } catch (error) {
      console.error(error)
    }
  }

  getChangeDetection = (oldTiles, newTiles, ignoreInputs) => {
    return !_isEqual(
      this.getChangeDetectionTileStructure(oldTiles, ignoreInputs),
      this.getChangeDetectionTileStructure(newTiles, ignoreInputs),
    )
  }

  getChangeDetectionTileStructure = (tiles, ignoreInputs) => {
    try {
      if (tiles?.length) {
        const newTiles = tiles.map((tile) => {
          if (!tile) {
            return
          }

          return {
            query: !ignoreInputs && tile.query,
            title: !ignoreInputs && tile.title,
            i: tile.i,
            w: tile.w,
            h: tile.h,
            x: tile.x,
            y: tile.y,
          }
        })

        return newTiles
      }
    } catch (error) {
      console.error(error)
    }

    return tiles
  }

  scrollToNewTile = (key) => {
    this.scrollToNewTileTimeout = setTimeout(() => {
      try {
        const newTileRef = this.tileRefs?.[key]?.ref
        if (newTileRef) {
          const dashboardBbox = this.ref?.parentElement?.getBoundingClientRect()
          const dashboardTop = dashboardBbox.y
          const dashboardBottom = dashboardTop + dashboardBbox.height
          const tileBbox = newTileRef?.getBoundingClientRect()
          const tileTop = tileBbox.y
          const tileBottom = tileTop + tileBbox.height

          if (tileBottom > dashboardBottom) {
            newTileRef.scrollIntoView(false)
          } else if (tileTop < dashboardTop) {
            newTileRef.scrollIntoView(true)
          }
        }
      } catch (error) {}
    }, 200)
  }

  refreshLayout = () => {
    // Must dispatch a resize event for react-grid-layout to update
    window.dispatchEvent(new Event('resize'))

    // Must toggle resizing on then off for charts to detect the change and resize
    this.setState({ isWindowResizing: true }, () => {
      this.setState({
        isWindowResizing: false,
      })
    })
  }

  onMoveStart = (layout, oldItem, newItem, placeholder, e, element) => {
    this.setIsDragging(true)
    return
  }

  onDrag = (layout, oldItem, newItem, placeholder, e, element) => {
    e.stopPropagation()
  }

  setIsDragging = (isDragging) => {
    if (this._isMounted && isDragging !== this.state.isDragging && this.isDragging !== isDragging) {
      this.isDragging = isDragging
      this.setState({ isDragging })
    }
    return
  }

  addTileStateToLog = (tiles) => {
    if (!this.props.isEditing || !tiles) {
      return
    }

    if (!this.getChangeDetection(tiles, this.tileLog[this.currentLogIndex], true)) {
      return
    }

    this.tileLog.unshift(_cloneDeep(tiles))
  }

  onMoveEnd = (layout, oldItem, newItem, placeholder, e, element) => {
    try {
      // Update previousTileState here instead of in updateTileLayout
      // Only update if layout actually changed
      const tiles = this.getMostRecentTiles()
      if (this.getChangeDetection(tiles, layout, true)) {
        this.addTileStateToLog(tiles)
      }

      // Delaying this makes the snap back animation much smoother
      // after moving a tile
      clearTimeout(this.stopDraggingTimeout)
      this.stopDraggingTimeout = setTimeout(() => {
        this.setIsDragging(false)
      }, 0)
    } catch (error) {
      console.error(error)
    }
    return
  }

  updateTileLayout = (layout) => {
    try {
      const oldTiles = this.getMostRecentTiles()
      const tiles = oldTiles.map((tile, index) => {
        return {
          ...tile,
          ...layout[index],
        }
      })

      // This function is called when anything updates, including automatic
      // re-adjustment of all tiles after moving a single tile. So we do not
      // want to trigger the undo state on this action. Only on main actions
      // directly caused from user interaction
      this.debouncedOnChange(tiles, false)
    } catch (error) {
      console.error(error)
    }
  }

  addTile = (content) => {
    try {
      const tiles = _cloneDeep(this.getMostRecentTiles())
      const id = uuid()
      let tile = {
        key: id,
        i: id,
        w: 6,
        h: 5,
        x: (Object.keys(tiles).length * 6) % 12,
        y: Number.MAX_VALUE,
        query: '',
        title: '',
      }

      if (content?.queryResponse) {
        tile = {
          ...tile,
          ...content,
        }
      }

      tiles.push(tile)

      this.debouncedOnChange(tiles)
        .then(() => {
          this.scrollToNewTile(id)
        })
        .catch((error) => {
          console.error(error)
        })
    } catch (error) {
      console.error(error)
    }
  }

  changeCurrentTileState = (logIndex) => {
    try {
      const newTileState = _cloneDeep(this.tileLog[logIndex])

      if (newTileState) {
        this.currentLogIndex = logIndex
        this.debouncedOnChange(newTileState, false)
      }
    } catch (error) {
      console.error(error)
    }
  }

  undo = () => {
    if (!this.props.isEditing) {
      console.warn(
        'Unable perform "undo" action outside of edit mode. Set the isEditing prop to true to enable edit mode.',
      )
      return
    }

    this.changeCurrentTileState(this.currentLogIndex + 1)
  }

  redo = () => {
    if (!this.props.isEditing) {
      console.warn(
        'Unable perform "redo" action outside of edit mode. Set the isEditing prop to true to enable edit mode.',
      )
      return
    }

    this.changeCurrentTileState(this.currentLogIndex - 1)
  }

  deleteTile = (id) => {
    try {
      const tiles = _cloneDeep(this.getMostRecentTiles())
      const tileIndex = tiles.map((item) => item.i).indexOf(id)
      ~tileIndex && tiles.splice(tileIndex, 1)

      this.debouncedOnChange(tiles)
    } catch (error) {
      console.error(error)
    }
  }

  exportDashboard = () => {
    try {
      const tiles = this.getMostRecentTiles()

      // Create the dashboard export object with complete tile state
      // Prioritize state slicers (if changed) over initialSlicers prop
      const slicers =
        this.state.dashboardSlicers.length > 0 ? this.state.dashboardSlicers : this.props.initialSlicers || []

      const dashboardExport = {
        version: '1.0',
        exportDate: new Date().toISOString(),
        dashboard: {
          title: this.props.title || 'Untitled Dashboard',
          slicers: slicers,
          tiles: tiles.map((tile) => {
            // Save the entire tile state
            return { ...tile }
          }),
          props: {
            dataPageSize: this.props.dataPageSize,
          },
        },
      }

      // Convert to JSON string
      const jsonStr = JSON.stringify(dashboardExport, null, 2)

      // Compress using gzip
      const compressed = pako.gzip(jsonStr)

      // Create blob with compressed data
      const dataBlob = new Blob([compressed], { type: 'application/gzip' })
      const url = URL.createObjectURL(dataBlob)
      const link = document.createElement('a')
      link.href = url

      // Generate filename with sanitized title and timestamp
      const sanitizedTitle = (this.props.title || 'dashboard').replace(/[^a-z0-9]/gi, '_').toLowerCase()
      const timestamp = new Date().toISOString().split('T')[0]
      link.download = `${sanitizedTitle}_${timestamp}.aqldash`

      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error exporting dashboard:', error)
    }
  }

  importDashboard = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()

      reader.onload = (e) => {
        try {
          const uint8Array = new Uint8Array(e.target.result)

          // Try to decompress - if it fails, assume it's uncompressed JSON
          let jsonStr
          try {
            jsonStr = pako.ungzip(uint8Array, { to: 'string' })
          } catch (decompressError) {
            // Fallback to plain text for backwards compatibility with old uncompressed files
            jsonStr = new TextDecoder().decode(uint8Array)
          }

          const dashboardData = JSON.parse(jsonStr)

          // Ensure slicers is always an array (even if empty)
          if (dashboardData?.dashboard && !dashboardData.dashboard.slicers) {
            dashboardData.dashboard.slicers = []
          }

          resolve(dashboardData)
        } catch (error) {
          reject(new Error('Failed to parse dashboard file: ' + error.message))
        }
      }

      reader.onerror = () => reject(new Error('Failed to read file'))
      reader.readAsArrayBuffer(file)
    })
  }

  setParamsForTile = (params, id, callbackArray) => {
    try {
      const originalTiles = this.getMostRecentTiles()
      const tiles = _cloneDeep(originalTiles)
      const tileIndex = tiles.map((item) => item.i).indexOf(id)

      tiles[tileIndex] = {
        ...tiles[tileIndex],
        ...params,
      }

      if (Object.keys(params).includes('query') && params.query !== originalTiles[tileIndex]?.query) {
        tiles[tileIndex].dataConfig = undefined
        tiles[tileIndex].skipQueryValidation = false
      } else if (
        Object.keys(params).includes('secondQuery') &&
        params.secondQuery !== originalTiles[tileIndex]?.secondQuery
      ) {
        tiles[tileIndex].secondDataConfig = undefined
        tiles[tileIndex].secondskipQueryValidation = false
      }

      this.debouncedOnChange(tiles, true, callbackArray)
    } catch (error) {
      console.error(error)
    }
  }

  resetTile = (id) => {
    try {
      const tiles = _cloneDeep(this.getMostRecentTiles())
      const tileIndex = tiles.map((item) => item.i).indexOf(id)

      if (tileIndex < 0) {
        console.warn(`Tile with ID ${id} not found for reset`)
        return
      }

      // Clear filters, custom columns, sorts and cached responses; preserve query and title
      tiles[tileIndex] = {
        ...tiles[tileIndex],
        tableFilters: [],
        filters: [],
        secondTableFilters: [],
        columnSelects: [],
        // Also clear any stored columns/available selects/display overrides so UI reflects reset
        columns: [],
        available_selects: [],
        displayOverrides: [],
        orders: [],
        secondOrders: [],
        queryResponse: null,
        secondQueryResponse: null,
      }

      // Mark a reset cycle as in flight so other code paths (executeDashboard,
      // exit-edit-mode handler, etc.) know to skip this tile / not refresh.
      this.isResettingTile = true
      this.resettingTileId = id

      // Helper that re-runs ONLY this single tile. We deliberately avoid touching
      // any other tileRefs so the rest of the dashboard isn't refreshed.
      const runSingleTile = () => {
        const updatedTile = tiles[tileIndex]
        const refKey = updatedTile?.key || updatedTile?.i
        const tileRef = this.tileRefs[refKey]
        const hasQuery = !!(updatedTile?.query || updatedTile?.secondQuery)
        if (tileRef?.processTile && hasQuery) {
          // Mirror executeSingleTile semantics so auto-refresh dashboards use cached path
          return this.props.enableAutoRefresh
            ? tileRef.processTile({ isCachedRefresh: true })
            : tileRef.processTile()
        }
        return Promise.resolve()
      }

      const clearResetGuard = () => {
        // Defer one tick so any componentDidUpdate triggered by the parent's
        // save-driven setState (e.g. isEditing toggle) sees the guard before we drop it.
        clearTimeout(this.resetGuardTimer)
        this.resetGuardTimer = setTimeout(() => {
          this.isResettingTile = false
          this.resettingTileId = null
        }, 0)
      }

      // Sequence:
      // 1) Push the cleared tile state up so this.props.tile is fresh for processTile.
      // 2) Re-run only this tile and wait for it to finish (so its new queryResponse
      //    is propagated up via endTopQuery -> setParamsForTile -> onChange).
      // 3) THEN trigger the save callback. The reset guard is held until after
      //    the save resolves so the parent's isEditing toggle (a common side
      //    effect of saveDashboard) can't trigger executeOnStopEditing -> full refresh.
      this.debouncedOnChange(tiles, true)
        .then(() => runSingleTile())
        .then(() => {
          if (this.props.onSaveCallback) {
            return Promise.resolve(this.props.onSaveCallback()).catch((error) => {
              console.error('Error saving after tile reset:', error)
            })
          }
        })
        .then(clearResetGuard)
        .catch((error) => {
          console.error('Error during tile reset:', error)
          // Best-effort: still try to run the single tile if the chain failed early
          try {
            runSingleTile()
          } catch (err) {
            console.error('Error processing tile after reset (fallback):', err)
          }
          clearResetGuard()
        })
    } catch (error) {
      console.error(error)
    }
  }

  onDrilldownStart = ({ tileId, activeKey, isSecondHalf, queryOutputRef }) => {
    if (getAutoQLConfig(this.props.autoQLConfig).enableDrilldowns) {
      this.activeDrilldownRef = queryOutputRef
      this.setState({
        isDrilldownRunning: true,
        isDrilldownChartHidden: false,
        isDrilldownModalVisible: true,
        isDrilldownSecondHalf: isSecondHalf,
        activeDrilldownTile: tileId || this.state.activeDrilldownTile,
        activeDrilldownResponse: null,
        activeDrilldownChartElementKey: activeKey,
        isAnimatingModal: !this.state.isDrilldownModalVisible,
      })

      this.animationTimeout = setTimeout(() => {
        if (this._isMounted) {
          this.setState({
            isAnimatingModal: false,
          })
        }
      }, 500)
    }
  }

  onDrilldownEnd = ({ response, error, drilldownFilters }) => {
    if (response) {
      if (this._isMounted) {
        this.setState({
          activeDrilldownResponse: response,
          activeDrilldownFilters: drilldownFilters,
          isDrilldownRunning: false,
        })
      }
    } else if (error) {
      console.error(error)
      if (this._isMounted) {
        this.setState({
          isDrilldownRunning: false,
          activeDrilldownResponse: undefined,
          activeDrilldownFilters: undefined,
        })
      }
    }
  }

  closeDrilldownModal = () => {
    this.setState({
      isDrilldownModalVisible: false,
      activeDrilldownTile: null,
    })
  }

  renderEmptyDashboardMessage = () => {
    if (this.props.isEditable && !this.props.isEditing) {
      return (
        <div className='empty-dashboard-message-container'>
          Start building a{' '}
          <span className='empty-dashboard-new-tile-btn' onClick={this.props.startEditingCallback}>
            New Dashboard
          </span>
        </div>
      )
    } else if (this.props.isEditing) {
      return (
        <div className='empty-dashboard-message-container'>
          Add a{' '}
          <span className='empty-dashboard-new-tile-btn' onClick={() => this.addTile()}>
            New Tile
          </span>{' '}
          to get started
        </div>
      )
    }

    return (
      <div className='empty-dashboard-message-container'>
        This dashboard doesn't have any tiles. Please contact your administrator to add tiles to this dashboard
      </div>
    )
  }

  renderTiles = () => {
    const tiles = this.getMostRecentTiles()
    const tileLayout = tiles.map((tile) => {
      return {
        ...tile,
        i: tile.key,
        h: tile.h > 10 ? 10 : tile.h,
        maxH: 10,
        minH: 2,
        minW: 3,
      }
    })

    let dataPageSize = this.props.dataPageSize
    if (!dataPageSize) {
      dataPageSize = this.DEFAULT_AJAX_PAGE_SIZE
    }

    return (
      <ReactGridLayout
        ref={(r) => (this.rglRef = r)}
        onLayoutChange={(layout) => {
          this.updateTileLayout(layout)
          this.setState({ layout })
        }}
        onDrag={this.onDrag}
        onDragStart={this.onMoveStart}
        onResizeStart={this.onMoveStart}
        onDragStop={this.onMoveEnd}
        onResizeStop={this.onMoveEnd}
        className='react-autoql-dashboard'
        rowHeight={60}
        cols={12}
        isDraggable={this.props.isEditing}
        isResizable={this.props.isEditing}
        draggableHandle='.react-autoql-dashboard-tile-drag-handle'
        layout={tileLayout}
        margin={[20, 20]}
      >
        {tileLayout.map((tile) => (
          <DashboardTile
            innerDivClass={`react-autoql-dashboard-tile ${tile.i}`}
            tileRef={(ref) => (this.tileRefs[tile.key] = ref)}
            key={tile.key}
            dashboardRef={this.ref}
            authentication={this.props.authentication}
            cancelQueriesOnUnmount={this.props.cancelQueriesOnUnmount}
            autoQLConfig={
              !this.props.offline
                ? this.props.autoQLConfig
                : {
                    ...getAutoQLConfig(this.props.autoQLConfig),
                    enableDrilldowns: false,
                    enableReportProblem: false,
                    enableColumnVisibilityManager: false,
                    enableNotifications: false,
                    enableCSVDownload: false,
                  }
            }
            tile={{
              ...tile,
              i: tile.key,
              maxH: 10,
              minH: 2,
              minW: 3,
            }}
            dashboardSlicers={this.props.enableSlicers ? this.state.dashboardSlicers.map((s) => s.data) : []}
            displayType={tile.displayType}
            secondDisplayType={tile.secondDisplayType}
            secondDisplayPercentage={tile.secondDisplayPercentage}
            isEditing={this.props.isEditing}
            isDragging={this.state.isDragging || this.state.isWindowResizing}
            isWindowResizing={this.state.isWindowResizing}
            setParamsForTile={this.setParamsForTile}
            resetTile={this.resetTile}
            executeSingleTile={this.executeSingleTile}
            onSaveCallback={this.props.onSaveCallback}
            deleteTile={this.deleteTile}
            dataFormatting={this.props.dataFormatting}
            notExecutedText={this.props.notExecutedText}
            enableDynamicCharting={this.props.enableDynamicCharting}
            onErrorCallback={this.props.onErrorCallback}
            onSuccessCallback={this.props.onSuccessCallback}
            autoChartAggregations={this.props.autoChartAggregations}
            onDrilldownStart={this.onDrilldownStart}
            onDrilldownEnd={this.onDrilldownEnd}
            disableAggregationMenu={this.props.disableAggregationMenu}
            allowCustomColumnsOnDrilldown={this.props.allowCustomColumnsOnDrilldown}
            onCSVDownloadStart={this.props.onCSVDownloadStart}
            onCSVDownloadProgress={this.props.onCSVDownloadProgress}
            onCSVDownloadFinish={this.props.onCSVDownloadFinish}
            onPNGDownloadFinish={this.props.onPNGDownloadFinish}
            tooltipID={this.TOOLTIP_ID}
            chartTooltipID={this.CHART_TOOLTIP_ID}
            source={this.SOURCE}
            scope={this.props.scope}
            customToolbarOptions={this.props.customToolbarOptions}
            enableCustomColumns={this.props.enableCustomColumns}
            preferRegularTableInitialDisplayType={this.props.preferRegularTableInitialDisplayType}
            dashboardId={this.props.dashboardId}
            tileKey={tile.key}
            useInfiniteScroll={!this.props.offline}
            enableCyclicalDates={this.props.enableCyclicalDates}
            enableMagicWand={this.props.enableMagicWand}
            showMagicWandQuoteButton={this.props.showMagicWandQuoteButton}
          />
        ))}
      </ReactGridLayout>
    )
  }

  render = () => {
    const tiles = this.getMostRecentTiles()

    // Check if any tile is currently executing
    const isAnyTileExecuting = Object.keys(this.tileRefs).some((key) => {
      const tileRef = this.tileRefs[key]
      return tileRef?.state?.isTopExecuting || tileRef?.state?.isBottomExecuting
    })

    return (
      <ErrorBoundary>
        <>
          {this.props.showToolbar && (
            <DashboardToolbar
              authentication={this.props.authentication}
              isEditing={this.props.isEditing}
              isEditable={this.props.isEditable}
              tooltipID={this.TOOLTIP_ID}
              title={this.props.title}
              onEditClick={this.props.startEditingCallback}
              onAddTileClick={this.addTile}
              onUndoClick={this.undo}
              onRedoClick={this.redo}
              onRefreshClick={this.props.enableAutoRefresh ? this.executeCachedDashboard : this.executeDashboard}
              onDownloadClick={this.exportDashboard}
              isDashboardFullyExecuted={
                tiles.length > 0 &&
                tiles.every((tile) => tile.queryResponse || tile.secondQueryResponse) &&
                !isAnyTileExecuting
              }
              onSaveClick={() => {
                Promise.resolve(this.props.onSaveCallback ? this.props.onSaveCallback() : undefined).then((result) => {
                  // Keep if we need to add back in the near future
                  // this.executeDashboard()
                })
              }}
              onDeleteClick={this.props.onDeleteCallback}
              onRenameClick={this.props.onRenameCallback}
              onCancelClick={() => {
                this.debouncedOnChange(this.state.uneditedDashboardTiles)
                this.props.stopEditingCallback()
              }}
              onSlicerChange={this.props.enableSlicers ? this.handleSlicerChange : undefined}
              onRemoveSlicer={this.props.enableSlicers ? this.handleRemoveSlicer : undefined}
              dashboardId={this.props.dashboardId}
              slicers={this.props.enableSlicers ? this.state.dashboardSlicers.map((s) => s.data) : []}
              refreshInterval={this.props.refreshInterval}
              enableAutoRefresh={this.props.enableAutoRefresh}
              slicerSuggestion={this.props.slicerSuggestion}
              hasTiles={tiles.length > 0}
              enableSlicers={this.props.enableSlicers}
            />
          )}
          <div
            ref={(ref) => (this.ref = ref)}
            className={`react-autoql-dashboard-container${this.props.isEditing ? ' edit-mode' : ''}`}
            data-test='react-autoql-dashboard'
          >
            {tiles.length ? this.renderTiles() : this.renderEmptyDashboardMessage()}
          </div>
          <DrilldownModal
            authentication={this.props.authentication}
            autoQLConfig={this.props.autoQLConfig}
            dataFormatting={this.props.dataFormatting}
            isOpen={this.state.isDrilldownModalVisible}
            onClose={this.closeDrilldownModal}
            drilldownResponse={this.state.activeDrilldownResponse}
            drilldownFilters={this.state.activeDrilldownFilters}
            shouldRender={this.state.isDrilldownModalVisible && !this.state.isDragging && !this.state.isWindowResizing}
            activeDrilldownChartElementKey={this.state.activeDrilldownChartElementKey}
            isAnimating={this.state.isAnimatingModal}
            tooltipID={this.TOOLTIP_ID}
            chartTooltipID={this.CHART_TOOLTIP_ID}
            showQueryInterpretation={this.props.isEditing}
            isDrilldownRunning={this.state.isDrilldownRunning}
            onErrorCallback={this.props.onErrorCallback}
            onSuccessCallback={this.props.onSuccessCallback}
            activeDrilldownRef={this.activeDrilldownRef}
            onCSVDownloadStart={this.props.onCSVDownloadStart}
            onCSVDownloadProgress={this.props.onCSVDownloadProgress}
            onCSVDownloadFinish={this.props.onCSVDownloadFinish}
            onPNGDownloadFinish={this.props.onPNGDownloadFinish}
            source={this.SOURCE}
            enableCyclicalDates={this.props.enableCyclicalDates}
            enableMagicWand={this.props.enableMagicWand}
            showMagicWandQuoteButton={this.props.showMagicWandQuoteButton}
          />
          <Tooltip tooltipId={this.TOOLTIP_ID} />
          <Tooltip tooltipId={this.CHART_TOOLTIP_ID} className='react-autoql-chart-tooltip' delayShow={0} />
        </>
      </ErrorBoundary>
    )
  }
}

const Dashboard = withTheme(DashboardWithoutTheme)
export { Dashboard }
