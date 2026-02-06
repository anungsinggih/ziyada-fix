export function getErrorMessage(error: unknown, fallback = "Unknown error") {
  if (!error) return fallback
  if (typeof error === "string") return error
  if (error instanceof Error) return error.message || fallback
  if (typeof error === "object") {
    const err = error as { message?: string; error_description?: string; details?: string }
    return err.message || err.error_description || err.details || fallback
  }
  return String(error)
}
