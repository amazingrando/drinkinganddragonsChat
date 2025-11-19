import React from 'react'
import { initialProfile } from '@/lib/initial-profile'
import { db } from '@/lib/db'
import { redirect } from 'next/navigation'
import InitialModal from '@/components/modals/initial-modal'

const SetupPage = async () => {
  const profile = await initialProfile()

  // Check if user has a last visited server and channel
  if (profile.lastServerId && profile.lastChannelId) {
    // Validate user still has access to the last server
    const lastServer = await db.server.findFirst({
      where: {
        id: profile.lastServerId,
        members: {
          some: {
            profileID: profile.id,
          },
        },
      },
      include: {
        channels: {
          where: {
            id: profile.lastChannelId,
          },
        },
      },
    })

    if (lastServer) {
      // Check if the last channel still exists and user has access
      const lastChannel = lastServer.channels[0]
      if (lastChannel) {
        // Redirect to last server and channel
        return redirect(`/servers/${profile.lastServerId}/channels/${profile.lastChannelId}`)
      } else {
        // Last channel no longer exists, redirect to server's general channel
        const generalChannel = await db.channel.findFirst({
          where: {
            serverID: profile.lastServerId,
            name: 'general',
          },
          orderBy: {
            createdAt: 'desc',
          },
        })
        if (generalChannel) {
          return redirect(`/servers/${profile.lastServerId}/channels/${generalChannel.id}`)
        }
        // If no general channel, fall through to first server logic
      }
    }
    // Last server no longer exists or user lost access, fall through to first server logic
  }

  // Fallback to first available server
  const server = await db.server.findFirst({
    where: {
      members: {
        some: {
          profileID: profile.id,
        },
      },
    },
  })

  if (server) {
    return redirect(`/servers/${server.id}`)
  }

  return (
    <InitialModal />
  )
}

export default SetupPage