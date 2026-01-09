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
  baseURL: "http://localhost:3000/api/auth",
  trustedOrigins: ["http://localhost:5173"],

  emailAndPassword: {
    enabled: true,
  },

  plugins: [
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        const { data, error } = await resend.emails.send({
          from: "Sisukas <auth@sisukas.eu>",
          to: [email],
          subject: "Sign in to your account",
          html: `
            <p>Click the link below to sign in:</p>
            <a href="${url}">Verify Email & Sign In</a>
            <p>This link will expire in 1 hour.</p>
          `,
        });

        if (error) {
          console.error("Resend error:", error);
          throw new Error("Failed to send magic link email");
        }
      }
    })
  ]
});

console.log('Auth initialized:', typeof auth, typeof auth.handler);