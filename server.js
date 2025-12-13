import express from "express";
import cors from "cors";
import pg from "pg";
import dotenv from "dotenv";
import path from "path";

dotenv.config();

const app = express();
app.use(express.json());

// フロントと同一URLで配信するなら、CORSは無くてもOKだけど一旦残す
app.use(cors());

// ✅ publicフォルダを配信（index.htmlを返す）
const __dirname = path.resolve();
app.use(express.static(path.join(__dirname, "public")));

// ✅ ルート / が開かれたら index.html を返す（staticが効かないケース保険）
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// ✅ 疎通確認（これが {ok:true} を返す場所）
app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

// ✅ 全件取得
app.get("/api/messages", async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT id, name, content, created_at FROM messages ORDER BY id DESC LIMIT 100"
    );
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "db_error" });
  }
});

// ✅ 追加
app.post("/api/messages", async (req, res) => {
  try {
    const name = String(req.body?.name ?? "").trim();
    const content = String(req.body?.content ?? "").trim();

    if (!name || !content) return res.status(400).json({ error: "name_and_content_required" });
    if (name.length > 40 || content.length > 200) return res.status(400).json({ error: "too_long" });

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
app.listen(port, () => console.log(`API running on port ${port}`));