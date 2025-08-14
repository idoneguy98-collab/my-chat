const express = require("express");
const path = require("path");
const fs = require("fs");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http, { cors: { origin: "*" } });

app.use(express.static("public"));

const PASSWORD = process.env.CHAT_PASSWORD || "1234";
let onlineUsers = new Set();

const DATA_DIR = path.join(__dirname, "data");
const MESSAGES_FILE = path.join(DATA_DIR, "messages.json");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
if (!fs.existsSync(MESSAGES_FILE)) fs.writeFileSync(MESSAGES_FILE, "[]", "utf-8");

function readMessages() {
  try {
    const raw = fs.readFileSync(MESSAGES_FILE, "utf-8");
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.slice(-1000) : [];
  } catch (e) {
    console.error("Read history error:", e);
    return [];
  }
}
let messages = readMessages();

let writeInProgress = false;
function saveMessages() {
  if (writeInProgress) return;
  writeInProgress = true;
  const tmp = MESSAGES_FILE + ".tmp";
  fs.writeFile(tmp, JSON.stringify(messages.slice(-1000)), "utf-8", (err) => {
    if (err) { console.error("Write error:", err); writeInProgress = false; return; }
    fs.rename(tmp, MESSAGES_FILE, (err2) => { if (err2) console.error("Rename error:", err2); writeInProgress = false; });
  });
}

io.on("connection", (socket) => {
  socket.on("login", ({ name, pass }) => {
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      socket.emit("loginError", "Введите имя");
      return;
    }
    if (pass !== PASSWORD) {
      socket.emit("loginError", "Неверный пароль");
      return;
    }
    socket.username = name.trim();
    onlineUsers.add(socket.username);
    io.to(socket.id).emit("loginOk", { me: socket.username });
    io.emit("onlineUsers", Array.from(onlineUsers).sort());
    io.to(socket.id).emit("history", messages.slice(-200));
  });

  socket.on("message", (text) => {
    if (!socket.username) { socket.emit("loginError", "Сначала войдите"); return; }
    if (typeof text !== "string" || text.trim().length === 0) return;
    const msg = { id: Date.now().toString(36) + Math.random().toString(36).slice(2,8), name: socket.username, text: text.trim(), ts: Date.now() };
    messages.push(msg);
    if (messages.length > 1500) messages = messages.slice(-1000);
    saveMessages();
    io.emit("message", msg);
  });

  socket.on("disconnect", () => {
    if (socket.username) {
      onlineUsers.delete(socket.username);
      io.emit("onlineUsers", Array.from(onlineUsers).sort());
    }
  });
});

app.get("/healthz", (_, res) => res.status(200).send("ok"));

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
  console.log(`Password: ${PASSWORD}`);
});
