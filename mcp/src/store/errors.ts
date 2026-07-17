import { z } from "zod";

// Zod's default ZodError.message is a JSON-stringified issues array — the SDK
// surfaces that verbatim as the tool's isError text. Format it into a message
// an agent can act on directly: which field, what was expected, what went wrong.
export function formatZodError(error: z.ZodError): string {
  const lines = error.issues.map((issue) => {
    const path = issue.path.join(".") || "(root)";
    return `  - ${path}: ${issue.message}`;
  });
  return `Validation failed:\n${lines.join("\n")}`;
}
