import { Router } from "express";
import { db } from "@workspace/db";
import { goldenExamplesTable, categoriesTable, postsTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";

const router = Router();

router.get("/admin/golden-examples", async (_req, res) => {
  try {
    const examples = await db
      .select({
        id: goldenExamplesTable.id,
        categoryId: goldenExamplesTable.categoryId,
        inputText: goldenExamplesTable.inputText,
        outputText: goldenExamplesTable.outputText,
        notes: goldenExamplesTable.notes,
        createdAt: goldenExamplesTable.createdAt,
        categoryName: categoriesTable.name,
      })
      .from(goldenExamplesTable)
      .leftJoin(categoriesTable, eq(goldenExamplesTable.categoryId, categoriesTable.id))
      .orderBy(desc(goldenExamplesTable.createdAt));

    res.json(examples);
  } catch (err) {
    res.status(500).json({ error: "internal_error", message: "Failed to fetch golden examples" });
  }
});

router.post("/admin/golden-examples", async (req, res) => {
  const { postId, categoryId, notes } = req.body;

  try {
    if (postId) {
      const [post] = await db.select().from(postsTable).where(eq(postsTable.id, postId));
      if (!post) return res.status(404).json({ error: "not_found", message: "Post not found" });

      const [example] = await db
        .insert(goldenExamplesTable)
        .values({
          categoryId: categoryId ?? post.primaryCategoryId,
          inputText: `Community submission that produced this article`,
          outputText: post.body,
          notes: notes ?? `Promoted from article: ${post.title}`,
        })
        .returning();

      return res.status(201).json(example);
    }

    const { inputText, outputText } = req.body;
    if (!inputText || !outputText) {
      return res.status(400).json({ error: "validation_error", message: "inputText and outputText are required" });
    }

    const [example] = await db
      .insert(goldenExamplesTable)
      .values({ categoryId, inputText, outputText, notes })
      .returning();

    res.status(201).json(example);
  } catch (err) {
    res.status(500).json({ error: "internal_error", message: "Failed to create golden example" });
  }
});

router.delete("/admin/golden-examples/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "validation_error", message: "Invalid ID" });

  try {
    const [deleted] = await db
      .delete(goldenExamplesTable)
      .where(eq(goldenExamplesTable.id, id))
      .returning();

    if (!deleted) return res.status(404).json({ error: "not_found", message: "Example not found" });
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: "internal_error", message: "Failed to delete golden example" });
  }
});

export default router;
