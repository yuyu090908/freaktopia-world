import { handleMap } from "@/lib/map/api";

export const dynamic = "force-dynamic";

export async function GET() {
  return handleMap();
}
