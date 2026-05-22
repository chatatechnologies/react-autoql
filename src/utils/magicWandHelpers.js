import { isSingleValueResponse } from 'autoql-fe-utils'

export function getMagicWandDatasetRowCount(queryResponse) {
  return queryResponse?.data?.data?.rows?.length ?? 0
}

export function isMagicWandDatasetTooLarge() {
  return false
}

export function shouldShowMagicWandForQueryCore(enableMagicWand, queryResponse) {
  if (!enableMagicWand) {
    return false
  }

  if (!queryResponse?.data?.data?.rows || !queryResponse?.data?.data?.columns) {
    return false
  }

  const rows = queryResponse?.data?.data?.rows || []
  if (rows.length <= 1) {
    return false
  }

  if (isSingleValueResponse(queryResponse)) {
    return false
  }

  return true
}
