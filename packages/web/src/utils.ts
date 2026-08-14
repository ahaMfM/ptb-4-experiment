/** Zod validation errors arrive as a JSON array in the message; show just the texts. */
export function readableError(message: string): string {
  try {
    const issues = JSON.parse(message) as Array<{ message?: string }>;
    if (Array.isArray(issues)) {
      const texts = issues.map((i) => i.message).filter(Boolean);
      if (texts.length > 0) return texts.join(" ");
    }
  } catch {
    // not JSON — fall through
  }
  return message;
}
