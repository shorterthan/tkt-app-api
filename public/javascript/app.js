const API_BASE = ""; // 同じサーバーなので空でOK

const $ = (id) => document.getElementById(id);

async function loadMessages() {
    const res = await fetch(`${API_BASE}/api/messages`);
    const data = await res.json();

    const list = $("list");
    list.innerHTML = "";

    for (const m of data) {
        const div = document.createElement("div");
        div.className = "item";
        div.innerHTML = `
      <div><b>${escapeHtml(m.name)}</b>: ${escapeHtml(m.content)}</div>
      <div class="meta">${new Date(m.created_at).toLocaleString()}</div>
    `;
        list.appendChild(div);
    }
}

async function sendMessage() {
    $("error").textContent = "";

    const name = $("name").value.trim();
    const content = $("content").value.trim();

    const res = await fetch(`${API_BASE}/api/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, content }),
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        $("error").textContent = err.error || "送信に失敗しました";
        return;
    }

    $("content").value = "";
    await loadMessages();
}

function escapeHtml(s) {
    return s
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

window.addEventListener("DOMContentLoaded", () => {
    $("sendBtn").addEventListener("click", sendMessage);
    $("reloadBtn").addEventListener("click", loadMessages);
    loadMessages();
});