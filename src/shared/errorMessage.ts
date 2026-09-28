/** Best-effort message from Wix SDK / web method errors. */
export function extractErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  if (typeof error === 'object' && error) {
    const err = error as {
      message?: unknown;
      details?: unknown;
      code?: unknown;
      applicationError?: { code?: unknown; description?: unknown; data?: unknown };
      response?: { data?: unknown; status?: unknown };
    };
    const appErr = err.applicationError;
    if (appErr && (appErr.code || appErr.description)) {
      const parts = [
        appErr.code != null ? String(appErr.code) : '',
        appErr.description != null ? String(appErr.description) : '',
      ].filter(Boolean);
      if (parts.length) return parts.join(': ');
    }
    if (typeof err.message === 'string' && err.message.trim()) {
      return err.message;
    }
    if (err.details) {
      try {
        return JSON.stringify(err.details);
      } catch {
        // fall through
      }
    }
    if (err.response?.data) {
      try {
        return JSON.stringify(err.response.data).slice(0, 400);
      } catch {
        // fall through
      }
    }
    if (err.code != null) {
      return `code=${String(err.code)}`;
    }
    try {
      const json = JSON.stringify(error);
      if (json && json !== '{}') return json.slice(0, 400);
    } catch {
      // fall through
    }
  }
  return String(error);
}

/** Compact error fingerprint for debug toasts (no PII). */
export function extractErrorDebug(error: unknown): Record<string, string> {
  const out: Record<string, string> = {
    msg: extractErrorMessage(error).slice(0, 180),
  };
  if (typeof error === 'object' && error) {
    const err = error as {
      name?: unknown;
      code?: unknown;
      applicationError?: { code?: unknown; description?: unknown };
      details?: { applicationError?: { code?: unknown; description?: unknown } };
    };
    if (err.name != null) out.name = String(err.name).slice(0, 40);
    if (err.code != null) out.code = String(err.code).slice(0, 40);
    const app =
      err.applicationError || err.details?.applicationError;
    if (app?.code != null) out.appCode = String(app.code).slice(0, 40);
    if (app?.description != null) {
      out.appDesc = String(app.description).slice(0, 80);
    }
  }
  return out;
}
