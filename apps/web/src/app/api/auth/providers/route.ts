import { publicRoute } from "@/lib/api";

export const GET = publicRoute(async () => ({
  google: !!process.env.GOOGLE_CLIENT_ID,
  x: !!process.env.X_CLIENT_ID,
}));
