export type ParseInviteOk = { ok: true; code: string }
export type ParseInviteErr = { ok: false; error: string }
export type ParseInviteResult = ParseInviteOk | ParseInviteErr

export function parseInviteCode(input: string): ParseInviteResult {
  const raw = input.trim()
  if (!raw) return { ok: false, error: "Invite is required" }

  // If it's a URL, extract last segment or ?code=
  try {
    const url = new URL(raw)
    const codeParam = url.searchParams.get("code")
    const candidate = codeParam || url.pathname.split("/").filter(Boolean).pop() || ""
    const code = candidate.trim()
    if (!isValidCode(code)) return { ok: false, error: "Invalid invite code" }
    return { ok: true, code }
  } catch {
    // Not a URL, treat as code
    if (!isValidCode(raw)) return { ok: false, error: "Invalid invite code" }
    return { ok: true, code: raw }
  }
}

function isValidCode(code: string): boolean {
  if (!code) return false
  // allow alphanumeric, dash, underscore; 3-128 chars
  return /^[A-Za-z0-9_-]{3,128}$/.test(code)
}


