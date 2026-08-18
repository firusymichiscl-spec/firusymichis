// scripts/migrate-storage-privacidad.mjs
//
// Migra archivos existentes de los buckets públicos (pet-photos,
// marketplace) a los buckets privados nuevos (pet-photos-medical,
// marketplace-receipts) — paso 3 del plan de privacidad de fotos médicas
// y boletas de marketplace (Lote P).
//
// Extensión .mjs a propósito: el proyecto no tiene "type": "module" en
// package.json (todo el resto del código es CommonJS/Next), y el preset de
// ESLint de Next prohíbe require() incluso en scripts sueltos. En vez de
// tocar la config de ESLint del proyecto para un script de uso puntual,
// esto queda como ES module aparte — Node lo trata como tal por la
// extensión, sin depender de la config de package.json.
//
// Requiere que ya se hayan aplicado:
//   - supabase/migrations/20260817_storage_privacidad_fotos.sql (buckets + policies)
//   - supabase/migrations/20260817_photo_path_columns.sql (columnas photo_path/receipt_path)
//
// NO requiere el DROP POLICY de
// supabase/migrations/20260817_storage_cerrar_listado_DESPUES_DE_MIGRAR.sql
// — este script usa el service_role, que bypasea RLS igual que ya hace el
// resto del backend (app/ficha/[token]/page.jsx, app/api/ficha-pdf/...).
//
// Uso (PowerShell, desde la raíz del proyecto):
//   node scripts/migrate-storage-privacidad.mjs --orphans   # auditoría de huérfanos, no muta nada
//   node scripts/migrate-storage-privacidad.mjs --audit     # dry-run de la migración, no muta nada (default)
//   node scripts/migrate-storage-privacidad.mjs --run       # migra de verdad
//
// Variables de entorno requeridas (las mismas que usa el resto del
// backend — ver .env.example): NEXT_PUBLIC_SUPABASE_URL,
// SUPABASE_SERVICE_ROLE_KEY. Se leen de .env.local si existen ahí y no
// están ya en el entorno del proceso (sin agregar la dependencia
// "dotenv" — no es una dependencia de este proyecto, se parsea a mano).
//
// Idempotente: se puede volver a correr sin problema — solo procesa filas
// cuya columna nueva (photo_path / receipt_path) todavía está en null.
//
// Orden por objeto, NUNCA se invierte: descargar -> subir al bucket nuevo
// -> verificar tamaño -> actualizar la fila en la base -> recién ahí
// borrar el original. Si el proceso se corta a mitad de camino, el peor
// caso es un archivo duplicado (viejo público + nuevo privado) — nunca un
// hueco. Se corre en lotes de 50, con logging por fila.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnvLocal() {
  const envPath = path.join(__dirname, "..", ".env.local");
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, "utf8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}
loadEnvLocal();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (entorno o .env.local).");
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const BATCH_SIZE = 50;
const MODE = process.argv.includes("--run") ? "run"
  : process.argv.includes("--orphans") ? "orphans"
  : "audit"; // default: dry-run, no muta nada

function log(...args) {
  console.log("[migrate-storage]", ...args);
}

// Un public URL de Supabase Storage tiene la forma:
// https://xxx.supabase.co/storage/v1/object/public/{bucket}/{path}
// Devuelve solo {path}, o null si el URL no matchea ese patrón (revisar a
// mano — puede ser un dato corrupto o de otro origen).
function extractStoragePath(publicUrl, bucket) {
  if (!publicUrl) return null;
  const marker = `/object/public/${bucket}/`;
  const idx = publicUrl.indexOf(marker);
  if (idx === -1) return null;
  return decodeURIComponent(publicUrl.slice(idx + marker.length));
}

// ── Migración genérica: {table}.{legacyUrlCol} (bucket público) -> {destBucket}/{ownerIdField}/{file} ──
async function migratePrefix({ label, sourceBucket, destBucket, table, legacyUrlCol, newPathCol, ownerIdField }) {
  log(`\n=== ${label} [modo: ${MODE}] ===`);

  const { data: rows, error } = await supabase
    .from(table)
    .select(`id, ${ownerIdField}, ${legacyUrlCol}, ${newPathCol}`)
    .not(legacyUrlCol, "is", null)
    .is(newPathCol, null);

  if (error) {
    log(`ERROR leyendo ${table}:`, error.message);
    return;
  }
  log(`${rows.length} fila(s) con ${legacyUrlCol} legado pendientes de migrar.`);

  let migrated = 0, failed = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    log(`Lote ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(rows.length / BATCH_SIZE)} (${batch.length} filas)`);

    for (const row of batch) {
      const sourcePath = extractStoragePath(row[legacyUrlCol], sourceBucket);
      if (!sourcePath) {
        log(`  [${table}#${row.id}] no se pudo extraer la ruta desde "${row[legacyUrlCol]}" — se salta, revisar a mano.`);
        failed++;
        continue;
      }
      const fileName = sourcePath.split("/").pop();
      const destPath = `${row[ownerIdField]}/${fileName}`;

      if (MODE === "audit") {
        const folder = sourcePath.split("/").slice(0, -1).join("/");
        const { data: listing } = await supabase.storage.from(sourceBucket).list(folder || undefined);
        const existsOnDisk = listing?.some(f => f.name === fileName);
        log(`  [${table}#${row.id}] origen=${sourceBucket}/${sourcePath} destino=${destBucket}/${destPath}` +
          (existsOnDisk ? "" : "  *** ARCHIVO NO ENCONTRADO EN DISCO — se saltaría en --run ***"));
        continue;
      }

      // 1) descargar
      const { data: fileBlob, error: dlErr } = await supabase.storage.from(sourceBucket).download(sourcePath);
      if (dlErr) {
        log(`  [${table}#${row.id}] FALLÓ descarga de ${sourcePath}:`, dlErr.message);
        failed++;
        continue;
      }

      // 2) subir al bucket nuevo (upsert:true = idempotente si una corrida
      // anterior subió el archivo pero se cortó antes del update de fila)
      const { error: upErr } = await supabase.storage
        .from(destBucket)
        .upload(destPath, fileBlob, { contentType: fileBlob.type || "image/jpeg", upsert: true });
      if (upErr) {
        log(`  [${table}#${row.id}] FALLÓ subida a ${destBucket}/${destPath}:`, upErr.message);
        failed++;
        continue;
      }

      // 3) verificar tamaño antes de tocar nada más
      const { data: verifyList } = await supabase.storage.from(destBucket).list(String(row[ownerIdField]));
      const uploadedOk = verifyList?.some(f => f.name === fileName && f.metadata?.size === fileBlob.size);
      if (!uploadedOk) {
        log(`  [${table}#${row.id}] verificación de tamaño falló en destino — NO se borra el original, revisar a mano.`);
        failed++;
        continue;
      }

      // 4) recién ahora, actualizar la fila
      const { error: updErr } = await supabase.from(table).update({ [newPathCol]: destPath }).eq("id", row.id);
      if (updErr) {
        log(`  [${table}#${row.id}] subido y verificado pero FALLÓ el update de la fila:`, updErr.message,
          "— el archivo queda duplicado (original intacto) hasta reintentar.");
        failed++;
        continue;
      }

      // 5) recién ahora, borrar el original — nunca antes de confirmar 1-4
      const { error: rmErr } = await supabase.storage.from(sourceBucket).remove([sourcePath]);
      if (rmErr) {
        log(`  [${table}#${row.id}] migrada OK pero no se pudo borrar el original (queda duplicado, no es grave):`, rmErr.message);
      } else {
        log(`  [${table}#${row.id}] OK`);
      }
      migrated++;
    }
  }

  log(`${label}: migrados=${migrated} fallidos=${failed} (modo ${MODE})`);
}

// ── Auditoría de huérfanos: archivos en Storage sin ninguna fila que los referencie ──
// (hallazgo aparte: app/api/pets/eliminar/route.js no limpiaba Storage
// antes de este lote — ya resuelto para casos nuevos, ver step 5 del
// plan). Solo reporta, no borra nada nunca, ni siquiera en modo --run: un
// huérfano puede ser evidencia de un bug distinto y no vale la pena
// arriesgarse a destruir algo por error.
async function scanOrphans() {
  log(`\n=== Huérfanos en pet-photos/events/ (sin fila de medical_history que los referencie) ===`);

  const { data: petsRows } = await supabase.from("pets").select("id");
  const validPetIds = new Set((petsRows || []).map(p => p.id));

  const { data: referencedRows } = await supabase
    .from("medical_history")
    .select("photo_url")
    .not("photo_url", "is", null);
  const referencedPaths = new Set(
    (referencedRows || []).map(r => extractStoragePath(r.photo_url, "pet-photos")).filter(Boolean)
  );

  const { data: eventFolders } = await supabase.storage.from("pet-photos").list("events", { limit: 1000 });
  let orphanCount = 0, totalBytes = 0;
  for (const folder of eventFolders || []) {
    const petId = folder.name;
    const isDeletedPet = !validPetIds.has(petId);
    const { data: files } = await supabase.storage.from("pet-photos").list(`events/${petId}`);
    for (const f of files || []) {
      const objPath = `events/${petId}/${f.name}`;
      if (!referencedPaths.has(objPath)) {
        orphanCount++;
        totalBytes += f.metadata?.size || 0;
        log(`  HUÉRFANO: ${objPath} (${((f.metadata?.size || 0) / 1024).toFixed(1)} KB) — mascota ${isDeletedPet ? "ELIMINADA (petId no existe en pets)" : "existe pero ningún medical_history.photo_url lo referencia"}`);
      }
    }
  }
  log(`Total huérfanos en pet-photos/events/: ${orphanCount} (${(totalBytes / 1024 / 1024).toFixed(2)} MB). No se borra nada automáticamente.`);

  log(`\n=== Huérfanos en marketplace/receipts/ (sin fila de marketplace_listings que los referencie) ===`);
  const { data: referencedReceiptRows } = await supabase
    .from("marketplace_listings")
    .select("receipt_url")
    .not("receipt_url", "is", null);
  const referencedReceiptPaths = new Set(
    (referencedReceiptRows || []).map(r => extractStoragePath(r.receipt_url, "marketplace")).filter(Boolean)
  );
  const { data: receiptFolders } = await supabase.storage.from("marketplace").list("receipts", { limit: 1000 });
  let receiptOrphans = 0, receiptBytes = 0;
  for (const folder of receiptFolders || []) {
    const userId = folder.name;
    const { data: files } = await supabase.storage.from("marketplace").list(`receipts/${userId}`);
    for (const f of files || []) {
      const objPath = `receipts/${userId}/${f.name}`;
      if (!referencedReceiptPaths.has(objPath)) {
        receiptOrphans++;
        receiptBytes += f.metadata?.size || 0;
        log(`  HUÉRFANO: ${objPath} (${((f.metadata?.size || 0) / 1024).toFixed(1)} KB) — ningún marketplace_listings.receipt_url lo referencia`);
      }
    }
  }
  log(`Total huérfanos en marketplace/receipts/: ${receiptOrphans} (${(receiptBytes / 1024 / 1024).toFixed(2)} MB). No se borra nada automáticamente.`);
}

async function main() {
  log(`Modo: ${MODE.toUpperCase()}` +
    (MODE === "audit" ? " (dry-run de la migración, no mueve nada)"
      : MODE === "orphans" ? " (solo reporta huérfanos, no borra nada)"
      : " (migra de verdad)"));

  if (MODE === "orphans") {
    await scanOrphans();
    log("\nListo.");
    return;
  }

  await migratePrefix({
    label: "medical_history.photo_url (events/ en pet-photos) -> pet-photos-medical",
    sourceBucket: "pet-photos",
    destBucket: "pet-photos-medical",
    table: "medical_history",
    legacyUrlCol: "photo_url",
    newPathCol: "photo_path",
    ownerIdField: "pet_id",
  });

  await migratePrefix({
    label: "marketplace_listings.receipt_url (receipts/ en marketplace) -> marketplace-receipts",
    sourceBucket: "marketplace",
    destBucket: "marketplace-receipts",
    table: "marketplace_listings",
    legacyUrlCol: "receipt_url",
    newPathCol: "receipt_path",
    ownerIdField: "user_id",
  });

  log("\nListo. Correr con --orphans aparte para auditar archivos sin fila que los referencie.");
}

main().catch(err => {
  console.error("[migrate-storage] Error fatal:", err);
  process.exit(1);
});
