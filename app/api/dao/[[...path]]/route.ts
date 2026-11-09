import { handleDao } from "@/lib/dao/api";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ path?: string[] }> };
const run = async (req: Request, { params }: Ctx) => handleDao(req, (await params).path ?? []);

export const GET = run;
export const POST = run;
export const PATCH = run;
