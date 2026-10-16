import ChataTable from './ChataTable'

// getReportView reports the table as it's shown: every row it pages through (current sort and filters, in
// display order), the visible columns in display order, the sort, the header filters, and the count they leave.
// Tabulator holds only the pages scrolled to so far, so the rows must not come from it.

const columns = [
  { id: 'c0', field: '0', index: 0, name: 'region', title: 'Region', type: 'STRING' },
  { id: 'c1', field: '1', index: 1, name: 'aum', title: 'AUM', type: 'DOLLAR_AMT' },
]

// 120 rows: East, West, East, … with AUM 1,000 … 120,000.
const allRows = Array.from({ length: 120 }, (_, i) => [i % 2 ? 'West' : 'East', (i + 1) * 1000])

const response = (rows, countRows = rows.length) => ({
  data: { data: { rows, count_rows: countRows, columns } },
})

const column = (field, visible = true) => ({ getField: () => field, isVisible: () => visible })

// A Tabulator that has loaded only its first page, as it has until the user scrolls.
const firstPageOnly = (rows) => ({
  getData: () => rows.slice(0, 50),
  getColumns: () => [column('1'), column('0'), column('2', false)],
})

const tableWith = ({ rows = allRows, countRows, tabulator, tableParams, filterCount, filteredResponseData }) => {
  const table = new ChataTable({ response: response(rows, countRows), columns })
  table.ref = tabulator ? { tabulator } : undefined
  if (tableParams) table.tableParams = tableParams
  if (filterCount !== undefined) table.filterCount = filterCount
  if (filteredResponseData) table.filteredResponseData = filteredResponseData
  return table
}

describe('ChataTable.getReportView', () => {
  describe('a table that holds its whole result (sorts and filters it in place)', () => {
    it('takes the rows in the order the table shows them, beyond the pages loaded so far', () => {
      const table = tableWith({
        tabulator: firstPageOnly(allRows),
        tableParams: { filter: [], sort: [{ field: '1', dir: 'desc' }], page: 1 },
      })

      const view = table.getReportView(100)
      expect(view.rows).toHaveLength(100)
      expect(view.rows[0]).toStrictEqual(['West', 120000])
      expect(view.rows[99]).toStrictEqual(['East', 21000])
      expect(view).toMatchObject({
        columnFields: ['1', '0'],
        sort: [{ field: '1', dir: 'desc' }],
        total: 120,
        filtered: false,
      })
    })

    it('counts what the filters leave, and leaves the footer’s count alone', () => {
      const table = tableWith({
        tabulator: firstPageOnly(allRows),
        tableParams: { filter: [{ field: '0', type: 'like', value: 'East' }], sort: [], page: 1 },
        filterCount: 60,
      })

      const view = table.getReportView(100)
      expect(view.rows).toHaveLength(60)
      expect(view.rows.every(([region]) => region === 'East')).toBe(true)
      expect(view).toMatchObject({ filters: [{ field: '0', value: 'East' }], total: 60, filtered: true })
      expect(table.filterCount).toBe(60)
    })
  })

  describe('a table too big to hold (sorts and filters by re-querying)', () => {
    it('takes the rows the server sent for the current sort, with the whole count', () => {
      const sorted = allRows.slice().reverse()
      const table = tableWith({
        countRows: 60044,
        tabulator: firstPageOnly(sorted),
        tableParams: { filter: [], sort: [{ field: '1', dir: 'desc' }], page: 1 },
        filteredResponseData: sorted,
      })

      const view = table.getReportView(100)
      expect(view.rows).toStrictEqual(sorted.slice(0, 100))
      expect(view).toMatchObject({ total: 60044, filtered: false })
    })

    it('counts what the server says the filters leave', () => {
      const table = tableWith({
        countRows: 60044,
        tabulator: firstPageOnly(allRows),
        tableParams: { filter: [{ field: '0', type: 'like', value: 'East' }], sort: [], page: 1 },
        filterCount: 30022,
        filteredResponseData: allRows.filter(([region]) => region === 'East'),
      })
      expect(table.getReportView(100)).toMatchObject({ total: 30022, filtered: true })
    })
  })

  it('falls back to the response when the table has no Tabulator yet', () => {
    const rows = [['East', 1]]
    const table = tableWith({ rows, countRows: 5 })
    expect(table.getReportView(100)).toStrictEqual({
      rows,
      columnFields: undefined,
      sort: [],
      filters: [],
      total: 5,
      filtered: false,
    })
  })
})
