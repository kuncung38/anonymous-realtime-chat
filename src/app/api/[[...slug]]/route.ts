import { Elysia, NotFoundError, t } from "elysia";
import { type Message, realtime } from "@/lib/realtime";
import { redis } from "@/lib/redis";
import {
  AUTH_TOKEN_KEY,
  MESSAGES_PREFIX,
  ROOM_PREFIX,
  ROOM_TTL,
} from "@/utils/const";
import { nanoid } from "@/utils/generate";

import { authMiddleware } from "./auth";

// Define Zod schemas
const roomIdSchema = t.String();
const messageSchema = t.Object({
  sender: t.String({ maxLength: 100 }),
  text: t.String({ maxLength: 1000 }),
});

const rooms = new Elysia({ prefix: "/room" })
  .get(
    "/",
    async ({ query, cookie }) => {
      const { roomId } = query;
      const redisKey = `${ROOM_PREFIX}:${roomId}`;

      const existingToken = cookie[AUTH_TOKEN_KEY]?.value as string | undefined;

      const cache = await redis.hgetall<{
        connected: string[];
        createdAt: number;
      }>(redisKey);

      if (!cache) {
        throw new NotFoundError("room-not-found");
      }

      const connected = cache.connected ?? [];

      if (existingToken && connected.includes(existingToken)) {
        return { success: true, token: existingToken };
      }

      if (connected.length >= 2) {
        throw new Error("room-full");
      }

      const token = nanoid(15);
      const updatedConnected = [...connected, token];

      await redis.hset(redisKey, {
        connected: updatedConnected,
      });

      // Set cookie in response
      cookie[AUTH_TOKEN_KEY].set({
        value: token,
        path: "/",
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
      });

      return { success: true, token };
    },
    {
      query: t.Object({
        roomId: t.String(),
      }),
      error: ({ error, set }) => {
        if (error instanceof NotFoundError) {
          set.status = 404;
          return { error: "room-not-found" };
        }
        if (error instanceof Error && error.message === "room-busy") {
          set.status = 429;
          return { error: "room-busy" };
        }
        if (error instanceof Error && error.message === "room-full") {
          set.status = 403;
          return { error: "room-full" };
        }
        set.status = 500;
        return { error: "internal-error" };
      },
    },
  )
  .post(
    "/",
    async ({ cookie }) => {
      const roomId = nanoid(15);
      const key = `${ROOM_PREFIX}:${roomId}`;
      const creatorToken = nanoid(15);

      await redis.hset(key, {
        connected: [creatorToken],
        createdAt: Date.now(),
      });
      await redis.expire(key, ROOM_TTL);

      // Set creator token in cookie (overwrite any existing token)
      cookie[AUTH_TOKEN_KEY]?.set({
        value: creatorToken,
        path: "/",
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
      });

      return { roomId };
    },
    {
      response: {
        200: t.Object({
          roomId: t.String(),
        }),
      },
    },
  )
  .use(authMiddleware)
  .get(
    "/ttl",
    async ({ query }) => {
      const { roomId } = query;
      const key = `${ROOM_PREFIX}:${roomId}`;
      const ttl = await redis.ttl(key);
      return { ttl: ttl > 0 ? ttl : 0 };
    },
    {
      query: t.Object({
        roomId: t.String(),
      }),
    },
  )
  .delete(
    "/",
    async ({ query }) => {
      const { roomId } = query;
      await realtime
        .channel(roomId)
        .emit("chat.destroy", { isDestroyed: true });

      redis.del(`${ROOM_PREFIX}:${roomId}`);
      redis.del(`${MESSAGES_PREFIX}:${roomId}`);
      redis.del(roomId);

      return { success: true };
    },
    {
      query: t.Object({
        roomId: t.String(),
      }),
    },
  );

const messages = new Elysia({ prefix: "/messages" })
  .use(authMiddleware)
  .post(
    "/",
    async ({ auth, body, query }) => {
      const { roomId } = query;
      const { sender, text } = body;

      const roomKey = `${ROOM_PREFIX}:${roomId}`;

      const remaining = await redis.ttl(roomKey);
      if (remaining <= 0) throw new NotFoundError("Room not found");

      const message: Message = {
        id: nanoid(),
        sender,
        text,
        timestamp: Date.now(),
        roomId,
      };

      const messageKey = `${MESSAGES_PREFIX}:${roomId}`;
      await redis.rpush(messageKey, {
        ...message,
        token: auth.token,
      });

      void realtime.channel(roomId).emit("chat.message", message);

      redis.expire(messageKey, remaining);
      redis.expire(roomKey, remaining);
      redis.expire(roomId, remaining);
    },
    {
      query: t.Object({
        roomId: roomIdSchema,
      }),
      body: messageSchema,
      error: ({ error, set }) => {
        if (error instanceof NotFoundError) {
          set.status = 404;
          return { error: "Room not found" };
        }
        if (
          error instanceof Error &&
          (error.message === "No token provided" ||
            error.message === "Invalid token")
        ) {
          set.status = 401;
          return { error: "Unauthorized" };
        }
        set.status = 500;
        return { error: "Internal error" };
      },
    },
  )
  .get(
    "/",
    async ({ auth, query }) => {
      const messagesKey = `${MESSAGES_PREFIX}:${query.roomId}`;
      const messages = await redis.lrange<Message>(messagesKey, 0, -1);

      return {
        messages: messages.map((m) => ({
          ...m,
          token: m.token === auth.token ? auth.token : undefined,
        })),
      };
    },
    {
      query: t.Object({ roomId: t.String() }),
      error: ({ error, set }) => {
        if (error instanceof NotFoundError) {
          set.status = 404;
          return { error: "Room not found" };
        }
        if (
          error instanceof Error &&
          (error.message === "No token provided" ||
            error.message === "Invalid token")
        ) {
          set.status = 401;
          return { error: "Unauthorized" };
        }
        set.status = 500;
        return { error: "Internal error" };
      },
    },
  );

const app = new Elysia({ prefix: "/api" }).use(rooms).use(messages);

export type App = typeof app;

export const DELETE = app.fetch;
export const GET = app.fetch;
export const POST = app.fetch;
