import { NextRequest, NextResponse } from "next/server";

const ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY;

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("q") || "book cover";
  const page = req.nextUrl.searchParams.get("page") || "1";

  if (!ACCESS_KEY) {
    return NextResponse.json({ error: "Unsplash key not configured" }, { status: 503 });
  }

  const url =
    `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=12&page=${page}` +
    `&orientation=portrait&client_id=${ACCESS_KEY}`;

  const res = await fetch(url, { next: { revalidate: 300 } });
  if (!res.ok) return NextResponse.json({ error: "Unsplash error" }, { status: 502 });

  const data = await res.json();
  const photos = (data.results ?? []).map((p: any) => ({
    id: p.id,
    thumb: p.urls.small,
    regular: p.urls.regular,
    full: p.urls.full,
    authorName: p.user.name,
    authorLink: p.user.links.html,
  }));

  return NextResponse.json({ photos, total: data.total });
}
