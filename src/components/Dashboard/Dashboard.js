import React, { Fragment } from 'react'
import PropTypes from 'prop-types'
import { v4 as uuid } from 'uuid'
import RGL, { WidthProvider } from 'react-grid-layout'
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
import { hideTooltips, Tooltip } from '../Tooltip'
import ReportProblemModal from '../OptionsToolbar/ReportProblemModal'
import ErrorBoundary from '../../containers/ErrorHOC/ErrorHOC'
import { CHART_TYPES } from '../../js/Constants'
import { deepEqual, mergeSources } from '../../js/Util'
import { withTheme } from '../../theme'
import DrilldownTable from './DrilldownTable'
import { authenticationType, autoQLConfigType, dataFormattingType } from '../../props/types'
import {
  authenticationDefault,
  autoQLConfigDefault,
  dataFormattingDefault,
  getAutoQLConfig,
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

class DashboardWithoutTheme extends React.Component {
  constructor(props) {
    super(props)

    this.COMPONENT_KEY = uuid()
    this.SOURCE = mergeSources(props.source, 'dashboards')
    this.TOOLTIP_ID = `react-autoql-dashboard-toolbar-btn-tooltip-${this.COMPONENT_KEY}`
    this.CHART_TOOLTIP_ID = `react-autoql-chart-tooltip-${this.COMPONENT_KEY}`
    this.tileRefs = {}
    this.debounceTime = 50
    this.onChangeTiles = null
    this.callbackSubsciptions = []

    this.state = {
      isDragging: false,
      isReportProblemOpen: false,
      isResizingDrilldown: false,
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

    tiles: [],
    executeOnMount: true,
    dataPageSize: undefined,
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
    if (this.splitterLayoutRef?.splitter) {
      this.renderSplitterCollapseBtn()
    }

    // Re-run dashboard once exiting edit mode (if prop is set to true)
    if (prevProps.isEditing && !this.props.isEditing && this.props.executeOnStopEditing) {
      this.executeDashboard()
    }

    if (!prevProps.isEditing && this.props.isEditing) {
      this.refreshTileLayouts()
    }

    // If tile structure changed, set previous tile state for undo feature
    if (
      this.getChangeDetection(this.props.tiles, prevProps.tiles) &&
      _get(prevProps, `tiles[${prevProps.tiles.length} - 1].y`) !== Number.MAX_VALUE
    ) {
      this.setState({
        justPerformedUndo: false,
      })
    }

    if (this.props.isEditing !== prevProps.isEditing) {
      this.setState({ isDragging: true }, () => {
        this.setState({ isDragging: false })
      })
    }

    if (this.state.isDrilldownModalVisible !== prevState.isDrilldownModalVisible) {
      hideTooltips()
    }
  }

  componentWillUnmount = () => {
    try {
      this._isMounted = false
      window.removeEventListener('resize', this.onWindowResize)
      clearTimeout(this.scrollToNewTileTimeout)

      clearTimeout(this.stopDraggingTimeout)
      clearTimeout(this.drillingDownTimeout)
      clearTimeout(this.animationTimeout)
    } catch (error) {
      console.error(error)
    }
  }

  renderSplitterCollapseBtn = () => {
    if (!document.querySelector(`#splitter-btn-${this.COMPONENT_KEY}`)) {
      const btn = document.createElement('div')
      btn.innerHTML = '&#94;'
      btn.className = 'splitter-collapse-btn'
      btn.id = `splitter-btn-${this.COMPONENT_KEY}`
      btn.addEventListener('click', () => {
        console.log('on collapse click')
        this.setState(
          {
            isDrilldownChartHidden: !this.state.isDrilldownChartHidden,
            isResizingDrilldown: true,
          },
          () => {
            this.setState({ isResizingDrilldown: false })
          },
        )
      })
      this.splitterLayoutRef.splitter.parentNode.insertBefore(btn, this.splitterLayoutRef.splitter.nextSibling)
    }
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
    if (saveInLog) {
      this.previousTileState = _cloneDeep(this.getMostRecentTiles())
    }

    this.onChangeTiles = _cloneDeep(tiles)
    const debouncedPromise = new Promise((resolve, reject) => {
      try {
        this.subscribeToCallback([resolve])
        if (callbackArray?.length) {
          this.subscribeToCallback(callbackArray)
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

  debounceSetState = (state) => {
    this.stateToSet = {
      ...this.stateToSet,
      ...state,
    }

    clearTimeout(this.setStateTimeout)
    this.setStateTimeout = setTimeout(() => {
      this.setState(this.stateToSet)
      this.stateToSet = {}
    }, 50)
  }

  onMoveStart = (layout, oldItem, newItem, placeholder, e, element) => {
    // e.stopPropagation()
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

  onMoveEnd = (layout, oldItem, newItem, placeholder, e, element) => {
    try {
      // Update previousTileState here instead of in updateTileLayout
      // Only update if layout actually changed
      const tiles = this.getMostRecentTiles()
      if (this.getChangeDetection(tiles, layout, true)) {
        this.previousTileState = tiles
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
          this.scrollToNewTile(id)
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

  setParamsForTile = (params, id, callbackArray) => {
    try {
      const originalTiles = this.getMostRecentTiles()
      const tiles = _cloneDeep(this.getMostRecentTiles())
      const tileIndex = tiles.map((item) => item.i).indexOf(id)
      tiles[tileIndex] = {
        ...tiles[tileIndex],
        ...params,
      }

      if (Object.keys(params).includes('query') && params.query !== originalTiles[tileIndex].query) {
        tiles[tileIndex].dataConfig = undefined
        tiles[tileIndex].skipQueryValidation = false
      } else if (
        Object.keys(params).includes('secondQuery') &&
        params.secondQuery !== originalTiles[tileIndex].secondQuery
      ) {
        tiles[tileIndex].secondDataConfig = undefined
        tiles[tileIndex].secondskipQueryValidation = false
      }

      this.debouncedOnChange(tiles, undefined, callbackArray)
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

  shouldShowOriginalQuery = () => {
    const displayType = this.activeDrilldownRef?.state?.displayType
    if (!displayType) {
      return false
    }

    return CHART_TYPES.includes(displayType)
  }

  reportProblemCallback = () => {
    this.setState({ isReportProblemOpen: true })
  }

  renderDrilldownTable = () => {
    if (this.state.isDrilldownRunning) {
      return (
        <div className='react-autoql-dashboard-drilldown-table'>
          <div className='dashboard-tile-loading-container'>
            <LoadingDots />
          </div>
        </div>
      )
    }

    const queryResponse = _cloneDeep(this.state.activeDrilldownResponse)
    return (
      <DrilldownTable
        authentication={this.props.authentication}
        autoQLConfig={this.props.autoQLConfig}
        dataFormatting={this.props.dataFormatting}
        isResizing={this.state.isAnimatingModal || this.state.isResizingDrilldown}
        isLoading={this.state.isDrilldownRunning}
        queryResponse={queryResponse}
        tooltipID={this.TOOLTIP_ID}
        chartTooltipID={this.CHART_TOOLTIP_ID}
        reportProblemCallback={this.reportProblemCallback}
        enableAjaxTableData={this.props.enableAjaxTableData}
        showQueryInterpretation={this.props.isEditing}
      />
    )
  }

  renderReportProblemModal = () => {
    return (
      <ReportProblemModal
        authentication={this.props.authentication}
        contentClassName='dashboard-drilldown-report-problem-modal'
        onClose={this.closeReportProblemModal}
        onReportProblem={this.onReportProblem}
        responseRef={this.drilldownTableRef}
        isVisible={this.state.isReportProblemOpen}
      />
    )
  }

  closeDrilldownModal = () => {
    this.setState({
      isDrilldownModalVisible: false,
      activeDrilldownTile: null,
    })
  }

  closeReportProblemModal = () => {
    this.setState({
      isReportProblemOpen: false,
    })
  }

  onReportProblem = ({ successMessage, error }) => {
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
  }

  renderDrilldownModal = () => {
    // Todo: put in its own component
    try {
      let queryResponse
      if (this.state.isDrilldownModalVisible) {
        queryResponse = _cloneDeep(this.activeDrilldownRef?.queryResponse)
        if (queryResponse) {
          queryResponse.data.data.columns = this.activeDrilldownRef.state.columns
        }
      }

      const renderTopHalf = !this.state.isDrilldownChartHidden && this.shouldShowOriginalQuery()

      return (
        <Modal
          className='dashboard-drilldown-modal'
          contentClassName={`dashboard-drilldown-modal-content
            ${this.state.isDrilldownChartHidden ? 'chart-hidden' : ''}
            ${!this.shouldShowOriginalQuery() ? 'table-only' : ''}`}
          title={this.activeDrilldownRef?.queryResponse?.data?.data?.text}
          isVisible={this.state.isDrilldownModalVisible}
          width='90vw'
          height='100vh'
          confirmText='Done'
          showFooter={false}
          shouldRender={this.state.isDrilldownModalVisible && !this.state.isDragging && !this.state.isWindowResizing}
          onClose={this.closeDrilldownModal}
        >
          <Fragment>
            {this.activeDrilldownRef && (
              <SplitterLayout
                ref={(r) => (this.splitterLayoutRef = r)}
                vertical={true}
                percentage={true}
                primaryMinSize={renderTopHalf ? 35 : 0}
                secondaryMinSize={25}
                secondaryInitialSize={50}
                onDragStart={() => this.setState({ isResizingDrilldown: true })}
                onDragEnd={() => this.setState({ isResizingDrilldown: false })}
              >
                <div className='react-autoql-dashboard-drilldown-original'>
                  {this.shouldShowOriginalQuery() && (
                    <>
                      {this.activeDrilldownRef && (
                        <QueryOutput
                          {...this.activeDrilldownRef.props}
                          ref={(r) => (this.drilldownTopRef = r)}
                          queryResponse={queryResponse}
                          isDrilldownChartHidden={this.state.isDrilldownChartHidden}
                          key={`dashboard-drilldown-chart-${this.state.activeDrilldownTile}`}
                          activeChartElementKey={this.state.activeDrilldownChartElementKey}
                          initialDisplayType={this.activeDrilldownRef.state.displayType}
                          initialTableConfigs={{
                            tableConfig: this.activeDrilldownRef.tableConfig,
                            pivotTableConfig: this.activeDrilldownRef.pivotTableConfig,
                          }}
                          isAnimating={this.state.isAnimatingModal}
                          isResizing={this.state.isResizingDrilldown || !this.state.isDrilldownModalVisible}
                          showQueryInterpretation={this.props.isEditing}
                          reverseTranslationPlacement='top'
                          allowDisplayTypeChange={false}
                          source={this.SOURCE}
                          height='100%'
                          width='100%'
                        />
                      )}
                    </>
                  )}
                </div>
                {this.renderDrilldownTable()}
              </SplitterLayout>
            )}
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
        <div className='empty-dashboard-message-container'>
          Start building a{' '}
          <span
            className='empty-dashboard-new-tile-btn'
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
        <div className='empty-dashboard-message-container'>
          Add a{' '}
          <span
            className='empty-dashboard-new-tile-btn'
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
        maxH: 12,
        minH: 2,
        minW: 3,
      }
    })

    let dataPageSize = this.props.dataPageSize
    if (this.props.enableAjaxTableData && !dataPageSize) {
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
            autoQLConfig={this.props.autoQLConfig}
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
            enableAjaxTableData={this.props.enableAjaxTableData}
            tooltipID={this.TOOLTIP_ID}
            chartTooltipID={this.CHART_TOOLTIP_ID}
            source={this.SOURCE}
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
            className={`react-autoql-dashboard-container${this.props.isEditing ? ' edit-mode' : ''}`}
            data-test='react-autoql-dashboard'
          >
            {tiles.length ? this.renderTiles() : this.renderEmptyDashboardMessage()}
          </div>
          {this.renderDrilldownModal()}
          {this.renderReportProblemModal()}
          <Tooltip className='react-autoql-tooltip' id={this.TOOLTIP_ID} effect='solid' delayShow={500} html />
          <Tooltip className='react-autoql-chart-tooltip' id={this.CHART_TOOLTIP_ID} effect='solid' place='top' html />
        </Fragment>
      </ErrorBoundary>
    )
  }
}

const Dashboard = withTheme(DashboardWithoutTheme)
export { Dashboard, executeDashboard, unExecuteDashboard }
