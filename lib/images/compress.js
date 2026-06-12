const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 10 * 1024 * 1024;

/**
 * Compresses an image client-side using canvas.
 * Resizes so the longest side is at most maxDim, exports as JPEG.
 * @returns {{ blob: Blob, mediaType: "image/jpeg" }}
 */
export async function compressImage(file, opts = {}) {
  const { maxDim = 1600, quality = 0.8 } = opts;

  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error("Formato no soportado. Usa JPG, PNG o WebP.");
  }
  if (file.size > MAX_BYTES) {
    throw new Error("La foto pesa demasiado. Intenta con una más liviana.");
  }

  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = url;
    });

    const { naturalWidth: w, naturalHeight: h } = img;
    const scale = w > maxDim || h > maxDim ? maxDim / Math.max(w, h) : 1;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise((res) => canvas.toBlob(res, "image/jpeg", quality));
    return { blob, mediaType: "image/jpeg" };
  } finally {
    URL.revokeObjectURL(url);
  }
}
