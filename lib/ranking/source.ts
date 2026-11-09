/**
 * Data-source boundary. The ranking service only talks to a RankingSource,
 * so switching from demo data to the production database means providing a
 * new implementation here, not touching the engine or the UI.
 */
import type { EventActivity, FxRate, RankableEvent } from "./types";

export interface RankingSource {
  mode: "demo" | "production";
  /** The instant rankings are computed for. */
  asOf: () => number;
  fx: () => FxRate[];
  events: () => Promise<RankableEvent[]>;
  activity: (eventId: string) => Promise<EventActivity | null>;
}

export class DataSourceNotConfigured extends Error {
  code = "DATA_SOURCE_NOT_CONFIGURED" as const;
  constructor() {
    super("Production ranking data source is not configured. Set DATABASE_URL and implement productionSource (lib/ranking/source.ts).");
  }
}

/**
 * Production source placeholder. It never falls back to demo data, so
 * fictional events can't leak into a production ranking.
 */
export const productionSource: RankingSource = {
  mode: "production",
  asOf: () => Date.now(),
  fx: () => {
    throw new DataSourceNotConfigured();
  },
  events: async () => {
    throw new DataSourceNotConfigured();
  },
  activity: async () => {
    throw new DataSourceNotConfigured();
  },
};

/** RANKING_DATA_MODE=production switches to the real source (default: demo). */
export async function getSource(): Promise<RankingSource> {
  if (process.env.RANKING_DATA_MODE === "production") return productionSource;
  const { demoSource } = await import("./demo-source");
  return demoSource;
}
