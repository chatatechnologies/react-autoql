import React, { Fragment } from 'react'
import PropTypes from 'prop-types'
import uuid from 'uuid'
import RGL, { WidthProvider } from 'react-grid-layout'
import ReactTooltip from 'react-tooltip'
import _isEqual from 'lodash.isequal'
import _get from 'lodash.get'
import _cloneDeep from 'lodash.clonedeep'
import SplitterLayout from 'react-splitter-layout'
import { Modal } from '../Modal'
import { Button } from '../Button'
import { Icon } from '../Icon'
import { DashboardTile } from './DashboardTile'
import { QueryOutput } from '../QueryOutput'
import { runDrilldown } from '../../js/queryService'
import { LoadingDots } from '../LoadingDots'
import ErrorBoundary from '../../containers/ErrorHOC/ErrorHOC'
import { CHART_TYPES } from '../../js/Constants'
import { setCSSVars, filterDataForDrilldown } from '../../js/Util'
import {
  authenticationType,
  autoQLConfigType,
  dataFormattingType,
  themeConfigType,
} from '../../props/types'
import {
  authenticationDefault,
  autoQLConfigDefault,
  dataFormattingDefault,
  themeConfigDefault,
  getAuthentication,
  getDataFormatting,
  getAutoQLConfig,
  getThemeConfig,
} from '../../props/defaults'
import { OptionsToolbar } from '../OptionsToolbar'
import 'react-grid-layout/css/styles.css'
import 'react-splitter-layout/lib/index.css'
import './Dashboard.scss'

const ReactGridLayout = WidthProvider(RGL)

const executeDashboard = (ref) => {
  if (ref) {
    try {
      ref.executeDashboard()
    } catch (error) {
      console.error(error)
    }
  }
}

class Dashboard extends React.Component {
  tileRefs = {}

  static propTypes = {
    // Global
    authentication: authenticationType,
    autoQLConfig: autoQLConfigType,
    dataFormatting: dataFormattingType,
    themeConfig: themeConfigType,

    tiles: PropTypes.arrayOf(PropTypes.shape({})),
    executeOnMount: PropTypes.bool,
    executeOnStopEditing: PropTypes.bool,
    isEditing: PropTypes.bool,
    isEditable: PropTypes.bool,
    notExecutedText: PropTypes.string,
    onChange: PropTypes.func,
    enableDynamicCharting: PropTypes.bool,
    onErrorCallback: PropTypes.func,
    onSuccessCallback: PropTypes.func,
    autoChartAggregations: PropTypes.bool,
  }

  static defaultProps = {
    // Global
    authentication: authenticationDefault,
    autoQLConfig: autoQLConfigDefault,
    dataFormatting: dataFormattingDefault,
    themeConfig: themeConfigDefault,

    tiles: [],
    executeOnMount: true,
    executeOnStopEditing: true,
    isEditing: false,
    isEditable: true,
    notExecutedText: undefined,
    enableDynamicCharting: true,
    autoChartAggregations: true,
    onErrorCallback: () => {},
    onSuccessCallback: () => {},
    onChange: () => {},
  }

  state = {
    isDragging: false,
    previousTileState: this.props.tiles,
  }

  componentDidMount = () => {
    if (this.props.executeOnMount) {
      this.executeDashboard()
    }
    this.setStyles()
    window.addEventListener('resize', this.onWindowResize)
  }

  componentDidUpdate = (prevProps) => {
    if (
      !_isEqual(
        getThemeConfig(this.props.themeConfig),
        getThemeConfig(prevProps.themeConfig)
      )
    ) {
      this.setStyles()
    }

    // Re-run dashboard once exiting edit mode (if prop is set to true)
    if (
      prevProps.isEditing &&
      !this.props.isEditing &&
      this.props.executeOnStopEditing
    ) {
      this.executeDashboard()
    }

    // If tile structure changed, set previous tile state for undo feature
    if (
      this.getChangeDetection(this.props.tiles, prevProps.tiles) &&
      _get(prevProps, `tiles[${prevProps.tiles.length} - 1].y`) !== Infinity
    ) {
      // Do not scroll to the bottom if new tile is added because of undo
      if (
        prevProps.tiles.length < this.props.tiles.length &&
        !this.state.justPerformedUndo
      ) {
        this.scrollToNewTile()
      }

      this.setState({
        justPerformedUndo: false,
      })
    }
  }

  componentWillUnmount = () => {
    window.removeEventListener('resize', this.onWindowResize)
  }

  setStyles = () => {
    setCSSVars(getThemeConfig(this.props.themeConfig))
  }

  onWindowResize = (e) => {
    if (!this.state.isWindowResizing) {
      this.setState({ isWindowResizing: true })
    }

    clearTimeout(this.windowResizeTimer)
    this.windowResizeTimer = setTimeout(() => {
      this.setState({ isWindowResizing: false })
    }, 300)
  }

  setPreviousTileState = (tiles) => {
    this.setState({
      previousTileState: tiles,
    })
  }

  executeDashboard = () => {
    try {
      for (var dashboardTile in this.tileRefs) {
        if (this.tileRefs[dashboardTile]) {
          this.tileRefs[dashboardTile].processTile()
        }
      }
    } catch (error) {
      console.error(error)
    }
  }

  getChangeDetection = (oldTiles, newTiles, ignoreInputs) => {
    return !_isEqual(
      this.getChangeDetectionTileStructure(oldTiles, ignoreInputs),
      this.getChangeDetectionTileStructure(newTiles, ignoreInputs)
    )
  }

  getChangeDetectionTileStructure = (tiles, ignoreInputs) => {
    try {
      const newTiles = tiles.map((tile) => {
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
    } catch (error) {
      console.error(error)
    }
  }

  scrollToNewTile = () => {
    setTimeout(() => {
      if (this.ref) {
        this.ref.scrollIntoView(false)
      }
    }, 200)
  }

  onMoveStart = () => {
    this.setState({
      isDragging: true,
    })
  }

  onMoveEnd = (layout) => {
    try {
      // Update previousTileState here instead of in updateTileLayout
      // Only update if layout actually changed
      if (this.getChangeDetection(this.props.tiles, layout, true)) {
        this.setPreviousTileState(this.props.tiles)
      }

      // Delaying this makes the snap back animation much smoother
      // after moving a tile
      setTimeout(() => {
        this.setState({
          isDragging: false,
        })
      }, 100)
    } catch (error) {
      console.error(error)
    }
  }

  updateTileLayout = (layout) => {
    try {
      const tiles = this.props.tiles.map((tile, index) => {
        return {
          ...tile,
          ...layout[index],
        }
      })

      // This function is called when anything updates, including automatic
      // re-adjustment of all tiles after moving a single tile. So we do not
      // want to trigger the undo state on this action. Only on main actions
      // directly caused from user interaction
      this.props.onChange(tiles)
    } catch (error) {
      console.error(error)
    }
  }

  addTile = () => {
    try {
      this.setPreviousTileState(this.props.tiles)

      const tiles = _cloneDeep(this.props.tiles)
      const id = uuid.v4()
      tiles.push({
        key: id,
        i: id,
        w: 6,
        h: 5,
        x: (Object.keys(tiles).length * 6) % 12,
        y: Infinity,
        query: '',
        title: '',
      })

      this.props.onChange(tiles)
    } catch (error) {
      console.error(error)
    }
  }

  undo = () => {
    try {
      this.props.onChange(this.state.previousTileState)
      this.setState({
        previousTileState: this.props.tiles,
        justPerformedUndo: true,
      })
    } catch (error) {
      console.error(error)
    }
  }

  deleteTile = (id) => {
    try {
      this.setPreviousTileState(this.props.tiles)

      const tiles = _cloneDeep(this.props.tiles)
      const tileIndex = tiles.map((item) => item.i).indexOf(id)
      ~tileIndex && tiles.splice(tileIndex, 1)

      this.props.onChange(tiles)
    } catch (error) {
      console.error(error)
    }
  }

  setParamsForTile = (params, id) => {
    try {
      this.setPreviousTileState(this.props.tiles)

      const tiles = _cloneDeep(this.props.tiles)
      const tileIndex = tiles.map((item) => item.i).indexOf(id)
      tiles[tileIndex] = {
        ...tiles[tileIndex],
        ...params,
      }

      if (
        Object.keys(params).includes('query') &&
        params.query !== this.props.tiles[tileIndex].query
      ) {
        tiles[tileIndex].dataConfig = undefined
        tiles[tileIndex].skipQueryValidation = false
      } else if (
        Object.keys(params).includes('secondQuery') &&
        params.secondQuery !== this.props.tiles[tileIndex].secondQuery
      ) {
        tiles[tileIndex].secondDataConfig = undefined
        tiles[tileIndex].secondskipQueryValidation = false
      }

      this.props.onChange(tiles)
    } catch (error) {
      console.error(error)
    }
  }
  runDrilldownFromAPI = (data, queryID) => {
    runDrilldown({
      queryID,
      data,
      ...getAuthentication(this.props.authentication),
      ...getAutoQLConfig(this.props.autoQLConfig),
    })
      .then((drilldownResponse) => {
        this.setState({
          activeDrilldownResponse: drilldownResponse,
          isDrilldownRunning: false,
        })
      })
      .catch((error) => {
        console.error(error)
        this.setState({
          isDrilldownRunning: false,
          activeDrilldownResponse: undefined,
        })
      })
  }

  runFilterDrilldown = (data, tileId, isSecondHalf) => {
    try {
      const tile = this.props.tiles.find((tile) => tile.i === tileId)
      if (!tile) {
        return
      }

      const queryResponse = isSecondHalf
        ? tile.secondQueryResponse
        : tile.queryResponse

      const drilldownResponse = filterDataForDrilldown(queryResponse, data)

      setTimeout(() => {
        this.setState({
          isDrilldownRunning: false,
          activeDrilldownResponse: drilldownResponse,
        })
      }, 1500)
    } catch (error) {
      console.error(error)
      this.props.onErrorCallback(error)
    }
  }

  startDrilldown = (drilldownData, queryID, tileId, isSecondHalf) => {
    this.setState({ isDrilldownRunning: true, isDrilldownChartHidden: false })

    if (drilldownData.supportedByAPI) {
      this.runDrilldownFromAPI(drilldownData.data, queryID, isSecondHalf)
    } else {
      this.runFilterDrilldown(drilldownData.data, tileId, isSecondHalf)
    }
  }

  processDrilldown = ({
    tileId,
    drilldownData,
    queryID,
    activeKey,
    isSecondHalf,
  }) => {
    if (getAutoQLConfig(this.props.autoQLConfig).enableDrilldowns) {
      if (!drilldownData || !drilldownData.data) {
        return
      }

      this.setState({
        isDrilldownModalVisible: true,
        isDrilldownSecondHalf: isSecondHalf,
        activeDrilldownTile: tileId,
        activeDrilldownResponse: null,
        activeDrilldownChartElementKey: activeKey,
      })

      this.startDrilldown(drilldownData, queryID, tileId, isSecondHalf)
    }
  }

  shouldShowOriginalQuery = (tile) => {
    if (!tile) return false

    const displayType = this.state.isDrilldownSecondHalf
      ? tile.secondDisplayType
      : tile.displayType
    return CHART_TYPES.includes(displayType)
  }

  reportProblemCallback = () => {
    if (this.optionsToolbarRef) {
      this.optionsToolbarRef.setState({ activeMenu: 'other-problem' })
    }
  }

  renderDrilldownTable = () => {
    return (
      <div className="react-autoql-dashboard-drilldown-table">
        {this.state.isDrilldownRunning ? (
          <div className="dashboard-tile-loading-container">
            <LoadingDots />
          </div>
        ) : (
          <Fragment>
            <QueryOutput
              authentication={getAuthentication(this.props.authentication)}
              autoQLConfig={getAutoQLConfig(this.props.autoQLConfig)}
              themeConfig={getThemeConfig(this.props.themeConfig)}
              dataFormatting={getDataFormatting(this.props.dataFormatting)}
              queryResponse={this.state.activeDrilldownResponse}
              renderTooltips={false}
              autoChartAggregations={this.props.autoChartAggregations}
              backgroundColor={document.documentElement.style.getPropertyValue(
                '--react-autoql-background-color-primary'
              )}
              reportProblemCallback={this.reportProblemCallback}
              ref={(ref) => (this.responseRef = ref)}
              optionsToolbarRef={this.optionsToolbarRef}
            />
            {/* <OptionsToolbar
              authentication={getAuthentication(this.props.authentication)}
              autoQLConfig={getAutoQLConfig(this.props.autoQLConfig)}
              themeConfig={getThemeConfig(this.props.themeConfig)}
              onErrorCallback={this.props.onErrorCallback}
              onSuccessAlert={this.props.onSuccessCallback}
              ref={(r) => (this.optionsToolbarRef = r)}
              responseRef={this.responseRef}
            /> */}
          </Fragment>
        )}
      </div>
    )
  }

  renderChartCollapseBtn = (placement) => {
    return (
      <div className={`drilldown-hide-chart-btn ${placement}`}>
        <Button
          onClick={() => {
            this.setState({
              isDrilldownChartHidden: !this.state.isDrilldownChartHidden,
            })
          }}
          tooltip={
            this.state.isDrilldownChartHidden ? 'Show Chart' : 'Hide Chart'
          }
        >
          <Icon type="chart" />
          <Icon
            type={this.state.isDrilldownChartHidden ? 'expand' : 'collapse'}
          />
        </Button>
      </div>
    )
  }

  renderDrilldownModal = () => {
    try {
      const tile = this.props.tiles.find(
        (tile) => tile.i === this.state.activeDrilldownTile
      )

      let title
      let queryResponse
      let displayType
      let dataConfig
      if (tile && this.state.isDrilldownSecondHalf) {
        title = tile.secondQuery
        queryResponse = tile.secondQueryResponse || tile.queryResponse
        displayType = tile.secondDisplayType
        dataConfig = tile.secondDataConfig
      } else if (tile && !this.state.isDrilldownSecondHalf) {
        title = tile.query
        queryResponse = tile.queryResponse
        displayType = tile.displayType
        dataConfig = tile.dataConfig
      }

      return (
        <Modal
          themeConfig={getThemeConfig(this.props.themeConfig)}
          className="dashboard-drilldown-modal"
          title={title}
          isVisible={this.state.isDrilldownModalVisible}
          width="90vw"
          height="100vh"
          confirmText="Done"
          showFooter={false}
          onClose={() => {
            this.setState({
              isDrilldownModalVisible: false,
              activeDrilldownTile: null,
            })
          }}
        >
          <Fragment>
            {tile &&
              this.shouldShowOriginalQuery(tile) &&
              !this.state.isDrilldownChartHidden && (
                <SplitterLayout
                  vertical={true}
                  percentage={true}
                  secondaryInitialSize={50}
                  primaryMinSize={this.state.isDrilldownChartHidden ? 0 : 35}
                  onDragEnd={() => {
                    this.setState({})
                  }}
                >
                  <div className="react-autoql-dashboard-drilldown-original">
                    {!this.state.isDrilldownChartHidden && (
                      <QueryOutput
                        authentication={getAuthentication(
                          this.props.authentication
                        )}
                        autoQLConfig={getAutoQLConfig(this.props.autoQLConfig)}
                        themeConfig={getThemeConfig(this.props.themeConfig)}
                        dataFormatting={getDataFormatting(
                          this.props.dataFormatting
                        )}
                        queryResponse={queryResponse}
                        displayType={displayType}
                        dataConfig={dataConfig}
                        autoChartAggregations={this.props.autoChartAggregations}
                        onDataClick={(drilldownData, queryID) => {
                          this.startDrilldown(drilldownData, queryID, tile.i)
                        }}
                        activeChartElementKey={
                          this.state.activeDrilldownChartElementKey
                        }
                        backgroundColor={document.documentElement.style.getPropertyValue(
                          '--react-autoql-background-color-primary'
                        )}
                      />
                    )}
                    {this.renderChartCollapseBtn('bottom')}
                  </div>
                  {this.renderDrilldownTable()}
                </SplitterLayout>
              )}
            {this.shouldShowOriginalQuery(tile) &&
              this.state.isDrilldownChartHidden &&
              this.renderChartCollapseBtn('top')}
            {(!this.shouldShowOriginalQuery(tile) ||
              (this.shouldShowOriginalQuery(tile) &&
                this.state.isDrilldownChartHidden)) &&
              this.renderDrilldownTable()}
          </Fragment>
        </Modal>
      )
    } catch (error) {
      console.error(error)
      this.props.onErrorCallback(error)
    }
  }

  renderEmptyDashboardMessage = () => {
    if (this.props.isEditable && !this.props.isEditing) {
      return (
        <div className="empty-dashboard-message-container">
          Start building a{' '}
          <span
            className="empty-dashboard-new-tile-btn"
            onClick={() => {
              this.props.startEditingCallback()
            }}
          >
            New Dashboard
          </span>
        </div>
      )
    } else if (this.props.isEditing) {
      return (
        <div className="empty-dashboard-message-container">
          Add a{' '}
          <span
            className="empty-dashboard-new-tile-btn"
            onClick={() => {
              this.addTile()
            }}
          >
            New Tile
          </span>{' '}
          to get started
        </div>
      )
    }

    return (
      <div className="empty-dashboard-message-container">
        This dashboard doesn't have any tiles. Please contact your administrator
        to add tiles to this dashboard
      </div>
    )
  }

  renderTiles = () => {
    const tileLayout = this.props.tiles.map((tile) => {
      return {
        ...tile,
        i: tile.key,
        maxH: 12,
        minH: 2,
        minW: 3,
      }
    })

    return (
      <ReactGridLayout
        onLayoutChange={(layout) => {
          this.updateTileLayout(layout)
          this.setState({ layout })
        }}
        onDragStart={this.onMoveStart}
        onResizeStart={this.onMoveStart}
        onDragStop={this.onMoveEnd}
        onResizeStop={this.onMoveEnd}
        className="react-autoql-dashboard"
        rowHeight={60}
        cols={12}
        isDraggable={this.props.isEditing}
        isResizable={this.props.isEditing}
        draggableHandle=".react-autoql-dashboard-tile-drag-handle"
        layout={tileLayout}
        margin={[20, 20]}
      >
        {tileLayout.map((tile) => (
          <DashboardTile
            className={`react-autoql-dashboard-tile${
              this.state.isDragging ? ' dragging' : ''
            } ${tile.i}`}
            ref={(ref) => (this.tileRefs[tile.key] = ref)}
            key={tile.key}
            authentication={getAuthentication(this.props.authentication)}
            autoQLConfig={getAutoQLConfig(this.props.autoQLConfig)}
            themeConfig={getThemeConfig(this.props.themeConfig)}
            tile={{ ...tile, i: tile.key, maxH: 12, minH: 2, minW: 3 }}
            displayType={tile.displayType}
            secondDisplayType={tile.secondDisplayType}
            secondDisplayPercentage={tile.secondDisplayPercentage}
            queryResponse={tile.queryResponse}
            isEditing={this.props.isEditing}
            isDragging={this.state.isDragging}
            isWindowResizing={this.state.isWindowResizing}
            setParamsForTile={this.setParamsForTile}
            deleteTile={this.deleteTile}
            dataFormatting={getDataFormatting(this.props.dataFormatting)}
            notExecutedText={this.props.notExecutedText}
            processDrilldown={this.processDrilldown}
            enableDynamicCharting={this.props.enableDynamicCharting}
            onErrorCallback={this.props.onErrorCallback}
            onSuccessCallback={this.props.onSuccessCallback}
            autoChartAggregations={this.props.autoChartAggregations}
          />
        ))}
      </ReactGridLayout>
    )
  }

  render = () => {
    return (
      <ErrorBoundary>
        <Fragment>
          <div
            ref={(ref) => (this.ref = ref)}
            className={`react-autoql-dashboard-container${
              this.props.isEditing ? ' edit-mode' : ''
            }`}
            data-test="react-autoql-dashboard"
          >
            {this.props.tiles.length
              ? this.renderTiles()
              : this.renderEmptyDashboardMessage()}
          </div>
          {this.renderDrilldownModal()}
          <ReactTooltip
            className="react-autoql-dashboard-tooltip"
            id="react-autoql-dashboard-toolbar-btn-tooltip"
            effect="solid"
            delayShow={500}
            html
          />
        </Fragment>
      </ErrorBoundary>
    )
  }
}

export { Dashboard, executeDashboard }
