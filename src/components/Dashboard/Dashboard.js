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
    this.userCallbackSubscriptions = []
    this.tileLog = [this.cloneTilesForLog(props.tiles)]
    this.currentLogIndex = 0
    this.isResettingTile = false
    this.resettingTileId = null
    this.pendingResetTiles = null
    this.isDiscardingResetChanges = false
    this.discardResetTileId = null

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
    enableResetQuery: PropTypes.bool,
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
    enableResetQuery: false,
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
      this.executeDashboard()
    }
    window.addEventListener('resize', this.onWindowResize)
    window.addEventListener('reactAutoQLDiscardDashboard', this.handleDiscardEvent)
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

    if (prevProps.isEditing && !this.props.isEditing && this.props.executeOnStopEditing) {
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
      // Brief isDragging toggle triggers resize in children; timeout avoids synchronous double-setState race
      this.setIsDragging(true)
      clearTimeout(this.stopDraggingTimeout)
      this.stopDraggingTimeout = setTimeout(() => {
        this.setIsDragging(false)
      }, 50)
    }

    // Prune stale tileRefs when tile keys change to prevent unbounded growth
    if (this.props.tiles !== prevProps.tiles) {
      const currentKeys = new Set((this.props.tiles || []).map((t) => t.key))
      Object.keys(this.tileRefs).forEach((key) => {
        if (!currentKeys.has(key)) {
          delete this.tileRefs[key]
        }
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
      window.removeEventListener('reactAutoQLDiscardDashboard', this.handleDiscardEvent)
      clearTimeout(this.scrollToNewTileTimeout)
      clearTimeout(this.stopDraggingTimeout)
      clearTimeout(this.animationTimeout)
      clearTimeout(this.resetGuardTimer)
      clearTimeout(this.onChangeTimer)
      clearTimeout(this.callbackSubsciptionTimer)
      clearTimeout(this.windowResizeTimer)
      clearTimeout(this.discardResetChangesTimer)
      this.callbackSubsciptions = []
      this.userCallbackSubscriptions = []
      this.tileLog = []
      this.pendingResetTiles = null
      this.pendingResetUndoTiles = null
      this.pendingResetHistory = null
      this.isDiscardingResetChanges = false
      this.discardResetTileId = null
    } catch (error) {
      console.error(error)
    }
  }

  handleDiscardEvent = () => this.discardChanges()

  discardChanges = () => {
    try {
      const unedited = this.state.uneditedDashboardTiles || this.tileLog?.[0] || this.getMostRecentTiles()
      if (!unedited) return
      this.tileLog = [this.cloneTilesForLog(unedited)]
      this.currentLogIndex = 0
      this.debouncedOnChange(_cloneDeep(unedited), false)
      this.props.stopEditingCallback?.()
    } catch (error) {
      console.error('Error discarding dashboard changes:', error)
    }
  }

  resetTileStateLog = () => {
    this.tileLog = [_cloneDeep(this.getMostRecentTiles())]
    this.currentLogIndex = 0
  }

  getMostRecentTiles = () => {
    if (this.onChangeTiles) {
      return this.onChangeTiles
    }
    // During reset, overlay just the cleared tile onto props.tiles so concurrent saves from
    // other tiles don't inadvertently read the reset tile's stale queryResponse as their base.
    if (this.isResettingTile && this.pendingResetTiles && this.resettingTileId) {
      const base = this.props.tiles
      if (!base) return this.pendingResetTiles
      const resetEntry = this.pendingResetTiles.find((t) => t.i === this.resettingTileId)
      if (!resetEntry) return base
      return base.map((tile) => (tile.i === this.resettingTileId ? resetEntry : tile))
    }
    return this.props.tiles
  }

  getDirtyTileKeys = () => {
    if (!this.props.isEditing || !this.state.uneditedDashboardTiles) return new Set()
    const savedByKey = new Map(this.state.uneditedDashboardTiles.map((t) => [t.key, t]))
    const current = this.getMostRecentTiles()
    const stripVolatile = (t) => {
      if (!t) return t
      const { queryResponse, secondQueryResponse, queryId, secondQueryId, ...rest } = t
      return rest
    }
    return new Set(
      (current || [])
        .filter((tile) => {
          const saved = savedByKey.get(tile.key)
          return saved && !deepEqual(stripVolatile(tile), stripVolatile(saved))
        })
        .map((tile) => tile.key),
    )
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
          // Separate from callbackSubsciptions so flushOnChange (undo/redo) can resolve promises without firing user callbacks with stale state.
          this.userCallbackSubscriptions = [...this.userCallbackSubscriptions, ...callbackArray]
        }

        if (saveInLog) {
          this.addTileStateToLog(this.onChangeTiles)
        }

        if (this.onChangeTimer) {
          clearTimeout(this.onChangeTimer)
        }

        this.onChangeTimer = setTimeout(() => {
          if (this.onChangeTiles) {
            const slicers =
              this.props.enableSlicers && Array.isArray(this.state.dashboardSlicers) ? this.state.dashboardSlicers : []

            this.props.onChange(this.onChangeTiles, slicers)
            this.onChangeTiles = null
            const allCallbacks = [...this.callbackSubsciptions, ...this.userCallbackSubscriptions]
            this.callbackSubsciptions = []
            this.userCallbackSubscriptions = []
            if (allCallbacks.length) {
              allCallbacks.forEach((callback, i) => {
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
        this.userCallbackSubscriptions = []
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

          // Skip tile being reset — resetTile calls processTile directly.
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

  // Shallow-clone tiles for undo history; deep-clone only fe_req to preserve custom column defs without copying full response payloads.
  cloneTilesForLog = (tiles) =>
    tiles?.map(({ queryResponse, secondQueryResponse, ...rest }) => {
      const safeQueryResponse = queryResponse
        ? (() => {
            try {
              const qr = { ...queryResponse }
              if (qr.data && qr.data.data) {
                qr.data = { ...qr.data }
                qr.data.data = { ...qr.data.data }
                // Deep-clone fe_req if present (custom columns live here)
                if (qr.data.data.fe_req) {
                  qr.data.data.fe_req = _cloneDeep(qr.data.data.fe_req)
                }
              }
              return qr
            } catch (e) {
              return queryResponse
            }
          })()
        : queryResponse

      const safeSecondQueryResponse = secondQueryResponse
        ? (() => {
            try {
              const sqr = { ...secondQueryResponse }
              if (sqr.data && sqr.data.data) {
                sqr.data = { ...sqr.data }
                sqr.data.data = { ...sqr.data.data }
                if (sqr.data.data.fe_req) {
                  sqr.data.data.fe_req = _cloneDeep(sqr.data.data.fe_req)
                }
              }
              return sqr
            } catch (e) {
              return secondQueryResponse
            }
          })()
        : secondQueryResponse

      return {
        ..._cloneDeep(rest),
        queryResponse: safeQueryResponse,
        secondQueryResponse: safeSecondQueryResponse,
      }
    })

  stripRuntimeFields = (tiles) =>
    tiles?.map(({ queryResponse, secondQueryResponse, ...rest }) => rest)

  addTileStateToLog = (tiles) => {
    if (!this.props.isEditing || !tiles) {
      return
    }

    if (this.isResettingTile) {
      this.tileLog[0] = this.cloneTilesForLog(tiles)
      clearTimeout(this.resetGuardTimer)
      const resetTile = tiles?.find((t) => t.i === this.resettingTileId)
      const isFullyDone =
        resetTile?.queryResponse != null && (!resetTile.secondQuery || resetTile.secondQueryResponse != null)
      if (isFullyDone) {
        this.isResettingTile = false
        this.resettingTileId = null
        this.pendingResetTiles = null
      }
      return
    }

    const current = this.tileLog[this.currentLogIndex]
    const prevEntry = this.tileLog[this.currentLogIndex + 1]
    const isJustAddedTile =
      current && prevEntry && current.length > prevEntry.length && tiles.length === current.length

    if (current) {
      const stripped = this.stripRuntimeFields(tiles)
      const strippedCurrent = this.stripRuntimeFields(current)
      if (_isEqual(stripped, strippedCurrent)) {
        // Update snapshot with latest response data so undo restores tiles with query results.
        if (isJustAddedTile) {
          this.tileLog[this.currentLogIndex] = this.cloneTilesForLog(tiles)
        }
        return
      }
    }

    // Collapse "add tile + initial edit" into a single undo step.
    if (isJustAddedTile) {
      if (this.currentLogIndex > 0) {
        this.tileLog = this.tileLog.slice(this.currentLogIndex)
      }
      this.tileLog[0] = this.cloneTilesForLog(tiles)
      this.currentLogIndex = 0
      return
    }

    // If user made a new edit after undoing, discard the "future" branch.
    if (this.currentLogIndex > 0) {
      this.tileLog = this.tileLog.slice(this.currentLogIndex)
    }

    this.tileLog.unshift(this.cloneTilesForLog(tiles))
    this.currentLogIndex = 0

    // Cap history to prevent memory leaks from large queryResponse objects.
    if (this.tileLog.length > 20) {
      this.tileLog.length = 20
    }
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

      // Skip stale layout echo when tile count doesn't match (undo/redo lag in react-grid-layout).
      if (!Array.isArray(oldTiles) || !Array.isArray(layout) || layout.length !== oldTiles.length) {
        return
      }

      const tiles = oldTiles.map((tile, index) => ({ ...tile, ...layout[index] }))

      const LAYOUT_KEYS = ['x', 'y', 'w', 'h']
      const layoutChanged = tiles.some((tile, idx) => {
        const old = oldTiles[idx]
        return !old || LAYOUT_KEYS.some((k) => tile[k] !== old[k])
      })

      if (layoutChanged) {
        this.debouncedOnChange(tiles, false)
      }
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
        // In edit mode, strip queryResponse so the tile re-executes via API immediately.
        // This ensures filters are baked into the cached SQL (queryId) rather than applied
        // client-side from the DM response, even when the row count is below the local limit.
        if (this.props.isEditing) {
          const { queryResponse, secondQueryResponse, ...contentWithoutResponse } = content
          tile = { ...tile, ...contentWithoutResponse }
        } else {
          tile = { ...tile, ...content }
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

  // Bypass the debounce and push tiles to the portal immediately (used for undo/redo).
  flushOnChange = (tiles) => {
    if (this.onChangeTimer) {
      clearTimeout(this.onChangeTimer)
      this.onChangeTimer = null
    }
    const slicers =
      this.props.enableSlicers && Array.isArray(this.state.dashboardSlicers) ? this.state.dashboardSlicers : []
    this.onChangeTiles = _cloneDeep(tiles)
    this.props.onChange(this.onChangeTiles, slicers)
    this.onChangeTiles = null
    // Resolve pending promises without firing userCallbackSubscriptions — calling onSaveCallback here would save stale state and exit edit mode.
    if (this.callbackSubsciptions?.length) {
      const pending = this.callbackSubsciptions
      this.callbackSubsciptions = []
      pending.forEach((cb) => cb())
    }
    this.userCallbackSubscriptions = []
  }

  changeCurrentTileState = (logIndex) => {
    try {
      const newTileState = _cloneDeep(this.tileLog[logIndex])
      if (newTileState) {
        this.currentLogIndex = logIndex
        this.flushOnChange(newTileState)
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

    // Restore pre-reset state directly — tileLog is polluted by post-reset auto-saves.
    if (this.pendingResetUndoTiles) {
      const target = this.pendingResetUndoTiles
      this.pendingResetUndoTiles = null

      // Preserve current key to keep DashboardTile mounted (key changed after reset).
      const currentTiles = this.getMostRecentTiles()
      const restoredTiles = target.map((preTile) => {
        const cur = currentTiles?.find((t) => t.i === preTile.i)
        return cur ? { ...preTile, key: cur.key } : preTile
      })
      const preResetHistory = this.pendingResetHistory || []
      this.pendingResetHistory = null
      this.tileLog = [_cloneDeep(restoredTiles), ...preResetHistory.slice(1)]
      this.currentLogIndex = 0

      // Discard stale setParamsForTile callbacks from in-flight reset queries for 500ms to prevent overriding the undo.
      if (this.resettingTileId) {
        this.discardResetTileId = this.resettingTileId
        this.isDiscardingResetChanges = true
        clearTimeout(this.discardResetChangesTimer)
        this.discardResetChangesTimer = setTimeout(() => {
          this.isDiscardingResetChanges = false
          this.discardResetTileId = null
        }, 500)
      }

      // Clear reset guard so getMostRecentTiles returns the restored tiles.
      this.isResettingTile = false
      this.resettingTileId = null
      this.pendingResetTiles = null
      clearTimeout(this.resetGuardTimer)

      this.flushOnChange(restoredTiles)
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

  canUndo = () => {
    if (!this.props.isEditing) return false
    if (this.pendingResetUndoTiles) return true
    return this.currentLogIndex < this.tileLog.length - 1
  }

  canRedo = () => {
    if (!this.props.isEditing) return false
    return this.currentLogIndex > 0
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
      // Guard against stale debouncedSetParamsForTile callbacks from a reset that was subsequently undone.
      if (this.isDiscardingResetChanges && id === this.discardResetTileId) {
        return
      }

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
      if (this.isResettingTile && this.resettingTileId === id) {
        return
      }

      const tiles = _cloneDeep(this.getMostRecentTiles())
      const tileIndex = tiles.map((item) => item.i).indexOf(id)

      if (tileIndex < 0) {
        console.warn(`Tile with ID ${id} not found for reset`)
        return
      }

      // Clear filters, columns, sorts, aggregations, chart overlays, and cached responses; preserve query, title, and display type.
      tiles[tileIndex] = {
        ...tiles[tileIndex],
        tableFilters: [],
        filters: [],
        secondTableFilters: [],
        columnSelects: [],
        columns: [],
        available_selects: [],
        displayOverrides: [],
        orders: [],
        secondOrders: [],
        aggConfig: undefined,
        secondAggConfig: undefined,
        axisSorts: undefined,
        secondAxisSorts: undefined,
        chartControls: undefined,
        secondChartControls: undefined,
        dataConfig: undefined,
        secondDataConfig: undefined,
        legendFilterConfig: undefined,
        queryResponse: null,
        secondQueryResponse: null,
      }

      // Save pre-reset state for undo; bypass addTileStateToLog (equality check would skip it).
      if (this.props.isEditing) {
        const preResetTiles = _cloneDeep(this.getMostRecentTiles())
        // Use cloneTilesForLog to ensure nested fe_req (custom columns) are deep-cloned
        const preResetSnapshot = this.cloneTilesForLog(preResetTiles)
        this.pendingResetUndoTiles = preResetSnapshot
        const history = this.tileLog.slice(this.currentLogIndex)
        history[0] = preResetSnapshot
        this.pendingResetHistory = history
        this.tileLog = [this.cloneTilesForLog(tiles), ...history]
        this.currentLogIndex = 0
      }

      // Guard flags prevent executeDashboard from double-executing this tile.
      this.isResettingTile = true
      this.resettingTileId = id
      this.pendingResetTiles = _cloneDeep(tiles)

      const runSingleTile = () => {
        const updatedTile = tiles[tileIndex]
        const refKey = updatedTile?.key || updatedTile?.i
        const hasQuery = !!(updatedTile?.query || updatedTile?.secondQuery)
        if (!hasQuery) {
          return Promise.resolve()
        }
        return new Promise((resolve, reject) => {
          setTimeout(() => {
            const tileRef = this.tileRefs[refKey]
            if (!tileRef?.processTile) {
              return resolve()
            }
            // Force non-cached fetch — cached endpoint ignores request params.
            const promise = tileRef.processTile({ isReset: true })
            Promise.resolve(promise).then(resolve).catch(reject)
          }, 0)
        })
      }

      const clearResetGuard = () => {
        clearTimeout(this.resetGuardTimer)
        this.resetGuardTimer = setTimeout(() => {
          if (this.isResettingTile) {
            if (this.props.isEditing) {
              this.tileLog[0] = _cloneDeep(this.getMostRecentTiles())
            }
            this.isResettingTile = false
            this.resettingTileId = null
            this.pendingResetTiles = null
          }
        }, 1000)
      }

      return runSingleTile()
        .then((processedTile) => {
          try {
            // Merge returned query responses into pendingResetTiles so the
            // subsequent debouncedOnChange publishes the tile with the fresh data
            if (processedTile && this.pendingResetTiles) {
              try {
                const pending = _cloneDeep(this.pendingResetTiles)
                const idx = pending.findIndex((t) => t.i === processedTile.i || t.key === processedTile.key)
                if (idx !== -1) {
                  pending[idx] = {
                    ...pending[idx],
                    ...(processedTile.queryResponse !== undefined ? { queryResponse: processedTile.queryResponse } : {}),
                    ...(processedTile.secondQueryResponse !== undefined
                      ? { secondQueryResponse: processedTile.secondQueryResponse }
                      : {}),
                  }
                  this.pendingResetTiles = pending
                }
              } catch (e) {
                console.error('Failed to merge processed tile into pendingResetTiles:', e)
              }
            }

            const callbacks = this.props.onSaveCallback ? [this.props.onSaveCallback] : []
            return this.debouncedOnChange(this.getMostRecentTiles(), false, callbacks)
          } catch (err) {
            console.error(err)
            return Promise.resolve()
          }
        })
        .then(clearResetGuard)
        .catch((error) => {
          console.error('Error during tile reset:', error)
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

    const dirtyTileKeys = this.getDirtyTileKeys()

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
            isDirty={dirtyTileKeys.has(tile.key)}
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
            showResetQueryOption={this.props.enableResetQuery}
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
                Promise.resolve(this.props.onSaveCallback ? this.props.onSaveCallback() : undefined)
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
