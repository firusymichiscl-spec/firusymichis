"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase";

export default function PetPhotoUpload({ pet, onUpdate }) {
  const supabase = createClient();
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(pet.photo_url || null);

  const uploadPhoto = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Preview inmediato
    const localUrl = URL.createObjectURL(file);
    setPreview(localUrl);
    setUploading(true);

    try {
      const ext = file.name.split(".").pop();
      const path = `${pet.id}/avatar.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("pet-photos")
        .upload(path, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("pet-photos")
        .getPublicUrl(path);

      await supabase
        .from("pets")
        .update({ photo_url: publicUrl })
        .eq("id", pet.id);

      onUpdate?.(publicUrl);
    } catch (err) {
      console.error("Error subiendo foto:", err);
    }

    setUploading(false);
  };

  return (
    <label style={{ cursor: "pointer", position: "relative", display: "block" }}>
      <input
        type="file"
        accept="image/*"
        onChange={uploadPhoto}
        style={{ display: "none" }}
      />
      <div style={{
        width: 68, height: 68,
        borderRadius: "50%",
        background: preview ? "transparent" : "linear-gradient(135deg, #FFD166, #FF8C5A)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 34,
        boxShadow: "0 6px 20px rgba(0,0,0,0.2), 0 0 0 3px rgba(255,255,255,0.3)",
        overflow: "hidden",
        position: "relative",
      }}>
        {preview ? (
          <img src={preview} alt={pet.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          pet.species === "cat" ? "🐱" : pet.species === "other" ? "🐰" : "🐶"
        )}
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0,
          background: "rgba(0,0,0,0.45)",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: "4px 0",
          fontSize: 11,
        }}>
          {uploading ? "⏳" : "📷"}
        </div>
      </div>
    </label>
  );
}