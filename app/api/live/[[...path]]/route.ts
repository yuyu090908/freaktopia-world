import { handleLive } from "@/lib/live/api";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ path?: string[] }> };
const run = async (req: Request, { params }: Ctx) => handleLive(req, (await params).path ?? []);

export const GET = run;
export const POST = run;
