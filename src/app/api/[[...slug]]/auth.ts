import Elysia from "elysia";
import { redis } from "@/lib/redis";
import { AUTH_TOKEN_KEY, ROOM_PREFIX } from "@/utils/const";

class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

export const authMiddleware = new Elysia({ name: "auth" })
  .error({ AuthError })
  .onError(({ code, set }) => {
    if (code === "AuthError") {
      set.status = 401;
      return { error: "Unauthorized" };
    }
  })
  .derive({ as: "scoped" }, async ({ query, cookie }) => {
    const roomId = query.roomId;
    const token = cookie[AUTH_TOKEN_KEY].value as string | undefined;

    if (!token) {
      throw new AuthError("No token provided");
    }
    if (!roomId) {
      throw new AuthError("No room id provided");
    }

    const redisKey = `${ROOM_PREFIX}${roomId}`;
    const connected = (await redis.hget(redisKey, "connected")) as string;

    if (connected && !JSON.parse(connected).includes(token)) {
      throw new AuthError("Invalid token");
    }

    return {
      auth: {
        roomId,
        token,
        connected: JSON.parse(connected) as string[],
      },
    };
  });
