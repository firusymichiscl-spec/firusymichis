import { NextResponse } from "next/server";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") || "";
  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");
  const radius = searchParams.get("radius") || 3000;
  const openNow = searchParams.get("open_now") === "true";
  const key = process.env.GOOGLE_PLACES_SERVER_KEY;

  let url;
  if (lat && lng) {
    url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radius}&type=veterinary_care&keyword=${encodeURIComponent(q)}&key=${key}${openNow ? "&opennow=true" : ""}`;
  } else {
    url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=veterinaria+${encodeURIComponent(q)}&region=cl&language=es&locationbias=circle:500000@-33.4489,-70.6693&key=${key}`;
  }

  const res = await fetch(url);
  const data = await res.json();
  return NextResponse.json({ results: data.results || [] });
}
