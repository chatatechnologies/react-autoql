import { transformQueryResponse } from 'autoql-fe-utils'
import { normalizeReport, REPORT_SCHEMA_VERSION } from '../model/reportSchema'
import { captureFromResponse } from '../model/capture'
import { getDataBlockView } from '../model/blockView'
import { getAnalysisView } from '../model/analysis'
import { buildTileIndex } from '../model/tiles'
import SAMPLE from './fixtures/report-schema-1.json'

// Report schema 1, frozen: fixtures/report-schema-1.json is a report as the builder writes it, with made-up data,
// and the contract AutoQL's report service tests against (its template stripper and its data fills). It has every
// block type: a dashboard tile and a Query-view answer kept with "Add to Report…", a question asked in the report,
// and an analysis written about the tile. If one of these tests fails, the stored shape changed: that takes a new
// schema version, and the report service has to hear about it.

const dataBlocks = SAMPLE.blocks.filter((block) => block.type === 'data')
const blockById = (id) => SAMPLE.blocks.find((block) => block.id === id)
const keysOf = (value) => Object.keys(value).sort()

describe('report schema 1', () => {
  it('is what the builder reads it as, unchanged', () => {
    expect(SAMPLE.schemaVersion).toBe(REPORT_SCHEMA_VERSION)
    expect(normalizeReport(SAMPLE)).toStrictEqual(SAMPLE)
  })

  it('has the ten page settings and every block type', () => {
    expect(keysOf(SAMPLE.page)).toStrictEqual(
      [
        'orientation',
        'margins',
        'typeface',
        'header',
        'footer',
        'pageNumbers',
        'repeatTableHeaders',
        'showInterpretation',
        'coverPage',
        'tableOfContents',
      ].sort(),
    )
    expect(new Set(SAMPLE.blocks.map((block) => block.type))).toStrictEqual(
      new Set(['heading', 'text', 'data', 'analysis', 'pagebreak']),
    )
  })

  it('keeps a tile’s answer as "Add to Report…" captures a table', () => {
    const block = dataBlocks.find((b) => b.source.type === 'tile')
    expect(keysOf(block.source)).toStrictEqual(['dashboardId', 'snapshot', 'tileKey', 'type'])
    expect(keysOf(block.source.snapshot)).toStrictEqual(['dashboardName', 'displayType', 'query', 'tileTitle'])
    expect(keysOf(block.capture)).toStrictEqual(['capturedAt', 'config', 'data', 'displayType', 'table', 'version'])
    expect(keysOf(block.capture.table)).toStrictEqual(['columnIndices', 'filtered', 'filters', 'sort'])
    expect(keysOf(block.capture.config)).toStrictEqual([
      'axisSorts',
      'chartControls',
      'columnVisibility',
      'dataConfig',
      'displayType',
      'legendFilterConfig',
      'networkColumnConfig',
      'orders',
    ])
    expect(keysOf(block.capture.data)).toStrictEqual([
      'columns',
      'count_rows',
      'interpretation',
      'parsed_interpretation',
      'query_id',
      'rows',
      'text',
    ])
  })

  it('keeps a Query-view answer as "Add to Report…" captures a chart, with the block’s own chart choices', () => {
    const block = dataBlocks.find((b) => b.source.type === 'query' && !b.askedHere)
    expect(block.capture.table).toBeUndefined()
    expect(block.capture.config.legendFilterConfig).toBeTruthy()
    expect(block.displayType).toBe('stacked_bar')
    expect(keysOf(block.dataConfig)).toStrictEqual(['tableConfig'])
    expect(block.aggConfig).toStrictEqual({ total_aum: 'sum' })
  })

  it('keeps a question asked in the report as captureFromResponse makes it', () => {
    const block = dataBlocks.find((b) => b.askedHere)
    expect(block.askedHere).toBe(true)
    const { capture } = block
    const response = transformQueryResponse({
      data: {
        reference_id: '1.1.200',
        message: 'Success',
        data: {
          display_type: 'data',
          ...capture.data,
          fe_req: { text: capture.data.text, orders: capture.config.orders },
        },
      },
    })
    const made = captureFromResponse(response, { capturedAt: capture.capturedAt })
    expect(made.ok).toBe(true)
    expect(made.rows).toBe(block.rows)
    expect(made.capture).toStrictEqual(capture)
  })

  it('draws every data block from what it kept, and its analysis as written about the tile', () => {
    const tileIndex = buildTileIndex([])
    const views = {}
    dataBlocks.forEach((block) => {
      views[block.id] = getDataBlockView({ block, tileIndex })
      expect(views[block.id].state).toBe('ready')
    })
    const analysis = SAMPLE.blocks.find((block) => block.type === 'analysis')
    const target = blockById(analysis.target)
    const view = getAnalysisView({ block: analysis, target, targetView: views[target.id] })
    expect(view.state).toBe('written')
    expect(view.targetChanged).toBe(false)
    expect(analysis.targetAsOf).toBe(target.capture.capturedAt)
  })
})
