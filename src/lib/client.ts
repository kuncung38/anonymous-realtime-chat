import { treaty } from "@elysiajs/eden";
import type { App } from "@/app/api/[[...slug]]/route";
import { getBaseUrl } from "./utils";

export const client = treaty<App>(getBaseUrl()).api;
