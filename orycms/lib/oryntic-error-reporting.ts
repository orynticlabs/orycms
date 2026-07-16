type OrynticErrorOptions = {
  mechanism?: "manual" | "onerror" | "unhandledrejection" | "react_error_boundary";
  handled?: boolean;
  severity?: "error" | "warning" | "info";
};

type OrynticEvents = {
  captureException?: (
    error: unknown,
    context?: Record<string, unknown>,
    options?: OrynticErrorOptions,
  ) => void;
};

declare global {
  interface Window {
    __orynticEvents?: OrynticEvents;
  }
}

export function reportOrynticError(error: unknown, context: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  window.__orynticEvents?.captureException?.(
    error,
    {
      source: "react_error_boundary",
      route: window.location.pathname,
      ...context,
    },
    {
      mechanism: "react_error_boundary",
      handled: false,
      severity: "error",
    },
  );
}
