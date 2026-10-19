import { NextResponse } from "next/server";
import { runDue } from "@/lib/scheduler";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** "Run scheduler now" button: publishes everything ready and due, same as the cron job. */
export async function POST() {
  return NextResponse.json(await runDue("manual"));
}
