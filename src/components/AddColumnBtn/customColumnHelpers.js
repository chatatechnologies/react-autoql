import React from 'react'
import { Icon } from '../Icon'
import _cloneDeep from 'lodash.clonedeep'

export const OPERATORS = {
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
  FUNCTION: {
    value: 'FUNCTION',
    label: 'Function...',
    js: undefined,
  },
}

export const getOperators = (enableWindowFns) => {
  const opArray = _cloneDeep(OPERATORS)

  if (!enableWindowFns) {
    delete opArray.FUNCTION
  }

  return opArray
}

export const WINDOW_FUNCTIONS = {
  SUM: {
    value: 'SUM',
    label: 'SUM',
  },
  AVG: {
    value: 'AVG',
    label: 'AVERAGE',
  },
  COUNT: {
    value: 'COUNT',
    label: 'COUNT',
  },
  RANK: {
    value: 'RANK',
    label: 'RANK',
  },
}

const CHATA_ERROR = 'ChataError'

function ChataError(message = '') {
  this.name = CHATA_ERROR
  this.message = message
}

ChataError.prototype = Error.prototype

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
      throw new ChataError('Syntax Error: Formula contains unclosed brackets')
    }

    origColumnFnArray.forEach((chunk, i) => {
      if (chunk.type === 'operator') {
        if (i === origColumnFnArray.length - 1) {
          if (chunk.value !== 'RIGHT_BRACKET') {
            throw new ChataError("Syntax Error: Formula can't end with an operator")
          }
        }

        columnFnStr = columnFnStr + ' ' + (OPERATORS[chunk.value]?.js ?? '')
      } else if (chunk.type === 'number') {
        if (isValueEmpty(chunk.value)) {
          throw new ChataError('Syntax Error: Number input is empty')
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
    if (error.name == CHATA_ERROR) {
      return { error }
    }

    console.warn('Formula error: ' + error.message)
    return {
      error: new ChataError('Syntax Error: Invalid column formula'),
    }
  }
}

export const createMutatorFn = (columnFnArray) => {
  const fnObj = convertToFunctionStr(columnFnArray)

  if (fnObj?.error) {
    return fnObj
  }

  const fnString = fnObj.fn.toString()

  return (val, data, type, params, component) => {
    const fnValue = fnObj.fn(data)
    return fnValue
  }
}

export const getFnSummary = (columnFnArray) => {
  const fnObj = convertToFunctionStr(columnFnArray)
  if (fnObj?.error || !fnObj.fn) {
    return ''
  }

  try {
    let fnSummary = ''

    columnFnArray.forEach((chunk, i) => {
      if (chunk.type === 'operator') {
        fnSummary = `${fnSummary} ${OPERATORS[chunk.value]?.js}`
      } else if (chunk.type === 'number') {
        fnSummary = `${fnSummary} ${chunk.value}`
      } else if (chunk.type === 'column' && chunk?.column) {
        fnSummary = `${fnSummary} ${chunk.column?.display_name}`
      }
    })

    return fnSummary
  } catch (error) {
    console.error(error)
    return ''
  }
}
