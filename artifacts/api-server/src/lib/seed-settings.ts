import { db } from "@workspace/db";
import { platformSettingsTable } from "@workspace/db/schema";

const SETTINGS: Omit<typeof platformSettingsTable.$inferInsert, "id">[] = [

  // ── General Platform ─────────────────────────────────────────────────────────

  {
    key: "platform_name",
    label: "Platform Name",
    description:
      "The public name shown in the website header, page titles, and on every social media post. " +
      "Choose something short and local — for example 'Tallaght Today' or 'Tallaght Community News'. " +
      "You can change this at any time and the update takes effect immediately across the site.",
    category: "general",
    isSecret: false,
    isRequired: true,
    isConfigured: false,
    displayOrder: 1,
  },

  {
    key: "platform_url",
    label: "Platform URL",
    description:
      "The full web address of your public website, including https://. " +
      "Example: https://tallaghttoday.ie. " +
      "This is added to the end of every Facebook and Instagram post so people can click through to read the full article. " +
      "Make sure there is no trailing slash at the end.",
    category: "general",
    isSecret: false,
    isRequired: true,
    isConfigured: false,
    displayOrder: 2,
  },

  {
    key: "platform_whatsapp_display_number",
    label: "WhatsApp Display Number",
    description:
      "The WhatsApp number shown on the website so community members know where to send their stories. " +
      "Enter it in international format with the country code, e.g. +353 87 123 4567. " +
      "This should be the same number you registered with Meta — the one people will message to submit content.",
    category: "general",
    isSecret: false,
    isRequired: true,
    isConfigured: false,
    displayOrder: 3,
  },

  // ── OpenAI ───────────────────────────────────────────────────────────────────

  {
    key: "auto_generate_images",
    label: "Auto-Generate Article Images",
    description:
      "When enabled, the AI will automatically generate a header image for every article that does not have one " +
      "(text-only WhatsApp submissions and all RSS articles). Images are created using DALL·E 3 and stored permanently. " +
      "Cost: approximately $0.04 per image. Set to 'true' to enable or 'false' to disable. " +
      "WhatsApp submissions that include a photo are not affected — submitted photos are always used.",
    category: "openai",
    isSecret: false,
    isRequired: false,
    isConfigured: false,
    displayOrder: 11,
  },

  {
    key: "openai_api_key",
    label: "OpenAI API Key",
    description:
      "Your OpenAI API key. This is what powers the entire AI pipeline — article writing, voice transcription, " +
      "image understanding, safety checking, and header image generation. " +
      "\n\n" +
      "HOW TO GET YOUR KEY:\n" +
      "Step 1 — Go to platform.openai.com and sign up or log in.\n" +
      "Step 2 — Click your profile icon (top right) and choose 'API Keys', or go directly to platform.openai.com/api-keys.\n" +
      "Step 3 — Click 'Create new secret key'. Give it a name like 'Tallaght Community Platform'.\n" +
      "Step 4 — Copy the key immediately — OpenAI only shows it once. It starts with 'sk-'.\n" +
      "Step 5 — Paste it here and save.\n" +
      "\n" +
      "BILLING:\n" +
      "You also need to add a payment method at platform.openai.com/settings/organization/billing. " +
      "OpenAI is pay-as-you-go — there is no monthly fee. At typical early volume (10 posts per day), " +
      "costs run approximately €1–3 per day. You can set a monthly spending limit in the billing settings " +
      "to avoid surprises.",
    helpUrl: "https://platform.openai.com/api-keys",
    category: "openai",
    isSecret: true,
    isRequired: true,
    isConfigured: false,
    displayOrder: 10,
  },

  // ── WhatsApp / Meta ──────────────────────────────────────────────────────────

  {
    key: "whatsapp_access_token",
    label: "WhatsApp Access Token",
    description:
      "The permanent access token that allows this platform to receive and send WhatsApp messages on behalf of your Meta App. " +
      "\n\n" +
      "HOW TO GET YOUR TOKEN:\n" +
      "Step 1 — Go to developers.facebook.com and log in with your Facebook account.\n" +
      "Step 2 — Open your app (or create one: click 'My Apps' > 'Create App' > choose 'Business').\n" +
      "Step 3 — In the left sidebar, click 'WhatsApp' then 'API Setup'.\n" +
      "Step 4 — You will see a temporary access token at the top. Do not use this — it expires in 24 hours.\n" +
      "Step 5 — To get a permanent token: go to Business Settings > System Users > Add a system user with 'Admin' role. " +
      "Then generate a token for that system user, selecting your WhatsApp app and the whatsapp_business_messaging permission. " +
      "This token does not expire.\n" +
      "Step 6 — Copy the permanent token and paste it here.",
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
    description:
      "The numeric ID that Meta assigns to your registered WhatsApp phone number. " +
      "This is different from the phone number itself — it is a long number that Meta uses internally to identify your line. " +
      "\n\n" +
      "HOW TO FIND YOUR PHONE NUMBER ID:\n" +
      "Step 1 — Go to developers.facebook.com and open your app.\n" +
      "Step 2 — Click 'WhatsApp' in the left sidebar, then 'API Setup'.\n" +
      "Step 3 — Under 'From', you will see your registered phone number with a dropdown. " +
      "Just below or beside it is a field labelled 'Phone Number ID' — it looks like a 15–16 digit number.\n" +
      "Step 4 — Copy that number and paste it here.",
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
    description:
      "A secret passphrase that you invent yourself. It is used to prove to Meta that this server is the " +
      "genuine owner of the webhook URL. You enter the same phrase here and in the Meta Developer Portal, " +
      "and Meta checks they match when setting up the connection. " +
      "\n\n" +
      "HOW TO SET THIS UP:\n" +
      "Step 1 — Choose any random phrase. It can be anything — make it unique and hard to guess. " +
      "Example: 'tallaght-webhook-secret-2024' or a random string like 'xK9mP2qL8nR'. Write it down.\n" +
      "Step 2 — Paste that phrase here and save.\n" +
      "Step 3 — Go to developers.facebook.com, open your app, click 'WhatsApp' > 'Configuration'.\n" +
      "Step 4 — Under Webhooks, click 'Edit'. Enter your platform's webhook URL " +
      "(it will be: https://your-domain.ie/api/webhooks/whatsapp) and paste the same phrase into the 'Verify token' field.\n" +
      "Step 5 — Click 'Verify and Save'. Meta will ping your server to confirm the tokens match.",
    category: "whatsapp",
    isSecret: true,
    isRequired: true,
    isConfigured: false,
    displayOrder: 22,
  },

  {
    key: "whatsapp_app_secret",
    label: "Meta App Secret",
    description:
      "A secret key tied to your Meta Developer App. The platform uses this to verify that every incoming " +
      "webhook message genuinely came from Meta and has not been tampered with. Without it, anyone who knows " +
      "your webhook URL could potentially send fake messages to your platform. " +
      "\n\n" +
      "HOW TO FIND YOUR APP SECRET:\n" +
      "Step 1 — Go to developers.facebook.com and open your app.\n" +
      "Step 2 — In the left sidebar, click 'App Settings', then 'Basic'.\n" +
      "Step 3 — Look for the 'App Secret' field. Click 'Show' to reveal it (you may need to re-enter your Facebook password).\n" +
      "Step 4 — Copy the app secret and paste it here.",
    helpUrl: "https://developers.facebook.com/apps",
    category: "whatsapp",
    isSecret: true,
    isRequired: true,
    isConfigured: false,
    displayOrder: 23,
  },

  // ── Facebook ──────────────────────────────────────────────────────────────────

  {
    key: "facebook_page_id",
    label: "Facebook Page ID",
    description:
      "The unique numeric ID of your Facebook Page. Every published article is automatically posted to this page. " +
      "\n\n" +
      "HOW TO FIND YOUR PAGE ID:\n" +
      "Step 1 — Go to your Facebook Page.\n" +
      "Step 2 — Click 'About' in the left menu.\n" +
      "Step 3 — Scroll down to the 'Page Transparency' section — your Page ID is listed there. " +
      "It is a long number like 123456789012345.\n" +
      "Alternatively: go to your page, look at the URL. If it shows a username (e.g. /TallaghtToday), " +
      "go to facebook.com/TallaghtToday/about and the ID will be in the Page Transparency section.\n" +
      "Step 4 — Copy that number and paste it here.",
    category: "facebook",
    isSecret: false,
    isRequired: true,
    isConfigured: false,
    displayOrder: 30,
  },

  {
    key: "facebook_page_access_token",
    label: "Facebook Page Access Token",
    description:
      "A long-lived access token that allows this platform to post articles to your Facebook Page automatically. " +
      "\n\n" +
      "HOW TO GENERATE YOUR PAGE ACCESS TOKEN:\n" +
      "Step 1 — Go to developers.facebook.com/tools/explorer.\n" +
      "Step 2 — In the top-right dropdown, select your Meta App.\n" +
      "Step 3 — Click 'Generate Access Token' and log in with the Facebook account that manages your Page.\n" +
      "Step 4 — Click 'Get Page Access Token', then select your Page from the list.\n" +
      "Step 5 — Add the permission 'pages_manage_posts' — click 'Add a Permission', search for it, and tick it.\n" +
      "Step 6 — Copy the token shown. This is a short-lived token (valid 1 hour). To make it permanent:\n" +
      "Step 7 — Go to developers.facebook.com/tools/debug/accesstoken, paste the token, and click 'Extend Access Token'. " +
      "Copy the new long-lived token (valid 60 days).\n" +
      "Step 8 — For a never-expiring token, use a System User token from Business Settings > System Users instead " +
      "(recommended for production — see the WhatsApp Access Token instructions for the System User approach).\n" +
      "Step 9 — Paste the token here.",
    helpUrl: "https://developers.facebook.com/tools/explorer",
    category: "facebook",
    isSecret: true,
    isRequired: true,
    isConfigured: false,
    displayOrder: 31,
  },

  {
    key: "facebook_webhook_verify_token",
    label: "Facebook Webhook Verify Token",
    description:
      "A secret token you choose that Facebook uses to verify your webhook endpoint for Page feed events (used for competition entry tracking). " +
      "\n\n" +
      "HOW TO SET UP:\n" +
      "Step 1 — Choose any random string (e.g. 'wut-fb-webhook-2024').\n" +
      "Step 2 — Save that string here.\n" +
      "Step 3 — In developers.facebook.com, open your app → Webhooks → Page.\n" +
      "Step 4 — Set Callback URL to: https://whatsuptallaght.ie/api/webhooks/facebook\n" +
      "Step 5 — Set Verify Token to the same string you saved here.\n" +
      "Step 6 — Subscribe to the 'feed' field.\n" +
      "Step 7 — Click Verify and Save.",
    category: "facebook",
    isSecret: true,
    isRequired: false,
    isConfigured: false,
    displayOrder: 32,
  },

  // ── Instagram ──────────────────────────────────────────────────────────────────

  {
    key: "instagram_account_id",
    label: "Instagram Account ID",
    description:
      "The numeric ID of your Instagram Professional Account (Business or Creator account). " +
      "This must be connected to the same Facebook Page you entered above. " +
      "Every published article is automatically posted to this Instagram account. " +
      "\n\n" +
      "HOW TO FIND YOUR INSTAGRAM ACCOUNT ID:\n" +
      "Step 1 — Make sure your Instagram account is a Professional Account (Business or Creator) " +
      "and is linked to your Facebook Page. To link: on Instagram, go to Settings > Account > Linked Accounts, or " +
      "on your Facebook Page go to Settings > Instagram.\n" +
      "Step 2 — Go to developers.facebook.com/tools/explorer.\n" +
      "Step 3 — Select your Meta App and generate an access token with the instagram_basic permission.\n" +
      "Step 4 — In the query field, type: /me/accounts and click Submit. Find your Page in the results and note its ID.\n" +
      "Step 5 — Now query: /{your-page-id}?fields=instagram_business_account and click Submit.\n" +
      "Step 6 — The result will show an 'instagram_business_account' object with an 'id' field. That is your Instagram Account ID.\n" +
      "Step 7 — Copy that ID and paste it here.",
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
      .onConflictDoUpdate({
        target: platformSettingsTable.key,
        set: {
          label: setting.label,
          description: setting.description,
          helpUrl: setting.helpUrl ?? null,
          category: setting.category,
          isSecret: setting.isSecret,
          isRequired: setting.isRequired,
          displayOrder: setting.displayOrder,
        },
      });
  }
}
