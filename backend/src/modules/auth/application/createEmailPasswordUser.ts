import { auth } from "../infrastructure/betterAuth";

/** Existing administrative user-creation operation, isolated from application services. */
export function createEmailPasswordUser(data: {
  email: string;
  password: string;
  name: string;
}) {
  return auth.api.signUpEmail({ body: data });
}
