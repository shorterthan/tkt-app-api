import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import pkg from "pg";

dotenv.config();
const { Pool } = pkg;

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is missing. Put it in .env");
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // Neon向け
});

// 動作確認
app.get("/", (req, res) => {
  res.json({ ok: true });
});

// メッセージ一覧
app.get("/api/messages", async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT id, name, content, created_at FROM messages ORDER BY created_at DESC LIMIT 100"
    );
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "db_error" });
  }
});

// メッセージ追加
app.post("/api/messages", async (req, res) => {
  try {
    const name = (req.body?.name ?? "").toString().trim();
    const content = (req.body?.content ?? "").toString().trim();

    if (!name || !content) {
      return res.status(400).json({ error: "name_and_content_required" });
    }
    if (name.length > 40 || content.length > 200) {
      return res.status(400).json({ error: "too_long" });
    }

    const { rows } = await pool.query(
      "INSERT INTO messages (name, content) VALUES ($1, $2) RETURNING id, name, content, created_at",
      [name, content]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "db_error" });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`API running on http://localhost:${port}`);
});
