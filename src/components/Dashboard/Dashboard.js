import React, { Fragment } from 'react'
import PropTypes from 'prop-types'
import { v4 as uuid } from 'uuid'
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
import { LoadingDots } from '../LoadingDots'
import ReportProblemModal from '../OptionsToolbar/ReportProblemModal'
import ErrorBoundary from '../../containers/ErrorHOC/ErrorHOC'
import { CHART_TYPES } from '../../js/Constants'
import { setCSSVars } from '../../js/Util'
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

const unExecuteDashboard = (ref) => {
  if (ref) {
    try {
      ref.unExecuteDashboard()
    } catch (error) {
      console.error(error)
    }
  }
}

class Dashboard extends React.Component {
  tileRefs = {}
  debounceTime = 50
  onChangeTiles = null
  callbackSubsciptions = []

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
    onCSVDownloadStart: PropTypes.func,
    onCSVDownloadProgress: PropTypes.func,
    onCSVDownloadFinish: PropTypes.func,
    enableAjaxTableData: PropTypes.bool,
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
    enableAjaxTableData: false,
    onErrorCallback: () => {},
    onSuccessCallback: () => {},
    onChange: () => {},
    onCSVDownloadStart: () => {},
    onCSVDownloadProgress: () => {},
    onCSVDownloadFinish: () => {},
  }

  state = {
    isDragging: false,
    drilldownDisplayType: 'table',
    isReportProblemOpen: false,
  }

  componentDidMount = () => {
    this._isMounted = true
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
      _get(prevProps, `tiles[${prevProps.tiles.length} - 1].y`) !==
        Number.MAX_VALUE
    ) {
      this.setState({
        justPerformedUndo: false,
      })
    }
  }

  componentWillUnmount = () => {
    this._isMounted = false
    window.removeEventListener('resize', this.onWindowResize)
    clearTimeout(this.scrollToNewTileTimeout)
    clearTimeout(this.rebuildTooltipsTimer)
    clearTimeout(this.stopDraggingTimeout)
    clearTimeout(this.drillingDownTimeout)
    clearTimeout(this.animationTimeout)
  }

  getMostRecentTiles = () => {
    if (this.onChangeTiles) {
      return this.onChangeTiles
    }
    return this.props.tiles
  }

  rebuildTooltips = () => {
    clearTimeout(this.rebuildTooltipsTimer)
    this.rebuildTooltipsTimer = setTimeout(() => {
      ReactTooltip.rebuild()
    }, 500)
  }

  subscribeToCallback = (callback) => {
    this.callbackSubsciptions.push(callback)
  }

  debouncedOnChange = (tiles, saveInLog = true, callback) => {
    if (saveInLog) {
      this.previousTileState = _cloneDeep(this.getMostRecentTiles())
    }

    this.onChangeTiles = _cloneDeep(tiles)
    return new Promise((resolve, reject) => {
      try {
        if (typeof callback === 'function') {
          this.subscribeToCallback(callback)
        }
        clearTimeout(this.onChangeTimer)
        this.onChangeTimer = setTimeout(() => {
          if (this.onChangeTiles) {
            this.props.onChange(this.onChangeTiles)
            this.onChangeTiles = null
            if (this.callbackSubsciptions?.length) {
              this.callbackSubsciptions.forEach((callback) => callback())
              this.callbackSubsciptions = []
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
  }

  setStyles = () => {
    setCSSVars(this.props.themeConfig)
  }

  onWindowResize = (e) => {
    if (!this.currentWindowWidth) {
      this.currentWindowWidth = window.innerWidth
    }

    let hasWidthChanged = e.target.innerWidth !== this.currentWindowWidth
    if (!hasWidthChanged) {
      return
    }

    if (!this.state.isWindowResizing) {
      this.currentWindowWidth = window.innerWidth
      this.setState({ isWindowResizing: true })
    }

    // Only re-render if width changed
    if (hasWidthChanged) {
      this.windowResizeTimer = setTimeout(() => {
        if (hasWidthChanged) {
          this.currentWindowWidth = undefined
          this.setState({ isWindowResizing: false })
        }
      }, 300)
    }
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
    this.scrollToNewTileTimeout = setTimeout(() => {
      if (this.ref) {
        this.ref.scrollIntoView({
          block: 'end',
          inline: 'nearest',
          behavior: 'smooth',
        })
      }
    }, 200)
  }

  onMoveStart = () => {
    if (!this.state.isDragging) {
      this.setState({ isDragging: true })
    }
  }

  onMoveEnd = (layout) => {
    try {
      // Update previousTileState here instead of in updateTileLayout
      // Only update if layout actually changed
      const tiles = this.getMostRecentTiles()
      if (this.getChangeDetection(tiles, layout, true)) {
        this.previousTileState = tiles
      }

      // Delaying this makes the snap back animation much smoother
      // after moving a tile
      this.stopDraggingTimeout = setTimeout(() => {
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

  addTile = () => {
    try {
      const tiles = _cloneDeep(this.getMostRecentTiles())
      const id = uuid()
      tiles.push({
        key: id,
        i: id,
        w: 6,
        h: 5,
        x: (Object.keys(tiles).length * 6) % 12,
        y: Number.MAX_VALUE,
        query: '',
        title: '',
      })

      this.debouncedOnChange(tiles)
        .then(() => {
          this.scrollToNewTile()
        })
        .catch((error) => {
          console.error(error)
        })
    } catch (error) {
      console.error(error)
    }
  }

  undo = () => {
    try {
      this.debouncedOnChange(this.previousTileState, false)
      this.setState({
        justPerformedUndo: true,
      })
    } catch (error) {
      console.error(error)
    }
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

  setParamsForTile = (params, id, callback) => {
    try {
      const originalTiles = this.getMostRecentTiles()
      const tiles = _cloneDeep(this.getMostRecentTiles())
      const tileIndex = tiles.map((item) => item.i).indexOf(id)
      tiles[tileIndex] = {
        ...tiles[tileIndex],
        ...params,
      }

      if (
        Object.keys(params).includes('query') &&
        params.query !== originalTiles[tileIndex].query
      ) {
        tiles[tileIndex].dataConfig = undefined
        tiles[tileIndex].skipQueryValidation = false
      } else if (
        Object.keys(params).includes('secondQuery') &&
        params.secondQuery !== originalTiles[tileIndex].secondQuery
      ) {
        tiles[tileIndex].secondDataConfig = undefined
        tiles[tileIndex].secondskipQueryValidation = false
      }

      this.debouncedOnChange(tiles, undefined, callback)
    } catch (error) {
      console.error(error)
    }
  }
  // runDrilldownFromAPI = (data, queryID) => {
  //   runDrilldown({
  //     queryID,
  //     data,
  //     ...getAuthentication(this.props.authentication),
  //     ...getAutoQLConfig(this.props.autoQLConfig),
  //   })
  //     .then((drilldownResponse) => {
  //       if (this._isMounted) {
  //         this.setState({
  //           activeDrilldownResponse: drilldownResponse,
  //           isDrilldownRunning: false,
  //         })
  //       }
  //     })
  //     .catch((error) => {
  //       console.error(error)
  //       if (this._isMounted) {
  //         this.setState({
  //           isDrilldownRunning: false,
  //           activeDrilldownResponse: undefined,
  //         })
  //       }
  //     })
  // }

  onDrilldownStart = ({ tileId, activeKey, isSecondHalf }) => {
    if (getAutoQLConfig(this.props.autoQLConfig).enableDrilldowns) {
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
        this.setState({
          isAnimatingModal: false,
        })
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

  shouldShowOriginalQuery = (tile) => {
    if (!tile) return false

    const displayType = this.state.isDrilldownSecondHalf
      ? tile.secondDisplayType
      : tile.displayType

    return CHART_TYPES.includes(displayType)
  }

  reportProblemCallback = () => {
    this.setState({ isReportProblemOpen: true })
  }

  renderDrilldownTable = () => {
    return (
      <div className="react-autoql-dashboard-drilldown-table">
        {this.state.isDrilldownRunning ? (
          <div className="dashboard-tile-loading-container">
            <LoadingDots />
          </div>
        ) : (
          <QueryOutput
            ref={(r) => (this.drilldownTableRef = r)}
            displayType={this.state.drilldownDisplayType}
            onRecommendedDisplayType={(drilldownDisplayType) => {
              this.setState({ drilldownDisplayType })
            }}
            authentication={getAuthentication(this.props.authentication)}
            autoQLConfig={getAutoQLConfig(this.props.autoQLConfig)}
            themeConfig={this.props.themeConfig}
            dataFormatting={getDataFormatting(this.props.dataFormatting)}
            queryResponse={this.state.activeDrilldownResponse}
            renderTooltips={false}
            onUpdate={this.rebuildTooltips}
            isAnimatingContainer={this.state.isAnimatingModal}
            backgroundColor={document.documentElement.style.getPropertyValue(
              '--react-autoql-background-color-primary'
            )}
            reportProblemCallback={this.reportProblemCallback}
            enableAjaxTableData={this.props.enableAjaxTableData}
            rebuildTooltips={this.rebuildTooltips}
          />
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

  renderReportProblemModal = () => {
    return (
      <ReportProblemModal
        authentication={this.props.authentication}
        contentClassName="dashboard-drilldown-report-problem-modal"
        onClose={() => {
          this.setState({
            isReportProblemOpen: false,
          })
        }}
        onReportProblem={({ successMessage, error }) => {
          if (successMessage) {
            this.props.onSuccessCallback(successMessage)
            if (this._isMounted) {
              this.setState({
                isReportProblemOpen: false,
              })
            }
          } else if (error) {
            this.props.onErrorCallback(error)
          }
        }}
        responseRef={this.drilldownTableRef}
        isVisible={this.state.isReportProblemOpen}
      />
    )
  }

  renderDrilldownModal = () => {
    try {
      const tiles = this.getMostRecentTiles()
      const tile = tiles.find(
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
        title = tile.title || tile.query
        queryResponse = tile.queryResponse
        displayType = tile.displayType
        dataConfig = tile.dataConfig
      }
      return (
        <Modal
          themeConfig={this.props.themeConfig}
          className="dashboard-drilldown-modal"
          contentClassName="dashboard-drilldown-modal-content"
          title={title}
          isVisible={this.state.isDrilldownModalVisible}
          width="90vw"
          height="100vh"
          confirmText="Done"
          showFooter={false}
          onClose={() => {
            this.setState({
              isDrilldownModalVisible: false,
              drilldownDisplayType: 'table',
              activeDrilldownTile: null,
            })
          }}
        >
          {this.state.isDrilldownModalVisible && (
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
                          autoQLConfig={getAutoQLConfig(
                            this.props.autoQLConfig
                          )}
                          themeConfig={this.props.themeConfig}
                          dataFormatting={getDataFormatting(
                            this.props.dataFormatting
                          )}
                          queryResponse={_cloneDeep(queryResponse)}
                          displayType={displayType}
                          tableConfig={_cloneDeep(dataConfig)}
                          onUpdate={this.rebuildTooltips}
                          isAnimatingContainer={this.state.isAnimatingModal}
                          autoChartAggregations={
                            this.props.autoChartAggregations
                          }
                          onDrilldownStart={(activeKey) =>
                            this.onDrilldownStart({
                              tileId: tile.i,
                              activeKey,
                            })
                          }
                          onDrilldownEnd={this.onDrilldownEnd}
                          activeChartElementKey={
                            this.state.activeDrilldownChartElementKey
                          }
                          backgroundColor={document.documentElement.style.getPropertyValue(
                            '--react-autoql-background-color-primary'
                          )}
                          enableAjaxTableData={this.props.enableAjaxTableData}
                          reportProblemCallback={this.reportProblemCallback}
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
          )}
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
    const tiles = this.getMostRecentTiles()
    const tileLayout = tiles.map((tile) => {
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
        onDrag={this.onMoveStart}
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
            innerDivClass={`react-autoql-dashboard-tile ${tile.i}`}
            tileRef={(ref) => (this.tileRefs[tile.key] = ref)}
            key={tile.key}
            authentication={getAuthentication(this.props.authentication)}
            autoQLConfig={getAutoQLConfig(this.props.autoQLConfig)}
            themeConfig={this.props.themeConfig}
            tile={{ ...tile, i: tile.key, maxH: 12, minH: 2, minW: 3 }}
            displayType={tile.displayType}
            secondDisplayType={tile.secondDisplayType}
            secondDisplayPercentage={tile.secondDisplayPercentage}
            queryResponse={tile.queryResponse}
            secondQueryResponse={tile.secondQueryResponse}
            isEditing={this.props.isEditing}
            isDragging={this.state.isDragging || this.state.isWindowResizing}
            isWindowResizing={this.state.isWindowResizing}
            setParamsForTile={this.setParamsForTile}
            deleteTile={this.deleteTile}
            dataFormatting={getDataFormatting(this.props.dataFormatting)}
            notExecutedText={this.props.notExecutedText}
            enableDynamicCharting={this.props.enableDynamicCharting}
            onErrorCallback={this.props.onErrorCallback}
            onSuccessCallback={this.props.onSuccessCallback}
            autoChartAggregations={this.props.autoChartAggregations}
            onQueryOutputUpdate={this.rebuildTooltips}
            onDrilldownStart={this.onDrilldownStart}
            onDrilldownEnd={this.onDrilldownEnd}
            onCSVDownloadStart={this.props.onCSVDownloadStart}
            onCSVDownloadProgress={this.props.onCSVDownloadProgress}
            onCSVDownloadFinish={this.props.onCSVDownloadFinish}
            enableAjaxTableData={this.props.enableAjaxTableData}
            rebuildTooltips={this.rebuildTooltips}
          />
        ))}
      </ReactGridLayout>
    )
  }

  render = () => {
    const tiles = this.getMostRecentTiles()
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
            {tiles.length
              ? this.renderTiles()
              : this.renderEmptyDashboardMessage()}
          </div>
          {!this.state.isDragging && this.renderDrilldownModal()}
          {this.renderReportProblemModal()}
          <ReactTooltip
            className="react-autoql-dashboard-tooltip"
            id="react-autoql-dashboard-toolbar-btn-tooltip"
            effect="solid"
            delayShow={500}
            html
          />
          <ReactTooltip
            place="left"
            className="react-autoql-chart-tooltip"
            id="dashboard-data-limit-warning-tooltip"
            effect="solid"
            html
          />
        </Fragment>
      </ErrorBoundary>
    )
  }
}

export { Dashboard, executeDashboard, unExecuteDashboard }
