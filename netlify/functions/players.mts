import type { Context, Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";

interface Player {
  id: string;
  name: string;
}

function store() {
  return getStore("hall-of-legends");
}

export default async (req: Request, context: Context) => {
  const store_ = store();

  if (req.method === "GET") {
    const players = (await store_.get("players", { type: "json" })) as Player[] | null;
    return Response.json(players ?? []);
  }

  if (req.method === "POST") {
    const body = await req.json().catch(() => ({}));
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) {
      return Response.json({ error: "A player name is required." }, { status: 400 });
    }
    const players = ((await store_.get("players", { type: "json" })) as Player[] | null) ?? [];
    const player: Player = { id: crypto.randomUUID(), name };
    players.push(player);
    await store_.setJSON("players", players);
    return Response.json(player, { status: 201 });
  }

  if (req.method === "DELETE") {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) {
      return Response.json({ error: "id is required" }, { status: 400 });
    }
    const players = ((await store_.get("players", { type: "json" })) as Player[] | null) ?? [];
    const next = players.filter((p) => p.id !== id);
    await store_.setJSON("players", next);
    return Response.json({ ok: true });
  }

  return new Response("Method not allowed", { status: 405 });
};

export const config: Config = {
  path: "/api/players",
};
