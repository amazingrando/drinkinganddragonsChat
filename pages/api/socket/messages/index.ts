import { NextApiRequest } from "next";
import { NextApiResponse } from "next";
import { currentProfilePages } from "@/lib/current-profile-pages";
import { db } from "@/lib/db";
import { broadcastMessage } from "@/lib/supabase/server-broadcast";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" })
  }

  try {
    const profile = await currentProfilePages(req);
    const { content, fileUrl } = req.body as { content?: string; fileUrl?: string };
    const { serverId, channelId } = req.query as { serverId?: string; channelId?: string };

    if (!profile) {
      return res.status(401).json({ message: "Unauthorized" })
    }

    if (!serverId) {
      return res.status(400).json({ message: "Server ID is required" })
    }

    if (!channelId) {
      return res.status(400).json({ message: "Channel ID is required" })
    }

    if (!content) {
      return res.status(400).json({ message: "Content is required" })
    }

    const server = await db.server.findFirst({
      where: {
        id: serverId as string,
        members: {
          some: {
            profileID: profile.id,
          }
        }
      },
      include: {
        members: true
      }
    })

    if (!server) {
      return res.status(404).json({ message: "Server not found" })
    }

    const channel = await db.channel.findFirst({
      where: {
        id: channelId as string,
        serverID: serverId as string,
      }
    })

    if (!channel) {
      return res.status(404).json({ message: "Channel not found" })
    }

    const member = server.members.find((member) => member.profileID === profile.id)

    if (!member) {
      return res.status(404).json({ message: "Member not found" })
    }

    const message = await db.message.create({
      data: {
        content,
        fileUrl,
        channelId: channel.id as string,
        memberId: member.id,
      },
      include: {
        member: {
          include: {
            profile: true,
          }
        }
      }
    })

    const channelKey = `chat:${channelId}:messages`

    // Supabase Realtime broadcast only
    try {
      await broadcastMessage(channelKey, channelKey, message);
    } catch (error) {
      console.log("[SUPABASE_BROADCAST_ERROR]", error);
      // Don't fail the request if Supabase broadcast fails
    }

    return res.status(200).json(message);

  } catch (error) {
    console.log("[MESSAGES_POST]", error)
    return res.status(500).json({ message: "Internal server error" })
  }
}