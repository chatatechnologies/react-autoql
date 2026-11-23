import { getExampleValue, getSampleQueryColumns } from './sampleQueryColumns'

const dataPreview = {
  data: {
    data: {
      columns: [
        { name: 'customer', type: 'STRING', alt_name: 'client' },
        { name: 'amount', type: 'QUANTITY' },
        { name: 'date', type: 'DATE_STRING' },
      ],
      rows: [
        [null, 1, null],
        ['Acme', 5, '2026-11-01'],
        ['Globex', 9, '2026-11-02'],
      ],
    },
  },
}

describe('getExampleValue', () => {
  test('the first value present for a text column', () => {
    expect(getExampleValue({ column: dataPreview.data.data.columns[0], columnIndex: 0, dataPreview })).toBe('Acme')
  })

  test('the median for a number column', () => {
    expect(getExampleValue({ column: dataPreview.data.data.columns[1], columnIndex: 1, dataPreview })).toBe('5')
  })

  test('the first value present for a date column', () => {
    expect(getExampleValue({ column: dataPreview.data.data.columns[2], columnIndex: 2, dataPreview })).toBe(
      '2026-11-01',
    )
  })

  test('empty when the preview has no rows', () => {
    expect(getExampleValue({ column: { name: 'customer', type: 'STRING' }, columnIndex: 0 })).toBe('')
  })
})

describe('getSampleQueryColumns', () => {
  test('nothing to narrow by gives undefined', () => {
    expect(getSampleQueryColumns({ dataPreview, selectedColumns: [] })).toBeUndefined()
  })

  test('picked columns get example values and alternative names', () => {
    expect(getSampleQueryColumns({ dataPreview, selectedColumns: [0] })).toEqual({
      customer: { value: 'Acme', alternative_column_names: ['client'] },
    })
  })

  test('a searched value comes first and is not overwritten by a pick of the same column', () => {
    const valueLabel = { column_name: 'customer', keyword: 'Initech' }
    expect(getSampleQueryColumns({ dataPreview, selectedColumns: [0, 1], valueLabel })).toEqual({
      customer: { value: 'Initech' },
      amount: { value: '5' },
    })
  })
})
