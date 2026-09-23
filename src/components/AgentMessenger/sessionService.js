import axios from 'axios'
import { getAuthentication, GENERAL_QUERY_ERROR, UNAUTHENTICATED_ERROR, REQUEST_CANCELLED_ERROR } from 'autoql-fe-utils'

export const SESSIONS_ENDPOINT = '/autoql/api/v1/sessions'
export const MODELS_ENDPOINT = '/autoql/api/v1/models'

// Used when the models endpoint isn't available yet. The selector still renders from
// this list, so the control never silently disappears; the first entry is the default
// a new thread starts on, and is the model name the API is known to accept.
export const FALLBACK_MODELS = [
  { id: 'gpt-4.1', label: 'GPT-4.1', description: 'Faster, good for direct lookups' },
  { id: 'gpt-5', label: 'GPT-5', description: 'Best for multi-step analysis' },
]

export const isCancelError = (error) => {
  return axios.isCancel?.(error) || error?.message === REQUEST_CANCELLED_ERROR
}

const getRequestConfig = ({ authentication, cancelToken }) => {
  const { token } = getAuthentication(authentication)

  const config = { headers: {} }

  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  if (cancelToken) {
    config.cancelToken = cancelToken
  }

  return config
}

const getUrl = ({ authentication, path }) => {
  const { domain, apiKey } = getAuthentication(authentication)
  const url = `${domain}${path}`
  return apiKey ? `${url}?key=${apiKey}` : url
}

// Every error the UI sees goes through here, so a failure always has a message we
// can put in an error item rather than an empty bubble. The status and the request
// that caused it are logged and carried on the rejection, because the server's own
// text ("Internal Service Error…") says nothing about which call failed or why.
const normalizeError = (error, context = {}) => {
  if (isCancelError(error)) {
    return { message: REQUEST_CANCELLED_ERROR, isCancelled: true }
  }

  const status = error?.response?.status
  const responseData = error?.response?.data

  console.error(
    `[AgentMessenger] ${context.method ?? 'request'} failed` +
      `${status ? ` with HTTP ${status}` : ''} — ${context.path ?? ''}`,
    { requestBody: context.body, responseData, error },
  )

  if (status === 401 || status === 403) {
    return { message: UNAUTHENTICATED_ERROR, status }
  }

  // `detail` is always the best text we have for the failure, so it is always what
  // the message says. `detail` can also be a validation array, which is not text -
  // hence the string check.
  const detail = typeof responseData?.detail === 'string' ? responseData.detail.trim() : ''

  // 409 means the session the thread was resuming has closed. The caller recovers by
  // starting a new one, so this is flagged separately from the message itself.
  const isSessionExpired = status === 409

  // ...but only on 409 is that text a sentence the API wrote for the reader
  // ("Session has already completed…"), and so only there is it spoken as an agent
  // message instead of boxed up as a failure. Every other status keeps the error
  // item: the backend is FastAPI-shaped, so an HTTPException puts its message on
  // `detail` too, and a 404 from a resume or a 500 would otherwise be typed out as a
  // normal reply - no error styling, no retry, and a thread left open to fail the
  // same way on every follow-up.
  if (detail && isSessionExpired) {
    return { message: detail, status, responseData, isConversational: true, isSessionExpired }
  }

  const responseMessage = detail || responseData?.message || responseData?.error

  return { message: responseMessage || GENERAL_QUERY_ERROR, status, responseData, isSessionExpired }
}

/**
 * The create response carries a top level session_id; the resume response carries
 * response_items only. Returning null (not undefined) for a missing session_id lets
 * the reducer tell "no id in this response" apart from "the id is gone", so a resume
 * never clears the session the thread already established.
 *
 * meta_data says where the agent got to (`phase`) and whether the session is still
 * open (`session_status`). Both are lower-cased and trimmed here so a stray "Completed"
 * doesn't leave the thread accepting messages the server will reject.
 */
const normalizeSessionResponse = (response) => {
  const data = response?.data ?? {}
  const metaData = data.meta_data ?? {}

  const readToken = (value) => (typeof value === 'string' ? value.trim().toLowerCase() : '')

  return {
    sessionId: data.session_id ?? null,
    responseItems: Array.isArray(data.response_items) ? data.response_items : [],
    phase: readToken(metaData.phase) || null,
    sessionStatus: readToken(metaData.session_status) || null,
  }
}

// llm_model is left out for now - the backend picks the model.
export const createSession = ({ userInquiry, authentication, cancelToken }) => {
  const path = SESSIONS_ENDPOINT
  const url = getUrl({ authentication, path })
  const body = { user_inquiry: userInquiry }

  return axios
    .post(url, body, getRequestConfig({ authentication, cancelToken }))
    .then(normalizeSessionResponse)
    .catch((error) => Promise.reject(normalizeError(error, { method: 'createSession', path, body })))
}

export const resumeSession = ({ sessionId, userInquiry, authentication, cancelToken }) => {
  const path = `${SESSIONS_ENDPOINT}/${sessionId}/resume`
  const url = getUrl({ authentication, path })
  const body = { user_inquiry: userInquiry }

  return axios
    .post(url, body, getRequestConfig({ authentication, cancelToken }))
    .then(normalizeSessionResponse)
    .catch((error) => Promise.reject(normalizeError(error, { method: 'resumeSession', path, body })))
}

/**
 * The models endpoint isn't finalized yet, so accept either a list of plain strings
 * or a list of objects, and read the id from whichever key it turns up under.
 */
export const normalizeModels = (data) => {
  const list = Array.isArray(data) ? data : data?.models ?? data?.data?.models ?? []

  if (!Array.isArray(list)) {
    return []
  }

  return list
    .map((model) => {
      if (typeof model === 'string') {
        return { id: model, label: model }
      }

      const id = model?.id ?? model?.llm_model ?? model?.name
      if (!id) {
        return null
      }

      return {
        id,
        label: model.display_name ?? model.label ?? id,
        description: model.description,
      }
    })
    .filter(Boolean)
}

export const fetchModels = ({ authentication, endpoint, cancelToken }) => {
  const url = getUrl({ authentication, path: endpoint || MODELS_ENDPOINT })

  return axios
    .get(url, getRequestConfig({ authentication, cancelToken }))
    .then((response) => normalizeModels(response?.data))
    .catch((error) =>
      Promise.reject(normalizeError(error, { method: 'fetchModels', path: endpoint || MODELS_ENDPOINT })),
    )
}
