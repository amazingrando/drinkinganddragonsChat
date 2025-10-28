import { currentProfile } from "@/lib/current-profile"
import { db } from "@/lib/db"
import { redirect } from "next/navigation"

interface InviteCodePageProps {
  params: Promise<{ inviteCode: string }>
}

const InviteCodePage = async ({
  params,
}: InviteCodePageProps) => {
  const profile = await currentProfile()

  if (!profile) {
    return redirect("/sign-in")
  }

  if (!(await params).inviteCode) {
    return redirect("/")
  }

  const existingServer = await db.server.findFirst({
    where: {
      inviteCode: (await params).inviteCode,
      members: {
        some: {
          profileID: profile.id,
        },
      }
    }
  })

  if (existingServer) {
    return redirect(`/servers/${existingServer.id}`)
  }

  const server = await db.server.update({
    where: {
      inviteCode: (await params).inviteCode,
    },
    data: {
      members: {
        create: [{
          profileID: profile.id,
        }],
      }
    }
  })

  if (server) {
    return redirect(`/servers/${server.id}`)
  }

  return null
}

export default InviteCodePage