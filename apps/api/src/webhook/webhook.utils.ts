import { createHmac } from "node:crypto";

import type { Stripe } from "stripe";

/**
 * Extract the order ID from a Stripe Checkout Session.
 * Uses client_reference_id as primary, with metadata.orderId as fallback.
 */
export const getOrderIdFromSession = (
  session: Stripe.Checkout.Session,
): string | null => {
  return session.client_reference_id ?? session.metadata?.orderId ?? null;
};

/**
 * Manually verify Stripe webhook signature and parse event.
 * Bypasses Stripe SDK's constructEvent which can have issues in Bun.
 */
export const verifyAndParseWebhook = (
  body: string,
  signatureHeader: string,
  secret: string,
  toleranceSeconds = 300,
): Stripe.Event => {
  // Parse the signature header: "t=TIMESTAMP,v1=SIG1,v1=SIG2,..."
  const parts = signatureHeader.split(",");
  let timestamp: string | null = null;
  const signatures: string[] = [];

  for (const part of parts) {
    const [key, value] = part.split("=");
    if (key === "t") timestamp = value;
    else if (key === "v1") signatures.push(value);
  }

  if (!timestamp || signatures.length === 0) {
    throw new Error("Invalid signature header format");
  }

  // Check timestamp tolerance
  const ts = Number.parseInt(timestamp, 10);
  const now = Math.floor(Date.now() / 1000);
  if (now - ts > toleranceSeconds) {
    throw new Error(
      `Timestamp outside tolerance: event=${ts}, now=${now}, diff=${now - ts}s`,
    );
  }

  // Compute expected signature: HMAC-SHA256(timestamp.body, secret)
  const payload = `${timestamp}.${body}`;
  const expectedSignature = createHmac("sha256", secret)
    .update(payload, "utf8")
    .digest("hex");

  // Compare with all provided v1 signatures
  const isValid = signatures.some((sig) => {
    if (sig.length !== expectedSignature.length) return false;
    let result = 0;
    for (let i = 0; i < sig.length; i++) {
      result |= sig.charCodeAt(i) ^ expectedSignature.charCodeAt(i);
    }
    return result === 0;
  });

  if (!isValid) {
    throw new Error(
      `Signature mismatch. Expected: ${expectedSignature.slice(0, 16)}..., Got: ${signatures[0]?.slice(0, 16)}...`,
    );
  }

  return JSON.parse(body) as Stripe.Event;
};
