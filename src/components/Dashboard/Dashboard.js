import React, { Fragment } from 'react'
import PropTypes from 'prop-types'
import uuid from 'uuid'
import RGL, { WidthProvider } from 'react-grid-layout'
import gridLayoutStyles from 'react-grid-layout/css/styles.css'
import ReactTooltip from 'react-tooltip'
import _isEqual from 'lodash.isequal'
import _get from 'lodash.get'
import _cloneDeep from 'lodash.clonedeep'

import { Modal } from '../Modal'
import DashboardTile from './DashboardTile'
import { ResponseRenderer } from '../ResponseRenderer'
import { runDrilldown } from '../../js/queryService'
import { LoadingDots } from '../LoadingDots'
import ErrorBoundary from '../../containers/ErrorHOC/ErrorHOC'
import { CHART_TYPES } from '../../js/Constants'

import chataTableStyles from '../ChataTable/ChataTable.css'
import styles from './Dashboard.css'
import tileStyles from './DashboardTile.css'

const ReactGridLayout = WidthProvider(RGL)

const executeDashboard = ref => {
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

  LIGHT_THEME = {
    '--chata-dashboard-accent-color': '#28a8e0',
    '--chata-dashboard-background-color': '#fff',
    '--chata-dashboard-border-color': '#d3d3d352',
    '--chata-dashboard-hover-color': '#ececec',
    '--chata-dashboard-text-color-primary': '#5d5d5d',
    '--chata-dashboard-text-color-placeholder': '#0000009c'
  }

  DARK_THEME = {
    '--chata-dashboard-accent-color': '#525252', // dark gray
    // '--chata-dashboard-accent-color': '#193a48', // dark blue
    '--chata-dashboard-background-color': '#636363',
    '--chata-dashboard-border-color': '#d3d3d329',
    '--chata-dashboard-hover-color': '#5a5a5a',
    '--chata-dashboard-text-color-primary': '#fff',
    '--chata-dashboard-text-color-placeholder': '#ffffff9c'
  }

  static propTypes = {
    tiles: PropTypes.arrayOf(PropTypes.shape({})),
    onChangeCallback: PropTypes.func,
    token: PropTypes.string,
    apiKey: PropTypes.string,
    customerId: PropTypes.string,
    userId: PropTypes.string,
    domain: PropTypes.string,
    executeOnMount: PropTypes.bool,
    executeOnStopEditing: PropTypes.bool,
    theme: PropTypes.string,
    disableDrilldowns: PropTypes.bool,
    enableSafetyNet: PropTypes.bool,
    enableAutocomplete: PropTypes.bool,
    enableAutocomplete: PropTypes.bool,
    accentColor: PropTypes.string,
    demo: PropTypes.bool,
    debug: PropTypes.bool,
    test: PropTypes.bool,
    isEditing: PropTypes.bool,
    currencyCode: PropTypes.string,
    languageCode: PropTypes.string,
    currencyDecimals: PropTypes.number,
    fontFamily: PropTypes.string,
    notExecutedText: PropTypes.string,
    chartColors: PropTypes.arrayOf(PropTypes.string)
  }

  static defaultProps = {
    tiles: [],
    token: undefined,
    apiKey: undefined,
    customerId: undefined,
    userId: undefined,
    domain: undefined,
    theme: 'light',
    disableDrilldowns: false,
    enableAutocomplete: true,
    accentColor: undefined,
    enableSafetyNet: true,
    enableAutocomplete: true,
    demo: false,
    debug: false,
    test: false,
    executeOnMount: true,
    executeOnStopEditing: true,
    isEditing: false,
    currencyCode: undefined,
    languageCode: undefined,
    currencyDecimals: undefined,
    fontFamily: undefined,
    notExecutedText: undefined,
    chartColors: undefined
  }

  state = {
    isDragging: false,
    previousTileState: this.props.tiles
  }

  componentDidMount = () => {
    this.setStyles()

    if (this.props.executeOnMount) {
      this.executeDashboard()
    }
  }

  componentDidUpdate = (prevProps, prevState) => {
    if (
      this.props.fontFamily &&
      this.props.fontFamily !== prevProps.fontFamily
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
      !_isEqual(
        this.getChangeDetectionTileStructure(this.props.tiles),
        this.getChangeDetectionTileStructure(prevProps.tiles)
      ) &&
      prevProps.tiles[prevProps.tiles.length - 1].y !== Infinity
    ) {
      // Do not scroll to the bottom if new tile is added because of undo
      if (
        prevProps.tiles.length < this.props.tiles.length &&
        !this.state.justPerformedUndo
      ) {
        this.scrollToNewTile()
      }

      this.setState({
        justPerformedUndo: false
      })
    }
  }

  setStyles = () => {
    const themeStyles =
      this.props.theme === 'light' ? this.LIGHT_THEME : this.DARK_THEME
    for (let property in themeStyles) {
      document.documentElement.style.setProperty(
        property,
        themeStyles[property]
      )
    }
    if (this.props.accentColor) {
      document.documentElement.style.setProperty(
        '--chata-dashboard-accent-color',
        this.props.accentColor
      )
    }
    if (this.props.fontFamily) {
      document.documentElement.style.setProperty(
        '--chata-dashboard-font-family',
        this.props.fontFamily
      )
    }
  }

  setPreviousTileState = tiles => {
    this.setState({
      previousTileState: tiles
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

  getChangeDetectionTileStructure = tiles => {
    try {
      const newTiles = tiles.map(tile => {
        return {
          query: tile.query,
          title: tile.title,
          i: tile.i,
          w: tile.w,
          h: tile.h,
          x: tile.x,
          y: tile.y
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
      isDragging: true
    })
  }

  onMoveEnd = ({ layout }) => {
    try {
      // Update previousTileState here instead of in updateTileLayout
      this.setPreviousTileState(this.props.tiles)

      // Delaying this makes the snap back animation much smoother
      // after moving a tile
      setTimeout(() => {
        this.setState({
          isDragging: false
        })
      }, 100)
    } catch (error) {
      console.error(error)
    }
  }

  updateTileLayout = layout => {
    try {
      const tiles = this.props.tiles.map((tile, index) => {
        return {
          ...tile,
          ...layout[index]
        }
      })

      // This function is called when anything updates, including automatic
      // re-adjustment of all tiles after moving a single tile. So we do not
      // want to trigger the undo state on this action. Only on main actions
      // directly caused from user interaction
      this.props.onChangeCallback(tiles)
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
        isNewTile: true
      })

      this.props.onChangeCallback(tiles)
    } catch (error) {
      console.error(error)
    }
  }

  undo = () => {
    try {
      this.props.onChangeCallback(this.state.previousTileState)
      this.setState({
        previousTileState: this.props.tiles,
        justPerformedUndo: true
      })
    } catch (error) {
      console.error(error)
    }
  }

  deleteTile = id => {
    try {
      this.setPreviousTileState(this.props.tiles)

      const tiles = _cloneDeep(this.props.tiles)
      const tileIndex = tiles.map(item => item.i).indexOf(id)
      ~tileIndex && tiles.splice(tileIndex, 1)

      this.props.onChangeCallback(tiles)
    } catch (error) {
      console.error(error)
    }
  }

  setParamsForTile = (params, id) => {
    try {
      this.setPreviousTileState(this.props.tiles)

      const tiles = _cloneDeep(this.props.tiles)
      const tileIndex = tiles.map(item => item.i).indexOf(id)
      tiles[tileIndex] = {
        ...tiles[tileIndex],
        ...params
      }

      this.props.onChangeCallback(tiles)
    } catch (error) {
      console.error(error)
    }
  }

  startDrilldown = (groupByObject, queryID) => {
    this.setState({ isDrilldownRunning: true })
    runDrilldown({
      queryID,
      groupByObject,
      demo: this.props.demo,
      debug: this.props.debug,
      test: this.props.test,
      domain: this.props.domain,
      apiKey: this.props.apiKey,
      customerId: this.props.customerId,
      userId: this.props.userId,
      token: this.props.token
    })
      .then(drilldownResponse => {
        this.setState({
          activeDrilldownResponse: drilldownResponse,
          isDrilldownRunning: false
        })
      })
      .catch(error => {
        console.error(error)
        this.setState({ isDrilldownRunning: false })
      })
  }

  processDrilldown = (tileId, groupByObject, queryID, activeKey) => {
    // document.documentElement.style.setProperty('overflow', 'hidden')

    this.setState({
      isDrilldownModalVisible: true,
      activeDrilldownTile: tileId,
      activeDrilldownResponse: null,
      activeDrilldownChartElementKey: activeKey
    })

    this.startDrilldown(groupByObject, queryID)
  }

  shouldShowOriginalQuery = tile => {
    return CHART_TYPES.includes(tile.displayType)
  }

  renderDrilldownModal = () => {
    const tile = this.props.tiles.find(
      tile => tile.i === this.state.activeDrilldownTile
    )

    return (
      <Modal
        className=""
        title={tile ? tile.query : ''}
        isVisible={this.state.isDrilldownModalVisible}
        width={800}
        style={{ marginTop: '45px' }}
        confirmText="Done"
        showFooter={false}
        onClose={() => {
          this.setState({
            isDrilldownModalVisible: false,
            activeDrilldownTile: null
          })
          // This gets glitchy if you do it at the same time as the state update
          // setTimeout(
          //   () =>
          //     document.documentElement.style.setProperty('overflow', 'auto'),
          //   300
          // )
        }}
      >
        <Fragment>
          {tile && this.shouldShowOriginalQuery(tile) && (
            <div className="chata-dashboard-drilldown-original">
              <ResponseRenderer
                response={tile.queryResponse}
                displayType={tile.displayType}
                currencyCode={this.props.currencyCode}
                languageCode={this.props.languageCode}
                currencyDecimals={this.props.currencyDecimals}
                chartColors={this.props.chartColors}
                backgroundColor={document.documentElement.style.getPropertyValue(
                  '--chata-dashboard-background-color'
                )}
                processDrilldown={this.startDrilldown}
                activeChartElementKey={
                  this.state.activeDrilldownChartElementKey
                }
              />
            </div>
          )}
          <div className="chata-dashboard-drilldown-table">
            {this.state.isDrilldownRunning ? (
              <div className="dashboard-tile-loading-container">
                <LoadingDots />
              </div>
            ) : (
              <ResponseRenderer
                response={this.state.activeDrilldownResponse}
                renderTooltips={false}
                enableSafetyNet={false}
                enableSuggestions={false}
                disableDrilldowns={true}
                currencyCode={this.props.currencyCode}
                languageCode={this.props.languageCode}
                // chartColors={this.props.chartColors}
                backgroundColor={document.documentElement.style.getPropertyValue(
                  '--chata-dashboard-background-color'
                )}
                // height={300}
                demo={this.props.demo}
              />
            )}
          </div>
        </Fragment>
      </Modal>
    )
  }

  render = () => {
    const tileLayout = this.props.tiles.map(tile => {
      return {
        ...tile,
        i: tile.key,
        maxH: 12,
        minH: 2,
        minW: 3
      }
    })

    return (
      <ErrorBoundary>
        <Fragment>
          <style>{`${styles}`}</style>
          <style>{`${tileStyles}`}</style>
          <style>{`${chataTableStyles}`}</style>
          <style>{`${gridLayoutStyles}`}</style>
          <div
            ref={ref => (this.ref = ref)}
            className={`chata-dashboard-container${
              this.props.isEditing ? ' edit-mode' : ''
            }`}
          >
            <ReactGridLayout
              onLayoutChange={layout => {
                this.updateTileLayout(layout)
                this.setState({ layout })
              }}
              onDragStart={this.onMoveStart}
              onResizeStart={this.onMoveStart}
              onDragStop={this.onMoveEnd}
              onResizeStop={this.onMoveEnd}
              className="chata-dashboard"
              rowHeight={60}
              cols={12}
              isDraggable={this.props.isEditing}
              isResizable={this.props.isEditing}
              draggableHandle=".chata-dashboard-tile-inner-div"
              layout={tileLayout}
              margin={[20, 20]}
            >
              {tileLayout.map(tile => (
                <DashboardTile
                  className={`chata-dashboard-tile${
                    this.state.isDragging ? ' dragging' : ''
                  } ${tile.i}`}
                  ref={ref => (this.tileRefs[tile.key] = ref)}
                  key={tile.key}
                  tile={{ ...tile, i: tile.key, maxH: 12, minH: 2, minW: 3 }}
                  displayType={tile.displayType}
                  queryResponse={tile.queryResponse}
                  token={this.props.token}
                  apiKey={this.props.apiKey}
                  customerId={this.props.customerId}
                  userId={this.props.userId}
                  domain={this.props.domain}
                  demo={this.props.demo}
                  debug={this.props.debug}
                  test={this.props.test}
                  enableSafetyNet={this.props.enableSafetyNet}
                  isEditing={this.props.isEditing}
                  isDragging={this.state.isDragging}
                  setParamsForTile={this.setParamsForTile}
                  deleteTile={this.deleteTile}
                  currencyCode={this.props.currencyCode}
                  languageCode={this.props.languageCode}
                  notExecutedText={this.props.notExecutedText}
                  chartColors={this.props.chartColors}
                  processDrilldown={this.processDrilldown}
                />
              ))}
            </ReactGridLayout>
          </div>
          {this.renderDrilldownModal()}
          <ReactTooltip
            className="chata-chart-tooltip"
            id="chart-element-tooltip"
            effect="solid"
            html
          />
          <ReactTooltip
            className="chata-dashboard-tooltip"
            id="chata-toolbar-btn-tooltip"
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
