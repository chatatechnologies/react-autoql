const BILLING_USAGE_CEILING_REACHED = 'BILLING_USAGE_CEILING_REACHED'
const BLOCK_CEILING_EXCEEDED = 'BLOCK_CEILING_EXCEEDED'
const BILLING_USAGE_UNAVAILABLE = 'BILLING_USAGE_UNAVAILABLE'

const OVER_QUOTA_SUMMARY = 'Your most recent Auto Analyze usage put this account at or over its monthly quota.'

export const MAGIC_WAND_BILLING_GATE_MESSAGES = {
  over_quota: `${OVER_QUOTA_SUMMARY} You can increase your monthly quota, or wait until your next billing period, when usage resets.`,
  over_quota_summary: OVER_QUOTA_SUMMARY,
  unavailable: "We couldn't verify your Auto Analyze usage right now. You can still try again.",
}

// Query Controller's BillingUsageGate has no discriminating code for this state today
// (its response body's `data` is `{}`) — matching on the exact message is the only
// signal available, and is fragile against wording/localization changes.
const BILLING_REQUIRED_MESSAGE = 'Billing is required for this request. A valid billing customer key is not configured.'

// `fetchLLMSummary`/`fetchLLMSummaryQuote` (autoql-fe-utils) already unwrap the axios
// error to `error.response.data` before rejecting, so `error` here is that response
// body directly: `{ reference_id, message, data: { code, outcome } }`.
export const getMagicWandBillingErrorState = (error) => {
  const code = error?.data?.code
  const outcome = error?.data?.outcome

  if (code === BILLING_USAGE_CEILING_REACHED && outcome === BLOCK_CEILING_EXCEEDED) {
    return 'over_quota'
  }

  if (code === BILLING_USAGE_UNAVAILABLE) {
    return 'unavailable'
  }

  if (!code && error?.message === BILLING_REQUIRED_MESSAGE) {
    return 'unavailable'
  }

  return null
}
