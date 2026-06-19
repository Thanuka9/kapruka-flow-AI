/** Canonical judge demo prompt — frozen for submission. */

export const DEMO_PROMPT =

  "Amma birthday gift under 10000 deliver to Kandy tomorrow";



/** Loose match so minor punctuation differences still enable demo mode. */

export function isDemoPrompt(text) {

  const norm = (s) =>

    String(s || "")

      .trim()

      .toLowerCase()

      .replace(/,/g, "")

      .replace(/\s+/g, " ");

  return norm(text) === norm(DEMO_PROMPT);

}


