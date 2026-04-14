import React from 'react'
import { mount } from 'enzyme'
import CustomColumnModal from '../../AddColumnBtn/CustomColumnModal'
import { authenticationDefault, autoQLConfigDefault, dataFormattingDefault } from 'autoql-fe-utils'

describe('CustomColumnModal.cleanColumnFn', () => {
  test('preserves explicit zero values (0 and "0") but removes empty tokens', () => {
    const props = {
      columns: [],
      enableWindowFunctions: false,
      authentication: authenticationDefault,
      autoQLConfig: autoQLConfigDefault,
      dataFormatting: dataFormattingDefault,
      onAddColumn: () => {},
      onClose: () => {},
    }

    // Instantiate without mounting the full DOM-heavy component
    const instance = new CustomColumnModal(props)

    const input = [
      { type: 'number', value: 0 },
      { type: 'number', value: '0' },
      { type: 'number', value: '' },
      { type: 'operator', value: '+' },
    ]

    const cleaned = instance.cleanColumnFn(input)

    // explicit zeros should be preserved
    expect(cleaned).toEqual(expect.arrayContaining([{ type: 'number', value: 0 }, { type: 'number', value: '0' }]))

    // empty-string token should be removed
    expect(cleaned).not.toEqual(expect.arrayContaining([{ type: 'number', value: '' }]))
  })
})
