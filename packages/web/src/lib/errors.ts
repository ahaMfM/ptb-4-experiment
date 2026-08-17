/**
 * Turn the message of a failed request into something worth showing a user.
 *
 * The server rejects bad input with a Zod issue list, which arrives as a JSON
 * array in the error message; everything else already arrives as a sentence.
 * Callers do not have to know which of the two they got.
 */
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
