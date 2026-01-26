// src/lib/auth.ts
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "../db";
import * as schema from "../db/schema";
import { magicLink } from "better-auth/plugins";
import { Resend } from "resend";

const isDev = process.env.NODE_ENV === "development";

function looksLikeResendKey(key: string | undefined): boolean {
  if (!key) return false;
  const trimmed = key.trim();

  if (
    trimmed.length === 0 ||
    trimmed === "changeme" ||
    trimmed === "your_key_here" ||
    trimmed === "your_resend_api_key"
  ) {
    return false;
  }

  // Resend keys are commonly "re_...." (keep loose)
  return /^re_[A-Za-z0-9_]+$/.test(trimmed);
}

const resendApiKey = process.env.RESEND_API_KEY?.trim();
const resend = looksLikeResendKey(resendApiKey) ? new Resend(resendApiKey) : null;

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
    "https://api.test.sisukas.eu",
  ],

  emailAndPassword: {
    enabled: true,
  },

  plugins: [
    magicLink({
      sendMagicLink: async ({ email, token, url }) => {
        const frontendVerifyUrl = `${process.env.FRONTEND_URL}/auth/verify?token=${token}`;

        // Local dev / contributor mode: no valid key => print link and don't fail.
        if (!resend) {
          console.warn(
            "[auth] RESEND_API_KEY missing/invalid; printing magic link instead of emailing."
          );
          console.log(`[auth] Magic link for ${email}: ${frontendVerifyUrl}`);
          return;
        }

        try {
          const { error } = await resend.emails.send({
            from: "Sisukas <auth@sisukas.eu>",
            to: [email],
            subject: "Sign in to Sisukas",
            html: `
              <p>Click the link below to sign in:</p>
              <a href="${frontendVerifyUrl}">Verify Email & Sign In</a>
            `,
          });

          if (error) {
            // If the key is wrong / unauthorized, treat as dev-friendly fallback.
            const status = (error as any)?.statusCode ?? (error as any)?.status;
            const message = String((error as any)?.message ?? "");

            const isLikelyAuthIssue =
              status === 401 ||
              status === 403 ||
              /unauthorized|forbidden|api key|invalid/i.test(message);

            if (isDev && isLikelyAuthIssue) {
              console.warn(
                "[auth] Resend not authorized (likely invalid API key); printing magic link instead."
              );
              console.warn("[auth] Resend error:", error);
              console.log(`[auth] Magic link for ${email}: ${frontendVerifyUrl}`);
              return;
            }

            console.error("[auth] Resend error:", error);

            // In dev, any send failure should be non-blocking.
            if (isDev) {
              console.warn(
                "[auth] Email send failed; printing magic link instead (dev mode)."
              );
              console.log(`[auth] Magic link for ${email}: ${frontendVerifyUrl}`);
              return;
            }

            throw new Error("Failed to send magic link email");
          }
        } catch (err) {
          console.error("[auth] Resend exception:", err);

          if (isDev) {
            console.warn(
              "[auth] Resend threw; printing magic link instead (dev mode)."
            );
            console.log(`[auth] Magic link for ${email}: ${frontendVerifyUrl}`);
            return;
          }

          throw new Error("Failed to send magic link email");
        }
      },
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

console.log("Auth initialized:", typeof auth, typeof auth.handler);
