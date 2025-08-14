const express = require("express");
const path = require("path");
const fs = require("fs");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http, { cors: { origin: "*" } });

app.use(express.static("public"));
app.use(express.json());

const DATA_DIR = path.join(__dirname, "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");
const MESSAGES_FILE = path.join(DATA_DIR, "messages.json");

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, "[]", "utf-8");
if (!fs.existsSync(MESSAGES_FILE)) fs.writeFileSync(MESSAGES_FILE, "{}", "utf-8");

function readUsers() { try { return JSON.parse(fs.readFileSync(USERS_FILE, "utf-8")); } catch { return []; } }
function saveUsers(users) { fs.writeFileSync(USERS_FILE, JSON.stringify(users, null,2)); }
function readMessages() { try { return JSON.parse(fs.readFileSync(MESSAGES_FILE, "utf-8")); } catch { return {}; } }
function saveMessages(msgs) { fs.writeFileSync(MESSAGES_FILE, JSON.stringify(msgs, null,2)); }

let onlineUsers = new Map();
let messages = readMessages();
let users = readUsers();

io.on("connection", socket => {
    let currentUser = null;

    socket.on("register", ({name, pass}) => {
        if (!name || !pass) { socket.emit("registerError","Введите имя и пароль"); return; }
        if (users.find(u=>u.name===name)) { socket.emit("registerError","Имя уже занято"); return; }
        users.push({name, pass});
        saveUsers(users);
        socket.emit("registerOk","Регистрация успешна");
    });

    socket.on("login", ({name, pass}) => {
        const user = users.find(u=>u.name===name && u.pass===pass);
        if (!user) { socket.emit("loginError","Неверный логин или пароль"); return; }
        currentUser = name;
        onlineUsers.set(socket.id, currentUser);
        socket.emit("loginOk",{me: currentUser});
        io.emit("onlineUsers", Array.from(new Set(onlineUsers.values())).sort());
        socket.emit("chatList", Object.keys(messages).filter(k => k.includes(currentUser)));
    });

    socket.on("startChat", ({friend}) => {
        if (!currentUser) return;
        const chatId = [currentUser, friend].sort().join("__");
        if (!messages[chatId]) messages[chatId]=[];
        socket.emit("chatHistory",{chatId, msgs: messages[chatId]});
    });

    socket.on("message", ({chatId, text}) => {
        if (!currentUser) return;
        const msg = { id: Date.now().toString(36)+Math.random().toString(36).slice(2,8), name: currentUser, text, ts: Date.now() };
        if (!messages[chatId]) messages[chatId]=[];
        messages[chatId].push(msg);
        saveMessages(messages);
        io.emit("message",{chatId,msg});
    });

    socket.on("disconnect", () => {
        if(currentUser) onlineUsers.delete(socket.id);
        io.emit("onlineUsers", Array.from(new Set(onlineUsers.values())).sort());
    });
});

app.get("/healthz",(_,res)=>res.status(200).send("ok"));

const PORT = process.env.PORT || 3000;
http.listen(PORT,()=>console.log("Server running on port",PORT));
