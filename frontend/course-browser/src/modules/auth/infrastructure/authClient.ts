import { magicLinkClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/svelte";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

export const authClient = createAuthClient({
  baseURL: `${BACKEND_URL}`,
  fetchOptions: {
    credentials: "include",
  },
  plugins: [
    magicLinkClient()
  ]
});

export const { signIn, signUp, signOut, useSession } = authClient;