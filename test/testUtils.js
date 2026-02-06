import checkPropTypes from 'prop-types/checkPropTypes'

export const findByTestAttr = (wrapper, val) => wrapper.find(`[data-test='${val}']`)

export const checkProps = (component, conformingProps) => {
  const propError = checkPropTypes(component.propTypes, conformingProps, 'prop', component.name)
  expect(propError).toBeUndefined()
}

export const ignoreConsoleErrors = (callback) => {
  const originalError = console.error
  console.error = jest.fn()
  callback()
  console.error = originalError
}
