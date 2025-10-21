import { currentProfilePages } from "@/lib/current-profile-pages";
import { NextApiRequest } from "next";
import { NextApiResponse } from "next";
import { db } from "@/lib/db";
import { MemberRole } from "@prisma/client";
import { broadcastMessage } from "@/lib/supabase/server-broadcast";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "DELETE" && req.method !== "PATCH") {
    return res.status(405).json({ error: "Method not allowed" })
  }

  try {
    const profile = await currentProfilePages(req);
    const { directMessageId, conversationId } = req.query
    const { content } = req.body

    if (!profile) {
      return res.status(401).json({ error: "Unauthorized" })
    }

    if (!conversationId) {
      return res.status(400).json({ error: "Conversation ID is required" })
    }

    const conversation = await db.conversation.findFirst({
      where: {
        id: conversationId as string,
        OR: [
          {
            memberOne: {
              profileID: profile.id,
            }
          },
          {
            memberTwo: {
              profileID: profile.id,
            }
          }
        ]
      },
      include: {
        memberOne: {
          include: {
            profile: true,
          }
        },
        memberTwo: {
          include: {
            profile: true,
          }
        }
      }
    })

    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" })
    }
    
    const member = conversation.memberOne.profileID === profile.id ? conversation.memberOne : conversation.memberTwo

    let directMessage = await db.directMessage.findFirst({
      where: {
        id: directMessageId as string,
        conversationId: conversationId as string,
      }, 
      include: {
        member: {
          include: {
            profile: true,
          }
        },
      }
    })

    if (!directMessage || directMessage.deleted) {
      return res.status(404).json({ error: "Message not found" })
    }
    
    const isMessageOwner = directMessage.memberId === member.id;
    const isAdmin = member.role === MemberRole.ADMIN;
    const isModerator = member.role === MemberRole.MODERATOR;
    const canModify = isMessageOwner || isAdmin || isModerator;

    if (!canModify) {
      return res.status(401).json({ error: "Unauthorized" })
    }

    if (req.method === "DELETE") {
      directMessage = await db.directMessage.update({
        where: {
          id: directMessageId as string,
        },
        data: {
          fileUrl: null,
          content: "This message has been deleted",
          deleted: true,
        },
        include: {
          member: {
            include: {
              profile: true,
            }
          }
        }
      })
    }
    
    if (req.method === "PATCH") {
      if (!isMessageOwner) {
        return res.status(401).json({ error: "Unauthorized" })
      }

      directMessage = await db.directMessage.update({
        where: {
          id: directMessageId as string,
        },
        data: {
          content,
        },
        include: {
          member: {
            include: {
              profile: true,
            }
          }
        }
      })
    }

    const updateKey = `chat:${conversation.id}:directMessages:update`;

    // Supabase Realtime broadcast only
    try {
      await broadcastMessage(updateKey, updateKey, directMessage);
    } catch (error) {
      console.log("[SUPABASE_BROADCAST_ERROR]", error);
      // Don't fail the request if Supabase broadcast fails
    }

    return res.status(200).json(directMessage);

  } catch (error) {
    console.error("[MESSAGE_ID_REQUEST]", error)
    return res.status(500).json({ error: "Internal server error" })
  }
}