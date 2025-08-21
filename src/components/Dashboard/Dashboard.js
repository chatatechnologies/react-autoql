import React from 'react'
import { v4 as uuid } from 'uuid'
import PropTypes from 'prop-types'
import _isEqual from 'lodash.isequal'
import _cloneDeep from 'lodash.clonedeep'
import RGL, { WidthProvider } from 'react-grid-layout'

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

    if (props.enableAjaxTableData !== undefined) {
      console.warn(
        'enableAjaxtableData is deprecated - the provided prop will be ignored and the default value of "true" will be used instead.',
      )
    }

    this.state = {
      isDragging: false,
      isReportProblemOpen: false,
      isResizingDrilldown: false,
      uneditedDashboardTiles: null,
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
  }

  static defaultProps = {
    // Global
    authentication: authenticationDefault,
    autoQLConfig: autoQLConfigDefault,
    dataFormatting: dataFormattingDefault,

    tiles: [],
    executeOnMount: true,
    dataPageSize: undefined,
    executeOnStopEditing: false,
    isEditing: false,
    isEditable: true,
    notExecutedText: undefined,
    enableDynamicCharting: true,
    autoChartAggregations: true,
    cancelQueriesOnUnmount: false,
    showToolbar: false,
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
  }

  shouldComponentUpdate = (nextProps, nextState) => {
    return !deepEqual(this.props, nextProps) || !deepEqual(this.state, nextState)
  }

  componentDidUpdate = (prevProps, prevState) => {
    // Re-run dashboard once exiting edit mode (if prop is set to true)
    if (prevProps.isEditing && !this.props.isEditing && this.props.executeOnStopEditing) {
      this.executeDashboard()
    }

    if (!prevProps.isEditing && this.props.isEditing) {
      this.refreshTileLayouts()
      this.setState({ uneditedDashboardTiles: _cloneDeep(this.props.tiles) })
    }

    if (this.props.isEditing !== prevProps.isEditing) {
      this.resetTileStateLog()
      this.setState({ isDragging: true }, () => {
        this.setState({ isDragging: false })
      })
    }
  }

  componentWillUnmount = () => {
    try {
      this._isMounted = false
      window.removeEventListener('resize', this.onWindowResize)
      clearTimeout(this.scrollToNewTileTimeout)
      clearTimeout(this.stopDraggingTimeout)
      clearTimeout(this.animationTimeout)
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
            this.props.onChange(this.onChangeTiles)
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

  executeDashboard = () => {
    try {
      const promises = []
      for (var dashboardTile in this.tileRefs) {
        if (this.tileRefs[dashboardTile]) {
          promises.push(this.tileRefs[dashboardTile].processTile())
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

  onDrilldownEnd = ({ response, error }) => {
    if (response) {
      if (this._isMounted) {
        this.setState({
          activeDrilldownResponse: response,
          isDrilldownRunning: false,
        })
      }
    } else if (error) {
      console.error(error)
      if (this._isMounted) {
        this.setState({
          isDrilldownRunning: false,
          activeDrilldownResponse: undefined,
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
            autoQLConfig={this.props.autoQLConfig}
            tile={{ ...tile, i: tile.key, maxH: 10, minH: 2, minW: 3 }}
            displayType={tile.displayType}
            secondDisplayType={tile.secondDisplayType}
            secondDisplayPercentage={tile.secondDisplayPercentage}
            isEditing={this.props.isEditing}
            isDragging={this.state.isDragging || this.state.isWindowResizing}
            isWindowResizing={this.state.isWindowResizing}
            setParamsForTile={this.setParamsForTile}
            deleteTile={this.deleteTile}
            dataFormatting={this.props.dataFormatting}
            notExecutedText={this.props.notExecutedText}
            enableDynamicCharting={this.props.enableDynamicCharting}
            onErrorCallback={this.props.onErrorCallback}
            onSuccessCallback={this.props.onSuccessCallback}
            autoChartAggregations={this.props.autoChartAggregations}
            onDrilldownStart={this.onDrilldownStart}
            onDrilldownEnd={this.onDrilldownEnd}
            onCSVDownloadStart={this.props.onCSVDownloadStart}
            onCSVDownloadProgress={this.props.onCSVDownloadProgress}
            onCSVDownloadFinish={this.props.onCSVDownloadFinish}
            onPNGDownloadFinish={this.props.onPNGDownloadFinish}
            tooltipID={this.TOOLTIP_ID}
            chartTooltipID={this.CHART_TOOLTIP_ID}
            source={this.SOURCE}
            scope={this.props.scope}
            customToolbarOptions={this.props.customToolbarOptions}
          />
        ))}
      </ReactGridLayout>
    )
  }

  render = () => {
    const tiles = this.getMostRecentTiles()

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
              onRefreshClick={this.executeDashboard}
              onSaveClick={() => {
                Promise.resolve(this.props.onSaveCallback ? this.props.onSaveCallback() : undefined).then((result) => {
                  this.executeDashboard()
                })
              }}
              onDeleteClick={this.props.onDeleteCallback}
              onRenameClick={this.props.onRenameCallback}
              onCancelClick={() => {
                this.debouncedOnChange(this.state.uneditedDashboardTiles)
                this.props.stopEditingCallback()
              }}
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
            shouldRender={this.state.isDrilldownModalVisible && !this.state.isDragging && !this.state.isWindowResizing}
            activeDrilldownChartElementKey={this.state.activeDrilldownChartElementKey}
            isAnimating={this.state.isAnimatingModal}
            tooltipID={this.TOOLTIP_ID}
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
          />
          <Tooltip tooltipId={this.TOOLTIP_ID} />
        </>
      </ErrorBoundary>
    )
  }
}

const Dashboard = withTheme(DashboardWithoutTheme)
export { Dashboard }
