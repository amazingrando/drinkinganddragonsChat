export async function POST(req: Request) {
  try {
    const { code } = await req.json()

    const allowed = (process.env.INVITE_CODES || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)

    if (!code || !allowed.includes(code)) {
      return Response.json({ ok: false, error: 'Invalid invite code' }, { status: 400 })
    }

    return Response.json({ ok: true })
  } catch {
    return Response.json({ ok: false, error: 'Bad request' }, { status: 400 })
  }
}


