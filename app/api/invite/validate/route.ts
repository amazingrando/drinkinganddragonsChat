import { db } from "@/lib/db"

export async function POST(req: Request) {
  try {
    const { code } = await req.json()

    if (!code || typeof code !== 'string') {
      return Response.json({ ok: false, error: 'Invite code is required' }, { status: 400 })
    }

    // Check if a server exists with this invite code
    const server = await db.server.findUnique({
      where: {
        inviteCode: code,
      },
    })

    if (!server) {
      return Response.json({ ok: false, error: 'Invalid invite code' }, { status: 400 })
    }

    return Response.json({ ok: true })
  } catch (error) {
    console.error("[INVITE_VALIDATE]", error)
    return Response.json({ ok: false, error: 'Bad request' }, { status: 400 })
  }
}


