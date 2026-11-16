import { toNodeHandler } from "better-auth/node";

import { auth } from "./betterAuth";

/** HTTP adapter for Better Auth; routing code does not depend on Better Auth internals. */
export const authHttpHandler = toNodeHandler(auth);
