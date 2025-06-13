export class DataSourceManager {
  constructor(queryResponse, tableRef, rowLimit) {
    this.queryResponse = queryResponse
    this.tableRef = tableRef
    this.rowLimit = rowLimit
  }

  get dataSize() {
    return this.queryResponse?.data?.data?.rows?.length || 0
  }

  get hasLargeDataset() {
    return this.dataSize > this.rowLimit
  }

  get hasValidTableRef() {
    return this.tableRef?._isMounted
  }

  get shouldUseLocalData() {
    return !this.hasLargeDataset && this.hasValidTableRef
  }

  getRawData() {
    return this.queryResponse?.data?.data?.rows || []
  }

  getLocalData() {
    return this.tableRef?.ref?.tabulator?.getData('active') || []
  }

  getOptimalDataSource() {
    return this.shouldUseLocalData ? this.getLocalData() : this.getRawData()
  }

  getClonedData() {
    return _cloneDeep(this.getOptimalDataSource())
  }
}
