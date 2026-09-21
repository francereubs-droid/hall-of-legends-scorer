import type { Context, Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";

interface GameEntry {
  playerId: string | null;
  playerName: string;
  wonder: string;
  scores: Record<string, number>;
  total: number;
}

interface Game {
  id: string;
  ts: string;
  playerCount: number;
  entries: GameEntry[];
  winnerName: string;
}

function store() {
  return getStore("hall-of-legends");
}

export default async (req: Request, context: Context) => {
  const store_ = store();

  if (req.method === "GET") {
    const games = (await store_.get("games", { type: "json" })) as Game[] | null;
    return Response.json(games ?? []);
  }

  if (req.method === "POST") {
    const body = await req.json().catch(() => ({}));
    const entries = Array.isArray(body.entries) ? body.entries : [];
    if (entries.length === 0) {
      return Response.json({ error: "At least one player entry is required." }, { status: 400 });
    }

    const cleanEntries: GameEntry[] = entries.map((e: any) => {
      const scores: Record<string, number> = {};
      const rawScores = e.scores && typeof e.scores === "object" ? e.scores : {};
      for (const [k, v] of Object.entries(rawScores)) {
        const n = Number(v);
        scores[k] = Number.isFinite(n) ? n : 0;
      }
      const total = Object.values(scores).reduce((a, b) => a + b, 0);
      return {
        playerId: typeof e.playerId === "string" ? e.playerId : null,
        playerName: typeof e.playerName === "string" && e.playerName.trim() ? e.playerName.trim() : "Player",
        wonder: typeof e.wonder === "string" ? e.wonder : "",
        scores,
        total,
      };
    });

    let winner = cleanEntries[0];
    for (const e of cleanEntries) {
      if (
        e.total > winner.total ||
        (e.total === winner.total && (e.scores.treasury ?? 0) > (winner.scores.treasury ?? 0))
      ) {
        winner = e;
      }
    }

    const game: Game = {
      id: crypto.randomUUID(),
      ts: new Date().toISOString(),
      playerCount: cleanEntries.length,
      entries: cleanEntries,
      winnerName: winner.playerName,
    };

    const games = ((await store_.get("games", { type: "json" })) as Game[] | null) ?? [];
    games.push(game);
    await store_.setJSON("games", games);
    return Response.json(game, { status: 201 });
  }

  if (req.method === "DELETE") {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) {
      return Response.json({ error: "id is required" }, { status: 400 });
    }
    const games = ((await store_.get("games", { type: "json" })) as Game[] | null) ?? [];
    const next = games.filter((g) => g.id !== id);
    await store_.setJSON("games", next);
    return Response.json({ ok: true });
  }

  return new Response("Method not allowed", { status: 405 });
};

export const config: Config = {
  path: "/api/games",
};
