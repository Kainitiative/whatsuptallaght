import { db } from "@workspace/db";
import { contributorsTable, postsTable, submissionsTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import { sendTextMessage } from "./whatsapp-client";
import { logger } from "./logger";

const HELP_TEXT = [
  "👋 Welcome to Tallaght Community!",
  "",
  "📰 Send us your local story — just type it out",
  "📸 Send a photo (with or without a message)",
  "🎤 Send a voice note",
  "",
  "Commands:",
  "MY POSTS — see your recent stories",
  "STATUS — check your latest submission",
  "DELETE — request removal of a story",
  "STOP — stop receiving notifications",
  "",
  "Thank you for being part of your community! 🏘️",
].join("\n");

export function isCommand(text: string): boolean {
  const t = text.trim().toUpperCase();
  return (
    t === "HELP" ||
    t === "MY POSTS" ||
    t === "STATUS" ||
    t === "STOP" ||
    t.startsWith("DELETE")
  );
}

async function handleHelp(phoneNumber: string): Promise<void> {
  await sendTextMessage(phoneNumber, HELP_TEXT);
}

async function handleMyPosts(phoneNumber: string, contributorId: number): Promise<void> {
  const posts = await db
    .select({
      id: postsTable.id,
      title: postsTable.title,
      status: postsTable.status,
      publishedAt: postsTable.publishedAt,
    })
    .from(postsTable)
    .innerJoin(submissionsTable, eq(postsTable.sourceSubmissionId, submissionsTable.id))
    .where(eq(submissionsTable.contributorId, contributorId))
    .orderBy(desc(postsTable.createdAt))
    .limit(5);

  if (!posts.length) {
    await sendTextMessage(
      phoneNumber,
      "You haven't had any stories published yet. Keep them coming! 🙌",
    );
    return;
  }

  const statusIcon: Record<string, string> = {
    published: "✅",
    pending_review: "⏳",
    draft: "📝",
    rejected: "❌",
    archived: "📁",
  };

  const list = posts
    .map(
      (p, i) =>
        `${i + 1}. ${statusIcon[p.status] ?? "•"} ${p.title}`,
    )
    .join("\n");

  await sendTextMessage(phoneNumber, `Your recent stories:\n\n${list}`);
}

async function handleStatus(phoneNumber: string, contributorId: number): Promise<void> {
  const [latestSubmission] = await db
    .select()
    .from(submissionsTable)
    .where(eq(submissionsTable.contributorId, contributorId))
    .orderBy(desc(submissionsTable.createdAt))
    .limit(1);

  if (!latestSubmission) {
    await sendTextMessage(phoneNumber, "You haven't sent us any stories yet! 📲");
    return;
  }

  const messages: Record<string, string> = {
    pending: "⏳ Your story is queued and will be processed shortly.",
    processing: "🤖 Your story is being reviewed by our AI editor right now.",
    processed: "✅ Your story has been published or is awaiting final review.",
    rejected: `❌ We couldn't use this submission — ${latestSubmission.rejectionReason ?? "please send more details and try again."}`,
    failed: "⚠️ Something went wrong processing your story. Please try again.",
  };

  await sendTextMessage(
    phoneNumber,
    `Status of your latest submission:\n\n${messages[latestSubmission.status] ?? "Status unknown."}`,
  );
}

async function handleStop(phoneNumber: string, contributorId: number): Promise<void> {
  await db
    .update(contributorsTable)
    .set({ updatedAt: new Date() })
    .where(eq(contributorsTable.id, contributorId));

  await sendTextMessage(
    phoneNumber,
    "You've been unsubscribed from notifications. You can still send us stories anytime — just message us! Reply HELP to see options.",
  );
}

async function handleDelete(phoneNumber: string): Promise<void> {
  await sendTextMessage(
    phoneNumber,
    "To request removal of a published story, reply with the story title or a link and our team will process your request within 24 hours. 🙏",
  );
}

export async function handleCommand(
  phoneNumber: string,
  contributorId: number,
  text: string,
): Promise<void> {
  const t = text.trim().toUpperCase();
  try {
    if (t === "HELP") {
      await handleHelp(phoneNumber);
    } else if (t === "MY POSTS") {
      await handleMyPosts(phoneNumber, contributorId);
    } else if (t === "STATUS") {
      await handleStatus(phoneNumber, contributorId);
    } else if (t === "STOP") {
      await handleStop(phoneNumber, contributorId);
    } else if (t.startsWith("DELETE")) {
      await handleDelete(phoneNumber);
    }
  } catch (err) {
    logger.error({ err, phoneNumber, command: t }, "Error handling WhatsApp command");
  }
}
