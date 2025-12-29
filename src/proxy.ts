import { type NextRequest, NextResponse } from "next/server";
import { redis } from "./lib/redis";
import { AUTH_TOKEN_KEY, ROOM_PREFIX } from "./utils/const";
import { nanoid } from "./utils/generate";

export const proxy = async (req: NextRequest) => {
  const pathname = req.nextUrl.pathname;
  const roomMatch = pathname.match(/^\/room\/([^/]+)$/);
  if (!roomMatch) return NextResponse.redirect(new URL("/", req.url));

  const roomId = roomMatch[1];
  const redisKey = `${ROOM_PREFIX}:${roomId}`;
  const lockKey = `${ROOM_PREFIX}:${roomId}:lock`;

  const existingToken = req.cookies.get(AUTH_TOKEN_KEY)?.value;

  const lock = await redis.set(lockKey, "1", {
    nx: true,
    px: 1000,
  });

  if (!lock) {
    return NextResponse.redirect(new URL("/?error=room-busy", req.url));
  }

  try {
    const cache = await redis.hgetall<{
      connected: string[];
      createdAt: number;
    }>(redisKey);

    if (!cache) {
      return NextResponse.redirect(new URL("/?error=room-not-found", req.url));
    }

    const connected = cache.connected ?? [];

    if (existingToken && connected.includes(existingToken)) {
      return NextResponse.next();
    }

    if (connected.length >= 2) {
      return NextResponse.redirect(new URL("/?error=room-full", req.url));
    }

    const token = nanoid(15);
    const updatedConnected = [...connected, token];

    await redis.hset(redisKey, {
      connected: updatedConnected,
    });

    const response = NextResponse.next();
    response.cookies.set(AUTH_TOKEN_KEY, token, {
      path: "/",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    });

    return response;
  } finally {
    await redis.del(lockKey);
  }
};

export const config = {
  matcher: "/room/:path*",
};