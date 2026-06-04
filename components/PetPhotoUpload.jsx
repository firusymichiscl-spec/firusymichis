"use client";

import { useState, useRef } from "react";
import { createClient } from "@/lib/supabase";

export default function PetPhotoUpload({ pet, onUpdate, avatarEmoji }) {
  const supabase = createClient();
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(pet.photo_url || null);
  const [cropping, setCropping] = useState(false);
  const [imgSrc, setImgSrc] = useState(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const canvasRef = useRef();
  const imgRef = useRef();
  const fileRef = useRef();

  const SIZE = 90;

  const onFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setImgSrc(ev.target.result);
      setPosition({ x: 0, y: 0 });
      setScale(1);
      setCropping(true);
    };
    reader.readAsDataURL(file);
  };

  const onMouseDown = (e) => {
    setDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };
  const onMouseMove = (e) => {
    if (!dragging) return;
    setPosition({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };
  const onMouseUp = () => setDragging(false);

  const onTouchStart = (e) => {
    const t = e.touches[0];
    setDragging(true);
    setDragStart({ x: t.clientX - position.x, y: t.clientY - position.y });
  };
  const onTouchMove = (e) => {
    if (!dragging) return;
    const t = e.touches[0];
    setPosition({ x: t.clientX - dragStart.x, y: t.clientY - dragStart.y });
  };

  const cropAndUpload = async () => {
    setUploading(true);
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const img = imgRef.current;
    canvas.width = SIZE * 2;
    canvas.height = SIZE * 2;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.beginPath();
    ctx.arc(SIZE, SIZE, SIZE, 0, Math.PI * 2);
    ctx.clip();

    const naturalW = img.naturalWidth;
    const naturalH = img.naturalHeight;
    const displaySize = SIZE * 2;
    const baseScale = displaySize / Math.min(naturalW, naturalH);
    const totalScale = baseScale * scale;

    const drawW = naturalW * totalScale;
    const drawH = naturalH * totalScale;
    const offsetX = SIZE + position.x * 2 - drawW / 2;
    const offsetY = SIZE + position.y * 2 - drawH / 2;

    ctx.drawImage(img, offsetX, offsetY, drawW, drawH);
    ctx.restore();

    canvas.toBlob(async (blob) => {
      const path = `${pet.id}/avatar.jpg`;
      const { error } = await supabase.storage
        .from("pet-photos")
        .upload(path, blob, { upsert: true, contentType: "image/jpeg" });

      if (!error) {
        const { data: { publicUrl } } = supabase.storage
          .from("pet-photos")
          .getPublicUrl(path);
        const urlWithTs = `${publicUrl}?t=${Date.now()}`;
        await supabase.from("pets").update({ photo_url: urlWithTs }).eq("id", pet.id);
        setPreview(urlWithTs);
        onUpdate?.(urlWithTs);
      }
      setCropping(false);
      setUploading(false);
    }, "image/jpeg", 0.9);
  };

  const speciesIcon = avatarEmoji || (pet.species === "cat" ? "🐱" : pet.species === "other" ? "🐰" : "🐶");

  return (
    <>
      <canvas ref={canvasRef} style={{ display: "none" }} />
      {imgSrc && <img ref={imgRef} src={imgSrc} style={{ display: "none" }} alt="crop-src" />}

      {/* MODAL DE RECORTE */}
      {cropping && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 1000, flexDirection: "column", gap: 16,
        }}>
          <div style={{ color: "#fff", fontFamily: "'Baloo 2', cursive", fontSize: 16, fontWeight: 800 }}>
            Centra la foto de {pet.name}
          </div>

          {/* ÁREA DE RECORTE */}
          <div style={{
            width: 240, height: 240, borderRadius: "50%",
            overflow: "hidden", border: "3px solid #FF6B35",
            position: "relative", cursor: dragging ? "grabbing" : "grab",
            background: "#000", flexShrink: 0,
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.7)",
          }}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onMouseUp}
          >
            {imgSrc && (
              <img src={imgSrc} alt="preview"
                style={{
                  position: "absolute",
                  width: `${scale * 100}%`,
                  height: `${scale * 100}%`,
                  objectFit: "cover",
                  left: "50%", top: "50%",
                  transform: `translate(calc(-50% + ${position.x}px), calc(-50% + ${position.y}px))`,
                  userSelect: "none",
                  pointerEvents: "none",
                  maxWidth: "none",
                }}
              />
            )}
          </div>

          {/* ZOOM */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ color: "#fff", fontSize: 12 }}>🔍</span>
            <input type="range" min="0.5" max="3" step="0.05" value={scale}
              onChange={e => setScale(parseFloat(e.target.value))}
              style={{ width: 160, accentColor: "#FF6B35" }} />
            <span style={{ color: "#fff", fontSize: 12 }}>🔎</span>
          </div>

          <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 11 }}>
            Arrastra para centrar · desliza para zoom
          </div>

          {/* BOTONES */}
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => setCropping(false)} style={{
              padding: "10px 20px", borderRadius: 12, background: "rgba(255,255,255,0.15)",
              color: "#fff", border: "1px solid rgba(255,255,255,0.3)",
              fontFamily: "'Baloo 2', cursive", fontSize: 14, fontWeight: 700, cursor: "pointer",
            }}>Cancelar</button>
            <button onClick={cropAndUpload} disabled={uploading} style={{
              padding: "10px 24px", borderRadius: 12, background: "#FF6B35",
              color: "#fff", border: "none",
              fontFamily: "'Baloo 2', cursive", fontSize: 14, fontWeight: 700, cursor: "pointer",
            }}>{uploading ? "Guardando..." : "✓ Guardar foto"}</button>
          </div>
        </div>
      )}

      {/* AVATAR */}
      <label style={{ cursor: "pointer", position: "relative", display: "block", width: "fit-content" }}>
        <input ref={fileRef} type="file" accept="image/*" onChange={onFile} style={{ display: "none" }} />
        <div style={{
          width: 84, height: 84,
          borderRadius: "50%",
          background: preview ? "transparent" : "linear-gradient(135deg, #FFD166, #FF8C5A)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 38,
          boxShadow: "0 6px 20px rgba(0,0,0,0.2), 0 0 0 3px rgba(255,255,255,0.3)",
          overflow: "hidden",
          position: "relative",
          flexShrink: 0,
        }}>
          {preview ? (
            <img src={preview} alt={pet.name}
              style={{ 
                width: "100%", 
                height: "100%", 
                objectFit: "cover",
                borderRadius: "50%",
                display: "block",
              }} />
            ) : (
            <span>{speciesIcon}</span>
              )}
          <div style={{
            position: "absolute", bottom: 0, left: 0, right: 0,
            background: "rgba(0,0,0,0.4)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "5px 0", fontSize: 13,
          }}>
            {uploading ? "⏳" : "📷"}
          </div>
        </div>
      </label>
    </>
  );
}
