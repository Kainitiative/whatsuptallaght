import { db } from "@workspace/db";
import { platformSettingsTable } from "@workspace/db/schema";
import { sql } from "drizzle-orm";

const SETTINGS: Omit<typeof platformSettingsTable.$inferInsert, "id">[] = [
  // ── General Platform ────────────────────────────────────────────────────────
  {
    key: "platform_name",
    label: "Platform Name",
    description: "The public name of your community platform, shown in the header and on social posts.",
    category: "general",
    isSecret: false,
    isRequired: true,
    isConfigured: false,
    displayOrder: 1,
  },
  {
    key: "platform_url",
    label: "Platform URL",
    description: "The full public URL of your website, e.g. https://tallaghttoday.ie — used in social post links.",
    category: "general",
    isSecret: false,
    isRequired: true,
    isConfigured: false,
    displayOrder: 2,
  },
  {
    key: "platform_whatsapp_display_number",
    label: "WhatsApp Display Number",
    description: "The WhatsApp number shown publicly on the website for community submissions, e.g. +353 87 123 4567.",
    category: "general",
    isSecret: false,
    isRequired: true,
    isConfigured: false,
    displayOrder: 3,
  },

  // ── OpenAI ──────────────────────────────────────────────────────────────────
  {
    key: "openai_api_key",
    label: "OpenAI API Key",
    description: "Your OpenAI API key. Used for GPT-4o article writing, GPT-4o-mini classification, Whisper voice transcription, and DALL-E header image generation. Get yours at platform.openai.com/api-keys.",
    helpUrl: "https://platform.openai.com/api-keys",
    category: "openai",
    isSecret: true,
    isRequired: true,
    isConfigured: false,
    displayOrder: 10,
  },

  // ── WhatsApp / Meta ─────────────────────────────────────────────────────────
  {
    key: "whatsapp_access_token",
    label: "WhatsApp Access Token",
    description: "The permanent access token for your Meta App. Found in the Meta Developer Portal under WhatsApp > API Setup. This is the long-lived token — not the temporary one shown on first login.",
    helpUrl: "https://developers.facebook.com/docs/whatsapp/business-management-api/get-started",
    category: "whatsapp",
    isSecret: true,
    isRequired: true,
    isConfigured: false,
    displayOrder: 20,
  },
  {
    key: "whatsapp_phone_number_id",
    label: "WhatsApp Phone Number ID",
    description: "The numeric ID Meta assigns to your registered WhatsApp phone number. Found in the Meta Developer Portal under WhatsApp > API Setup after registering your number. It looks like: 123456789012345.",
    helpUrl: "https://developers.facebook.com/docs/whatsapp/cloud-api/get-started",
    category: "whatsapp",
    isSecret: false,
    isRequired: true,
    isConfigured: false,
    displayOrder: 21,
  },
  {
    key: "whatsapp_webhook_verify_token",
    label: "Webhook Verify Token",
    description: "A secret string you create yourself — any random phrase. You enter this here AND in the Meta Developer Portal under Webhooks > Verify Token. It proves to Meta that this server owns the webhook URL. Example: my-tallaght-webhook-2024.",
    category: "whatsapp",
    isSecret: true,
    isRequired: true,
    isConfigured: false,
    displayOrder: 22,
  },
  {
    key: "whatsapp_app_secret",
    label: "Meta App Secret",
    description: "The App Secret for your Meta Developer App. Found in the Meta Developer Portal under App Settings > Basic. Used to verify that incoming webhook payloads genuinely came from Meta and not a third party.",
    helpUrl: "https://developers.facebook.com/apps",
    category: "whatsapp",
    isSecret: true,
    isRequired: true,
    isConfigured: false,
    displayOrder: 23,
  },

  // ── Facebook ─────────────────────────────────────────────────────────────────
  {
    key: "facebook_page_id",
    label: "Facebook Page ID",
    description: "The numeric ID of your Facebook Page. To find it: go to your Facebook Page, click About, then scroll to Page Transparency — the ID is listed there. It looks like: 123456789012345.",
    category: "facebook",
    isSecret: false,
    isRequired: true,
    isConfigured: false,
    displayOrder: 30,
  },
  {
    key: "facebook_page_access_token",
    label: "Facebook Page Access Token",
    description: "A long-lived Page Access Token for posting to your Facebook Page. Generate it in the Meta Developer Portal using the Graph API Explorer: select your App, select your Page, request pages_manage_posts permission, then generate and extend the token.",
    helpUrl: "https://developers.facebook.com/tools/explorer",
    category: "facebook",
    isSecret: true,
    isRequired: true,
    isConfigured: false,
    displayOrder: 31,
  },

  // ── Instagram ─────────────────────────────────────────────────────────────────
  {
    key: "instagram_account_id",
    label: "Instagram Account ID",
    description: "The numeric ID of your Instagram Professional Account connected to your Facebook Page. To find it: in the Meta Developer Portal, use the Graph API Explorer and query /me/accounts, then find your page, then query /{page-id}?fields=instagram_business_account.",
    helpUrl: "https://developers.facebook.com/docs/instagram-api/getting-started",
    category: "instagram",
    isSecret: false,
    isRequired: true,
    isConfigured: false,
    displayOrder: 40,
  },
];

export async function seedSettings(): Promise<void> {
  for (const setting of SETTINGS) {
    await db
      .insert(platformSettingsTable)
      .values(setting)
      .onConflictDoNothing();
  }
}
