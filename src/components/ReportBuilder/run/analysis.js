import { fetchLLMSummary, getAuthentication } from 'autoql-fe-utils'
import {
  getMagicWandBillingErrorState,
  MAGIC_WAND_BILLING_GATE_MESSAGES,
} from '../../../hooks/billing/magicWandBillingErrors'
import { STRINGS } from '../strings'

// Asks Auto Analyze to write about one result (model/analysis.js getAnalysisInput), the way an answer's own
// Auto Analyze does: the rows shown and every column, with the question and how it was read. Each call uses one
// Auto Analyze credit, and can't be stopped once sent. Never rejects: { ok: true, text } (Markdown) or
// { ok: false, message, billing? } — billing being 'over_quota' or 'unavailable' when that's why.
export const runAnalysis = ({ input, focus = '', authentication, fetchSummary = fetchLLMSummary }) => {
  const auth = getAuthentication(authentication)
  let asking
  try {
    asking = fetchSummary({
      queryID: input.queryId,
      data: {
        additional_context: {
          text: input.text,
          interpretation: input.interpretation,
          focus_prompt: (focus || '').trim(),
        },
        rows: input.rows,
        columns: input.columns,
      },
      apiKey: auth.apiKey,
      token: auth.token,
      domain: auth.domain,
    })
  } catch (error) {
    asking = Promise.reject(error)
  }

  return Promise.resolve(asking).then(
    (response) => {
      const text = response?.data?.data?.summary
      return typeof text === 'string' && text.trim()
        ? { ok: true, text }
        : { ok: false, message: STRINGS.analysis.failed }
    },
    // fetchLLMSummary rejects with the response body: { reference_id, message, data: { code, outcome } }.
    (error) => {
      const billing = getMagicWandBillingErrorState(error)
      if (billing) {
        return { ok: false, billing, message: MAGIC_WAND_BILLING_GATE_MESSAGES[billing] }
      }
      const detail = typeof error?.message === 'string' ? error.message : ''
      return { ok: false, message: detail ? `${STRINGS.analysis.failed} ${detail}` : STRINGS.analysis.failed }
    },
  )
}
