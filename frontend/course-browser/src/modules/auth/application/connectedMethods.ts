import { authClient } from "../infrastructure/authClient";

export interface ConnectedMethods {
  googleConnected: boolean;
}

/** Provider associations are distinct from the availability of email magic links. */
export function summarizeConnectedMethods(
  accounts: readonly { providerId: string }[],
): ConnectedMethods {
  return {
    googleConnected: accounts.some((account) => account.providerId === "google"),
  };
}

export async function getConnectedMethods(): Promise<ConnectedMethods> {
  const { data, error } = await authClient.listAccounts();

  if (error || !data) {
    throw new Error("Could not load connected sign-in methods.");
  }

  return summarizeConnectedMethods(data);
}
