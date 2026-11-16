/** Better Auth composition root. Add providers here; keep domain logic independent. */
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "../../../db";
import * as schema from "../../../db/schema";
import { magicLink } from "better-auth/plugins";
import { accountLinkingPolicy } from "../config/accountLinkingPolicy";
import { configuredSocialProviders } from "../config/socialProviders";
import { trustedAuthOrigins } from "../config/trustedOrigins";
import { sendMagicLink } from "./sendMagicLink";

const isDev = process.env.NODE_ENV === "development";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      ...schema,
      user: schema.users,
    },
  }),
  baseURL: `${process.env.BACKEND_URL}/api/auth`,
  trustedOrigins: [...trustedAuthOrigins],

  account: {
    accountLinking: accountLinkingPolicy,
  },

  socialProviders: configuredSocialProviders(),

  emailAndPassword: {
    enabled: true,
  },

  plugins: [
    magicLink({
      sendMagicLink,
    }),
  ],

  advanced: {
    defaultCookieAttributes: {
      httpOnly: true,
      ...(isDev && {
        secure: true,
        sameSite: "none",
      }),
    },
  },
});


