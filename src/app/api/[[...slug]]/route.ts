import { Elysia, NotFoundError, t } from "elysia";
import { type Message, realtime } from "@/lib/realtime";
import { redis } from "@/lib/redis";
import { MESSAGES_PREFIX, ROOM_PREFIX, ROOM_TTL } from "@/utils/const";
import { nanoid } from "@/utils/generate";
import { authMiddleware } from "./auth";

// Define Zod schemas
const roomIdSchema = t.String();
const messageSchema = t.Object({
  sender: t.String({ maxLength: 100 }),
  text: t.String({ maxLength: 1000 }),
});

const rooms = new Elysia({ prefix: "/room" })
  .post(
    "/",
    async () => {
      const roomId = nanoid(15);
      const key = `${ROOM_PREFIX}:${roomId}`;
      await redis.hset(key, {
        connected: [],
        createdAt: Date.now(),
      });
      await redis.expire(key, ROOM_TTL);

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
      await Promise.all([
        redis.del(roomId),
        redis.del(`${ROOM_PREFIX}:${roomId}`),
        redis.del(`${MESSAGES_PREFIX}:${roomId}`),
      ]);

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
      const roomExists = await redis.exists(roomKey);
      if (!roomExists) throw new NotFoundError("Room not found");

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

      await realtime.channel(roomId).emit("chat.message", message);

      const remaining = await redis.ttl(roomKey);
      await redis.expire(messageKey, remaining);
      await redis.expire(roomId, remaining);
    },
    {
      query: t.Object({
        roomId: roomIdSchema,
      }),
      body: messageSchema,
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
    },
  );

const app = new Elysia({ prefix: "/api" }).use(rooms).use(messages);

export type App = typeof app;

export const GET = app.fetch;
export const POST = app.fetch;
export const DELETE = app.fetch;
