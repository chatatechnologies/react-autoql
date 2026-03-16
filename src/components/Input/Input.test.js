import { shallow, mount } from 'enzyme'
import { findByTestAttr } from '../../../test/testUtils'
import Input from './Input'

const defaultProps = {}

const setup = (props = {}, state = null) => {
  const setupProps = { ...defaultProps, ...props }
  const wrapper = shallow(<Input {...setupProps} />)
  if (state) {
    wrapper.setState(state)
  }
  return wrapper
}

describe('Input component prop forwarding', () => {
  test('does not forward filtered props like dataFormatting or onColumnSelectValueChange to native input', () => {
    const wrapper = mount(
      <Input
        dataFormatting={{ foo: 'bar' }}
        onColumnSelectValueChange={() => {}}
        aria-label='test-input'
        value='hello'
      />,
    )

    const input = wrapper.find('input')
    expect(input.exists()).toBe(true)

    // Ensure the filtered props are not present on the DOM node
    const domNode = input.getDOMNode()
    expect(domNode.getAttribute('dataformatting')).toBeNull()
    expect(domNode.getAttribute('oncolumnselectvaluechange')).toBeNull()

    // Ensure valid native props are forwarded
    expect(domNode.getAttribute('aria-label')).toBe('test-input')
  })
})

describe('renders correctly', () => {
  test('renders correctly with required props', () => {
    const wrapper = setup()
    const inputComponent = findByTestAttr(wrapper, 'react-autoql-input')
    expect(inputComponent.exists()).toBe(true)
  })
})
