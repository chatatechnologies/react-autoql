import React from 'react'
import { deepEqual, getAutoQLConfig } from 'autoql-fe-utils'
import { QueryOutput } from '../../QueryOutput'
import { getTileQueryOutputProps, getTileScopedAutoQLConfig } from '../../Dashboard/tileQueryConfig'
import { RB } from '../constants'
import { CHART_BOX_ATTRIBUTE } from '../print/waitForCharts'

// A chart on paper: the tile's own QueryOutput, fed the report's response, in a box of fixed height, with
// everything that would change it turned off. ChataChart measures the box it's in, so the box is sized
// here rather than scaled with CSS.

export const READ_ONLY_QUERY_OUTPUT_PROPS = {
  allowDisplayTypeChange: false,
  enableDynamicCharting: false,
  enableChartControls: false,
  enableTableSorting: false,
  enableTableContextMenu: false,
  enableCustomColumns: false,
  allowColumnAddition: false,
  useInfiniteScroll: false,
  showQueryInterpretation: false,
  autoSelectQueryValidationSuggestion: false,
  showSuggestionPrefix: false,
  mutable: false,
  isResizing: false,
  autoHeight: false,
  height: '100%',
  width: '100%',
}

// QueryOutput reads its initial* props once, on mount, so each response gets a QueryOutput of its own.
const responseIds = new WeakMap()
let nextResponseId = 0
const responseKey = (response) => {
  if (!response || typeof response !== 'object') return 'none'
  if (!responseIds.has(response)) {
    nextResponseId += 1
    responseIds.set(response, nextResponseId)
  }
  return String(responseIds.get(response))
}

export class ReportChart extends React.Component {
  shouldComponentUpdate(nextProps) {
    const { view, dataFormatting, autoQLConfig } = this.props
    return (
      nextProps.view.response !== view.response ||
      nextProps.view.displayType !== view.displayType ||
      nextProps.view.height !== view.height ||
      nextProps.view.tile !== view.tile ||
      !deepEqual(nextProps.dataFormatting, dataFormatting) ||
      !deepEqual(nextProps.autoQLConfig, autoQLConfig)
    )
  }

  render() {
    const { view, authentication, autoQLConfig, dataFormatting } = this.props
    const { tile, response, displayType, height } = view
    const fromTile = tile ? getTileQueryOutputProps(tile, { queryResponse: response }) : { queryResponse: response }
    const config = tile ? getTileScopedAutoQLConfig(autoQLConfig, tile) : getAutoQLConfig(autoQLConfig)

    return (
      <div className={`${RB}-chart`} {...{ [CHART_BOX_ATTRIBUTE]: '' }} style={{ height }}>
        <QueryOutput
          key={`${responseKey(response)}:${displayType}`}
          {...fromTile}
          {...READ_ONLY_QUERY_OUTPUT_PROPS}
          initialDisplayType={displayType}
          authentication={authentication}
          autoQLConfig={{ ...config, enableDrilldowns: false }}
          dataFormatting={dataFormatting}
        />
      </div>
    )
  }
}
