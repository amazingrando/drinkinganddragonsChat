import { NextRequest, NextResponse } from 'next/server';
import { AccessToken } from 'livekit-server-sdk';
import { currentProfile } from '@/lib/current-profile';
import { db } from '@/lib/db';
import { rateLimitPresets } from '@/lib/rate-limit';
import { livekitTokenSchema, validateRequestBody, validationErrorResponse } from '@/lib/validation';
import { secureErrorResponse } from '@/lib/error-handling';

// Do not cache endpoint result
export const revalidate = 0;

export async function GET(req: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimitPresets.moderate(req)
  if (rateLimitResponse) {
    return rateLimitResponse
  }

  try {
    const profile = await currentProfile();

    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const roomParam = req.nextUrl.searchParams.get('room');
    const serverIdParam = req.nextUrl.searchParams.get('serverId');

    // Validate query parameters
    const validation = validateRequestBody(livekitTokenSchema, { room: roomParam, serverId: serverIdParam })
    if (!validation.success) {
      return validationErrorResponse(validation)
    }

    const { room, serverId } = validation.data

    // Verify user is member of the server
    const server = await db.server.findFirst({
      where: {
        id: serverId,
        members: { some: { profileID: profile.id } },
      },
    });

    if (!server) {
      return NextResponse.json({ error: 'Server not found or access denied' }, { status: 403 });
    }

    // Validate room name format matches server pattern
    // Room names should typically match the channel/server pattern
    const expectedRoomPrefix = `server-${serverId}`;
    if (!room.startsWith(expectedRoomPrefix)) {
      return NextResponse.json({ error: 'Invalid room name' }, { status: 400 });
    }

    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const wsUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;

    if (!apiKey || !apiSecret || !wsUrl) {
      return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
    }

    // Use authenticated user's profile ID as identity instead of arbitrary username
    const at = new AccessToken(apiKey, apiSecret, { identity: profile.id });
    at.addGrant({ room, roomJoin: true, canPublish: true, canSubscribe: true });

    return NextResponse.json(
      { token: await at.toJwt() },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return secureErrorResponse(error, '[LIVEKIT_GET]', 'Failed to generate token');
  }
}