import { publicRoute } from "@/lib/api";
import { publicUser } from "@/lib/auth";

export const GET = publicRoute(async ({ user }) => ({ user: user ? publicUser(user) : null }), { cors: true });
export { preflight as OPTIONS } from "@/lib/api";
