import React from 'react'
import { Icon } from '../Icon'

export const operators = {
  CONCAT: {
    value: 'CONCAT',
    label: 'Concatenate(...)',
    js: '',
  },
  ADDITION: {
    value: 'ADD',
    label: <Icon type='plus' />,
    icon: 'plus',
    fn: (a, b) => a + b,
    js: '+',
  },
  SUBTRACTION: {
    value: 'SUBTRACT',
    label: <Icon type='minus' />,
    icon: 'minus',
    fn: (a, b) => a - b,
    js: '-',
  },
  MULTIPLICATION: {
    value: 'MULTIPLY',
    label: <Icon type='close' />,
    icon: 'close',
    fn: (a, b) => a * b,
    js: '*',
  },
  DIVISION: {
    value: 'DIVIDE',
    label: <Icon type='divide' />,
    icon: 'divide',
    fn: (a, b) => a / b,
    js: '/',
  },
  LEFT_BRACKET: {
    value: 'LEFT_BRACKET',
    label: ' ( ',
    js: '(',
  },
  RIGHT_BRACKET: {
    value: 'RIGHT_BRACKET',
    label: ' ) ',
    js: ')',
  },
}

export const isValueEmpty = (value) => {
  return value === null || value === undefined || value === ''
}

export const convertToFunctionStr = (origColumnFnArray) => {
  try {
    let columnFnStr = ''

    // Check for unclosed brackets
    const numRightBrackets = origColumnFnArray.filter((chunk) => chunk.value === 'RIGHT_BRACKET')?.length
    const numLeftBrackets = origColumnFnArray.filter((chunk) => chunk.value === 'LEFT_BRACKET')?.length
    if (numRightBrackets !== numLeftBrackets) {
      throw new Error('Function contains unclosed brackets')
    }

    origColumnFnArray.forEach((chunk, i) => {
      if (chunk.type === 'operator') {
        if (i === origColumnFnArray.length - 1) {
          if (chunk.value !== 'RIGHT_BRACKET') {
            throw new Error("The function can't end with an operator")
          }
        }

        columnFnStr = columnFnStr + ' ' + (operators[chunk.value]?.js ?? '')
      } else if (chunk.type === 'number') {
        if (isValueEmpty(chunk.value)) {
          throw new Error('Number input is empty')
        }

        columnFnStr = columnFnStr + ' ' + chunk.value
      } else if (chunk.type === 'column' && chunk?.column) {
        columnFnStr = columnFnStr + ' row[' + chunk?.column?.index + ']'
      }
    })

    const returnStr = 'return' + columnFnStr

    const fn = Function('row', returnStr)

    return { fn }
  } catch (error) {
    return {
      fn: undefined,
      error,
    }
  }
}

export const createMutatorFn = (columnFnArray) => {
  const fnObj = convertToFunctionStr(columnFnArray)

  if (fnObj?.error) {
    return fnObj
  }

  return (val, data, type, params, component) => {
    const fnValue = fnObj.fn(data)
    return fnValue
  }
}
