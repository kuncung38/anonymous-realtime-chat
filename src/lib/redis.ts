import { Redis } from "@upstash/redis";

export const redis = new Redis({
  url: Bun.env.UPSTASH_REDIS_REST_URL,
  token: Bun.env.UPSTASH_REDIS_REST_TOKEN,
});
