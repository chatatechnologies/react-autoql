import React from 'react'
import { shallow } from 'enzyme'
import TablePlaceholder from './TablePlaceholder'

const setup = (props = {}) => {
  return shallow(<TablePlaceholder {...props} />)
}

describe('TablePlaceholder', () => {
  describe('rendering', () => {
    test('renders without crashing', () => {
      const wrapper = setup()
      expect(wrapper.find('.react-autoql-placeholder-table-container').exists()).toBe(true)
    })

    test('renders header row', () => {
      const wrapper = setup()
      expect(wrapper.find('.react-autoql-table-placeholder-header').exists()).toBe(true)
    })

    test('renders correct number of rows', () => {
      const wrapper = setup({ rows: 5, columns: 2 })
      // header row + 5 body rows
      const rows = wrapper.find('.react-autoql-table-placeholder-row')
      expect(rows.length).toBe(6) // 1 header + 5 body
    })

    test('default renders 3 rows', () => {
      const wrapper = setup()
      const rows = wrapper.find('.react-autoql-table-placeholder-row')
      expect(rows.length).toBe(4) // 1 header + 3 default body rows
    })

    test('renders correct number of cells per row', () => {
      const wrapper = setup({ rows: 1, columns: 4 })
      const bodyRows = wrapper.find('.react-autoql-table-placeholder-row').filterWhere(
        (n) => !n.hasClass('react-autoql-table-placeholder-header'),
      )
      const cells = bodyRows.first().find('.react-autoql-placeholder-loader')
      expect(cells.length).toBe(4)
    })

    test('applies custom className', () => {
      const wrapper = setup({ className: 'my-placeholder' })
      expect(wrapper.find('.react-autoql-placeholder-table-container').hasClass('my-placeholder')).toBe(true)
    })
  })
})
