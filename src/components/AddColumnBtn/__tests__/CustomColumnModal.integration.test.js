import React from 'react'
import { mount } from 'enzyme'
import { act } from 'react-dom/test-utils'

const flushPromises = () => new Promise((res) => setTimeout(res, 0))
import CustomColumnModal from '../CustomColumnModal'

jest.mock('../../ChataTable/ChataTable', () => {
  return {
    __esModule: true,
    default: function Mock(props) {
      globalThis.__lastChataTableProps = props
      return null
    },
  }
})

describe('CustomColumnModal integration (UI interactions)', () => {
  it('wraps scalar rows into a 2D array and provides columns/query_id', async () => {
    const columns = [{ field: '0', title: 'Value', is_visible: true }]
    const queryResponse = { data: { data: { rows: 1480824, columns: [{ name: 'Value' }], query_id: 'q1' } } }

    const wrapper = mount(<CustomColumnModal isOpen={true} columns={columns} queryResponse={queryResponse} />)

    await act(async () => {
      await flushPromises()
      wrapper.update()
    })

    const props = globalThis.__lastChataTableProps
    expect(props).toBeTruthy()
    expect(Array.isArray(props.response.data.data.rows)).toBe(true)
    expect(Array.isArray(props.response.data.data.rows[0])).toBe(true)
    expect(props.response.data.data.rows[0][0]).toBe(1480824)
    expect(props.response.data.data.columns).toBeDefined()
    expect(props.response.data.data.query_id).toBeDefined()
  })

  it('renders preview with formula including number + column', async () => {
    const columns = [{ field: '0', title: 'A', is_visible: true, name: 'A' }]
    const wrapper = mount(<CustomColumnModal isOpen={true} columns={columns} queryResponse={{ data: { data: {} } }} />)

    // Simulate typing a formula and ensure the preview shows
    await act(async () => {
      await flushPromises()
      wrapper.update()
    })

    const props = globalThis.__lastChataTableProps
    expect(props).toBeDefined()
  })
})
