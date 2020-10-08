import React from 'react'

export default {
  GENERAL_QUERY: (
    <span>
      Oops! It looks like our system is experiencing an issue. Try querying
      again. If the problem persists, please{' '}
      <a target="_blank" href="mailto:support@chata.ai">
        contact our team directly
      </a>
      . We'll look into this issue right away and be in touch with you shortly.
    </span>
  ),
  GENERAL_HTML: (
    <span>
      Oops! Something went wrong. Please try again. If the problem persists,{' '}
      <a target="_blank" href="mailto:support@chata.ai">
        contact our team directly
      </a>
      . We’ll look into this issue and be in touch shortly.
    </span>
  ),
  UNAUTHENTICATED: (
    <span>
      Uh oh.. It looks like you don't have access to this resource. Please
      double check that all required authentication fields are correct.
    </span>
  ),
}
