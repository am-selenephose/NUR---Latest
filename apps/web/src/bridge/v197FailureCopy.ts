import { type UiCopyKey, uiCopy, uiSource } from "../lib/i18n";
import { V197ApiError } from "./v197ApiClient";

const FAILURE_CODE_COPY: Readonly<Record<string, UiCopyKey>> = {
  provider_disabled: uiSource("Live AI is not connected on this server, so NUR did not answer this turn. Your message was kept; nothing was invented."),
  csrf_missing: uiSource("Your session ended. Sign in again."),
  session_expired: uiSource("Your session ended. Sign in again."),
  capability_denied: uiSource("This owner-scoped action is not allowed."),
  not_found: uiSource("The requested owner record was not found."),
  conflict: uiSource("The owner record changed. Refresh and try again."),
  rate_limited: uiSource("Too many attempts. Wait a moment and try again."),
};

const FAILURE_STATUS_COPY: Readonly<Record<number, UiCopyKey>> = {
  0: uiSource("NUR API is unreachable. Check local readiness."),
  400: uiSource("Check the request and try again."),
  401: uiSource("Your session ended. Sign in again."),
  403: uiSource("This owner-scoped action is not allowed."),
  404: uiSource("The requested owner record was not found."),
  409: uiSource("The owner record changed. Refresh and try again."),
  413: uiSource("This upload is larger than the allowed limit."),
  422: uiSource("Check the required fields and try again."),
  429: uiSource("Too many attempts. Wait a moment and try again."),
};

/** Keep backend diagnostics internal while rendering one catalog-owned failure. */
export function visibleV197Failure(error: unknown, fallback: UiCopyKey): string {
  if (!(error instanceof V197ApiError)) return uiCopy(fallback);
  const code = error.code?.trim().toLowerCase() ?? "";
  const source = FAILURE_CODE_COPY[code]
    ?? FAILURE_STATUS_COPY[error.status]
    ?? (error.status >= 500 ? uiSource("NUR could not complete this server action.") : fallback);
  return uiCopy(source);
}
