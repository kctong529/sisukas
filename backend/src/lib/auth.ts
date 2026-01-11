// src/lib/auth.ts
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "../db";
import * as schema from "../db/schema";
import { magicLink } from "better-auth/plugins";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      ...schema,
      user: schema.users,
    },
  }),
  baseURL: `${process.env.BACKEND_URL}/api/auth`,
  trustedOrigins: [
    "http://localhost:5173",
    "https://localhost:5173",
    "https://sisukas-test.fly.dev",
    "https://sisukas.eu",
    "https://test.sisukas.eu",
    "https://api.sisukas.eu",
    "https://api.test.sisukas.eu"
  ],

  emailAndPassword: {
    enabled: true,
  },

  plugins: [
    magicLink({
      sendMagicLink: async ({ email, token, url }) => {
        const frontendVerifyUrl = `${process.env.FRONTEND_URL}/auth/verify?token=${token}`;
        const { data, error } = await resend.emails.send({
          from: "Sisukas <auth@sisukas.eu>",
          to: [email],
          subject: "Sign in to Sisukas",
          html: `
            <p>Click the link below to sign in:</p>
            <a href="${frontendVerifyUrl}">Verify Email & Sign In</a>
          `
        });

        if (error) {
          console.error("Resend error:", error);
          throw new Error("Failed to send magic link email");
        }
      }
    })
  ],

  advanced: {
    defaultCookieAttributes: {
      httpOnly: true
    }
  }
});

console.log('Auth initialized:', typeof auth, typeof auth.handler);