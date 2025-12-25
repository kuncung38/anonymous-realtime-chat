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

  const existingToken = req.cookies.get(AUTH_TOKEN_KEY)?.value;
  if (existingToken) {
    return NextResponse.next();
  }

  const cache = await redis.hgetall<{
    connected: string[];
    createdAt: number;
  }>(redisKey);

  if (!cache) {
    return NextResponse.redirect(new URL("/?error=room-not-found", req.url));
  }

  const connected = cache.connected;

  if (connected.length >= 2) {
    return NextResponse.redirect(new URL("/?error=room-full", req.url));
  }

  const response = NextResponse.next();
  const token = nanoid(15);
  connected.push(token);

  await redis.hset(redisKey, {
    connected,
  });

  response.cookies.set(AUTH_TOKEN_KEY, token, {
    path: "/",
    httpOnly: true,
    secure: Bun.env.NODE_ENV === "production",
    sameSite: "strict",
  });

  return response;
};

export const config = {
  matcher: ["/room/:path*", "/((?!_next/static|_next/image|favicon.ico).*)"],
};
