export class AsyncErrorHandler {
  static async handleOperation(operation, onError, context = 'operation') {
    try {
      const result = operation()

      // Handle promise-based results
      if (result && typeof result.catch === 'function') {
        result.catch((error) => {
          const properError = error || new Error(`Unknown error in ${context} promise`)
          console.error(properError)
          onError(properError)
        })
      }

      return result
    } catch (error) {
      // Handle synchronous errors
      const properError = error || new Error(`Unknown error in ${context}`)
      console.error(properError)
      onError(properError)
      throw properError
    }
  }

  static createError(error, defaultMessage = 'Unknown error occurred') {
    if (error instanceof Error) return error
    if (typeof error === 'string' && error.length > 0) return new Error(error)
    return new Error(defaultMessage)
  }

  static handleTabulatorSort(tabulator, field, direction, onError) {
    return this.handleOperation(() => tabulator.setSort(field, direction), onError, 'setSort')
  }
}

export const withErrorHandling = (operation, errorContext = 'operation') => {
  return async (...args) => {
    try {
      const result = await operation(...args)
      return result
    } catch (error) {
      const properError = AsyncErrorHandler.createError(error, `Error in ${errorContext}`)
      console.error(properError)
      throw properError
    }
  }
}
