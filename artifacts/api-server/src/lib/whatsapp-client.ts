import { getSettingValue } from "../routes/settings";
import { logger } from "./logger";

const GRAPH_API_BASE = "https://graph.facebook.com/v18.0";

async function getToken(): Promise<string> {
  const token = await getSettingValue("whatsapp_access_token");
  if (!token) throw new Error("WhatsApp access token is not configured");
  return token;
}

async function getPhoneNumberId(): Promise<string> {
  const id = await getSettingValue("whatsapp_phone_number_id");
  if (!id) throw new Error("WhatsApp phone number ID is not configured");
  return id;
}

export async function sendTextMessage(to: string, body: string): Promise<void> {
  const [token, phoneNumberId] = await Promise.all([getToken(), getPhoneNumberId()]);

  const response = await fetch(`${GRAPH_API_BASE}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "text",
      text: { body, preview_url: false },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    logger.error({ error, to }, "Failed to send WhatsApp message");
    throw new Error(`WhatsApp send failed: ${response.status} ${error}`);
  }
}

export async function downloadMedia(
  mediaId: string,
): Promise<{ buffer: Buffer; mimeType: string }> {
  const token = await getToken();

  const metaResponse = await fetch(`${GRAPH_API_BASE}/${mediaId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!metaResponse.ok) {
    throw new Error(`Failed to resolve media URL for ${mediaId}: ${metaResponse.status}`);
  }

  const meta = (await metaResponse.json()) as { url: string; mime_type: string };

  const mediaResponse = await fetch(meta.url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!mediaResponse.ok) {
    throw new Error(`Failed to download media from ${meta.url}: ${mediaResponse.status}`);
  }

  const arrayBuffer = await mediaResponse.arrayBuffer();
  return {
    buffer: Buffer.from(arrayBuffer),
    mimeType: meta.mime_type,
  };
}
