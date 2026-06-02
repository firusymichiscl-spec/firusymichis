export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q");
  if (!q || q.length < 2) return Response.json({ results: [] });

  const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=veterinaria+${encodeURIComponent(q)}&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    return Response.json({ results: data.results?.slice(0, 5) || [] });
  } catch {
    return Response.json({ results: [] });
  }
}
