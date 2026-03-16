const indexedDB =
  window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB || window.shimIndexedDB

const version = 1

export function createQueryDB(data) {
  if (!indexedDB) {
    console.warn('IndexedDB could not be found in this browser.')
    return
  }

  const queryID = data?.query_id
  if (!queryID) {
    console.warn('Invalid query supplied to createQueryDB - no query ID found.')
    return
  }

  indexedDB.deleteDatabase('QueryData')

  const request = indexedDB.open('QueryData', version)

  request.onerror = function (event) {
    console.error('An error occurred with IndexedDB')
    console.error(event)
  }

  request.onupgradeneeded = function () {
    const db = request.result

    if (
      db.objectStoreNames &&
      typeof db.objectStoreNames.contains === 'function' &&
      db.objectStoreNames.contains(queryID)
    ) {
      db.deleteObjectStore(queryID)
    }

    db.createObjectStore(queryID)
  }

  request.onsuccess = function () {
    const db = request.result

    if (data?.rows?.length && data?.columns?.length) {
      const transaction = db.transaction(queryID, 'readwrite')
      const store = transaction.objectStore(queryID)

      data.rows.forEach((row, i) => {
        const rowData = {}

        row.forEach((value, j) => {
          rowData[j] = value
        })

        store.add(rowData, `row-${i}`)
      })
    }

    const transaction = db.transaction(queryID, 'readwrite')
    const store = transaction.objectStore(queryID)
    const allQuery = store.getAll()
    allQuery.onsuccess = function () {}
  }

  return request
}
