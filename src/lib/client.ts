import { treaty } from "@elysiajs/eden";
import type { app } from "@/app/api/[[...slug]]/route";
import { getBaseUrl } from "./utils";

export const client = treaty<typeof app>(getBaseUrl()).api;
