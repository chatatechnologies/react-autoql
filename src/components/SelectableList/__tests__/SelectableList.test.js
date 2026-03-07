import React from 'react'
jest.mock('uuid', () => ({ v4: jest.fn(() => 'test-uuid') }))
import { mount } from 'enzyme'
import SelectableList from '../SelectableList'

describe('SelectableList key generation', () => {
  it('generates unique keys when id/key missing and duplicate names', () => {
    const items = [
      { name: 'shippers', content: <span>1</span> },
      { name: 'shippers', content: <span>2</span> },
    ]
    const wrapper = mount(<SelectableList items={items} />)
    const rows = wrapper.find('.react-autoql-list-item')
    expect(rows).toHaveLength(2)
    expect(rows.at(0).key()).toBe('shippers-0-test-uuid')
    expect(rows.at(1).key()).toBe('shippers-1-test-uuid')
  })

  it('prefers `id` then `key` when present', () => {
    const items = [
      { id: 'abc', name: 'foo', content: <span>1</span> },
      { key: 'k1', name: 'bar', content: <span>2</span> },
    ]
    const wrapper = mount(<SelectableList items={items} />)
    const rows = wrapper.find('.react-autoql-list-item')
    expect(rows.at(0).key()).toBe('abc')
    expect(rows.at(1).key()).toBe('k1')
  })

  it('produces stable keys across re-render of the same instance', () => {
    const items = [{ name: 'a', content: <span>1</span> }]
    const wrapper = mount(<SelectableList items={items} />)
    const key1 = wrapper.find('.react-autoql-list-item').at(0).key()
    wrapper.setProps({ items: [{ name: 'a', content: <span>1</span> }] })
    const key2 = wrapper.find('.react-autoql-list-item').at(0).key()
    expect(key1).toBe(key2)
  })
})
