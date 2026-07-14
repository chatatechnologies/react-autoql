import type { Authentication } from 'autoql-fe-utils'
export type { Authentication } from 'autoql-fe-utils'

export type BillingQuotaStatus = 'no_quota' | 'under_quota' | 'at_or_over_quota'

export type BillingCustomerKeyState = 'idle' | 'loading' | 'success' | 'missing_customer' | 'error'

export type BillingUsageState = 'idle' | 'loading' | 'success' | 'missing_customer' | 'unavailable' | 'error'

export type BillingHistoryState = 'idle' | 'loading' | 'success' | 'unavailable' | 'error'

export interface BillingCustomerScope {
  scope_type?: string
  scope_id?: string
}

export interface BillingCustomerKeyResponse {
  billing_customer_key: string
  scope?: BillingCustomerScope | null
}

export interface BillingCurrentUsage {
  integrator_id: number
  billing_customer_key: string
  billing_period: string
  usage_to_date_micros: number
  active_monthly_quota_micros: number | null
  pending_monthly_quota_micros: number | null
  pending_effective_billing_period: string | null
  remaining_quota_micros: number | null
  quota_status: BillingQuotaStatus
}

export interface BillingHistoryItem {
  billing_period: string
  usage_to_date_micros: number
  quota_projection_label: 'current_quota_projection'
  current_quota_projection_monthly_micros?: number | null
  current_quota_projection_status: BillingQuotaStatus
}

export interface BillingQuotaUpdateResponse {
  integrator_id: number
  billing_customer_key: string
  currency: string
  active_monthly_quota_micros: number | null
  active_effective_billing_period: string | null
  pending_monthly_quota_micros: number | null
  pending_effective_billing_period: string | null
  current_billing_period: string
  current_period_usage_micros: number
  upsert_result: 'created' | 'updated' | 'noop'
  effective_update_mode: 'immediate' | 'scheduled' | 'none'
  updated_by?: string | null
  updated_by_type?: string | null
}

export interface UseBillingCustomerKeyArgs {
  authentication: Authentication
}

export interface UseBillingCustomerKeyResult {
  billingCustomerKey: string | null
  data: BillingCustomerKeyResponse | null
  scope: BillingCustomerScope | null
  state: BillingCustomerKeyState
}

export interface UseBillingUsageArgs {
  authentication: Authentication
  billingCustomerKey?: string | null
  refreshKey?: number
}

export interface UseBillingUsageResult {
  data: BillingCurrentUsage | null
  state: BillingUsageState
}

export interface UseBillingHistoryArgs {
  authentication: Authentication
  billingCustomerKey?: string | null
  from?: string
  to?: string
}

export interface UseBillingHistoryResult {
  items: BillingHistoryItem[]
  state: BillingHistoryState
}

export interface UseBillingQuotaUpdateArgs {
  authentication: Authentication
  billingCustomerKey?: string | null
}

export interface UseBillingQuotaUpdateResult {
  isSaving: boolean
  updateQuota: (monthlyQuotaMicros: number) => Promise<BillingQuotaUpdateResponse>
}

export declare function useBillingCustomerKey(args: UseBillingCustomerKeyArgs): UseBillingCustomerKeyResult
export declare function useBillingUsage(args: UseBillingUsageArgs): UseBillingUsageResult
export declare function useBillingHistory(args: UseBillingHistoryArgs): UseBillingHistoryResult
export declare function useBillingQuotaUpdate(args: UseBillingQuotaUpdateArgs): UseBillingQuotaUpdateResult

export declare function formatMicrosAsCurrency(micros?: number | null, emptyLabel?: string): string
export declare function microsFromCurrencyInput(value: string): number | null
export declare function currencyInputFromMicros(micros?: number | null): string
export declare function formatBillingPeriod(period?: string | null): string
export declare function getDefaultBillingHistoryRange(): { from: string; to: string }

export declare function getStoredBillingCustomerKey(apiKey?: string): string | null
export declare function setStoredBillingCustomerKey(billingCustomerKey: string, apiKey?: string): void
export declare function clearStoredBillingCustomerKey(apiKey?: string): void
