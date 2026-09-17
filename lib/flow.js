import crypto from "node:crypto";

const FLOW_API_URL = process.env.FLOW_API_URL;
const FLOW_API_KEY = process.env.FLOW_API_KEY;
const FLOW_SECRET_KEY = process.env.FLOW_SECRET_KEY;

// Firma de parámetros según la documentación oficial de Flow: se
// ordenan alfabéticamente por nombre, se concatenan como
// nombreValor+nombreValor..., y se firma con HMAC-SHA256 usando el
// Secret Key. El resultado va como parámetro "s".
function sign(params) {
  const keys = Object.keys(params).sort();
  const toSign = keys.map((k) => `${k}${params[k]}`).join("");
  return crypto.createHmac("sha256", FLOW_SECRET_KEY).update(toSign).digest("hex");
}

export async function flowCreatePayment({ commerceOrder, subject, amount, email, urlConfirmation, urlReturn }) {
  const params = {
    apiKey: FLOW_API_KEY,
    commerceOrder,
    subject,
    currency: "CLP",
    amount,
    email,
    urlConfirmation,
    urlReturn,
  };
  params.s = sign(params);
  const body = new URLSearchParams(params);
  const res = await fetch(`${FLOW_API_URL}/payment/create`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || "Error creando el pago en Flow");
  return data; // { url, token, flowOrder }
}

export async function flowGetStatus(token) {
  const params = { apiKey: FLOW_API_KEY, token };
  params.s = sign(params);
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${FLOW_API_URL}/payment/getStatus?${qs}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || "Error consultando estado en Flow");
  return data; // incluye status (1 pendiente, 2 pagada, 3 rechazada, 4 anulada) y commerceOrder
}
