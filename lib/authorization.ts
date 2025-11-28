import { db } from '@/lib/db'
import { MemberRole } from '@prisma/client'

/**
 * Authorization helper functions for consistent access control
 */

/**
 * Check if user is a member of a server
 */
export async function isServerMember(
  profileId: string,
  serverId: string
): Promise<{ isMember: boolean; member?: { id: string; role: MemberRole } }> {
  const server = await db.server.findFirst({
    where: {
      id: serverId,
      members: { some: { profileID: profileId } },
    },
    include: {
      members: {
        where: { profileID: profileId },
        select: {
          id: true,
          role: true,
        },
      },
    },
  })

  if (!server || server.members.length === 0) {
    return { isMember: false }
  }

  return { isMember: true, member: server.members[0] }
}

/**
 * Check if user owns a server
 */
export async function isServerOwner(
  profileId: string,
  serverId: string
): Promise<boolean> {
  const server = await db.server.findFirst({
    where: {
      id: serverId,
      profileID: profileId,
    },
  })

  return !!server
}

/**
 * Check if user has admin or moderator role in a server
 */
export async function isServerAdminOrModerator(
  profileId: string,
  serverId: string
): Promise<boolean> {
  const { isMember, member } = await isServerMember(profileId, serverId)

  if (!isMember || !member) {
    return false
  }

  return member.role === MemberRole.ADMIN || member.role === MemberRole.MODERATOR
}

/**
 * Check if user is a member of a channel (via server membership)
 */
export async function isChannelMember(
  profileId: string,
  channelId: string,
  serverId: string
): Promise<{ isMember: boolean; member?: { id: string; role: MemberRole } }> {
  // First verify channel belongs to server
  const channel = await db.channel.findFirst({
    where: {
      id: channelId,
      serverID: serverId,
    },
  })

  if (!channel) {
    return { isMember: false }
  }

  // Then check server membership
  return isServerMember(profileId, serverId)
}

/**
 * Check if user owns a message
 */
export async function isMessageOwner(
  profileId: string,
  messageId: string
): Promise<boolean> {
  const message = await db.message.findFirst({
    where: { id: messageId },
    include: {
      member: {
        select: {
          profileID: true,
        },
      },
    },
  })

  if (!message) {
    return false
  }

  return message.member.profileID === profileId
}

/**
 * Check if user owns a file
 */
export async function isFileOwner(
  profileId: string,
  fileId: string
): Promise<boolean> {
  const file = await db.file.findFirst({
    where: {
      id: fileId,
      profileId: profileId,
    },
  })

  return !!file
}

/**
 * Check if user can modify a message
 * (owner, admin, or moderator of the server)
 */
export async function canModifyMessage(
  profileId: string,
  messageId: string
): Promise<{
  canModify: boolean
  reason?: string
  isOwner?: boolean
  isAdminOrMod?: boolean
}> {
  const message = await db.message.findFirst({
    where: { id: messageId },
    include: {
      member: {
        select: {
          profileID: true,
        },
      },
      channel: {
        include: {
          server: {
            include: {
              members: {
                where: { profileID: profileId },
                select: {
                  role: true,
                },
              },
            },
          },
        },
      },
    },
  })

  if (!message) {
    return { canModify: false, reason: 'Message not found' }
  }

  const isOwner = message.member.profileID === profileId
  const member = message.channel.server.members[0]
  const isAdminOrMod =
    member &&
    (member.role === MemberRole.ADMIN || member.role === MemberRole.MODERATOR)

  if (isOwner || isAdminOrMod) {
    return { canModify: true, isOwner, isAdminOrMod }
  }

  return { canModify: false, reason: 'Insufficient permissions' }
}

/**
 * Check if user can delete a file
 * (owner, or admin/moderator of the server it belongs to)
 */
export async function canDeleteFile(
  profileId: string,
  fileId: string
): Promise<{
  canDelete: boolean
  reason?: string
  isOwner?: boolean
  isAdminOrMod?: boolean
}> {
  const file = await db.file.findFirst({
    where: { id: fileId },
    include: {
      profile: {
        select: {
          id: true,
        },
      },
      server: {
        include: {
          members: {
            where: { profileID: profileId },
            select: {
              role: true,
            },
          },
        },
      },
    },
  })

  if (!file) {
    return { canDelete: false, reason: 'File not found' }
  }

  const isOwner = file.profileId === profileId

  let isAdminOrMod = false
  if (file.serverId && file.server) {
    const member = file.server.members[0]
    if (member) {
      isAdminOrMod =
        member.role === MemberRole.ADMIN || member.role === MemberRole.MODERATOR
    }
  }

  if (isOwner || isAdminOrMod) {
    return { canDelete: true, isOwner, isAdminOrMod }
  }

  return { canDelete: false, reason: 'Insufficient permissions' }
}

