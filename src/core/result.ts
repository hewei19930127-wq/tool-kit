/** Normalize a caught (unknown) error into a human-readable message. */
export function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
