const socket = io();
const els = {
  me: document.getElementById("me"),
  name: document.getElementById("name"),
  pass: document.getElementById("pass"),
  loginBtn: document.getElementById("loginBtn"),
  err: document.getElementById("err"),
  messages: document.getElementById("messages"),
  msg: document.getElementById("msg"),
  sendBtn: document.getElementById("sendBtn"),
  onlineList: document.getElementById("onlineList"),
  usersCount: document.getElementById("usersCount")
};
function fmtTime(ts){ const d=new Date(ts); return String(d.getHours()).padStart(2,"0")+":"+String(d.getMinutes()).padStart(2,"0"); }
function escapeHtml(str){ return str.replace(/[&<>"']/g, m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m])); }
function renderMessage(m,my){ const li=document.createElement("li"); li.className="msg"+(m.name===my?" me":""); li.innerHTML=`<div class="text">${escapeHtml(m.text)}</div><div class="meta">${escapeHtml(m.name)} · ${fmtTime(m.ts)}</div>`; els.messages.appendChild(li); els.messages.scrollTop=els.messages.scrollHeight; }
let myName=null;
const savedName=localStorage.getItem("myName"); if(savedName) els.name.value=savedName;
els.loginBtn.addEventListener("click",()=>{ socket.emit("login",{name:els.name.value.trim(), pass:els.pass.value}); });
els.msg.addEventListener("keydown",e=>{ if(e.key==="Enter") send(); });
els.sendBtn.addEventListener("click",send);
function send(){ const t=els.msg.value.trim(); if(!t) return; socket.emit("message", t); els.msg.value=""; els.msg.focus(); }
socket.on("loginOk",({me})=>{ myName=me; localStorage.setItem("myName", myName); els.me.textContent=`Вы вошли как: ${myName}`; els.err.textContent=""; els.msg.disabled=false; els.sendBtn.disabled=false; els.name.disabled=true; els.pass.disabled=true; els.loginBtn.disabled=true; });
socket.on("loginError",msg=>{ els.err.textContent=msg; });
socket.on("history",arr=>{ els.messages.innerHTML=""; arr.forEach(m=>renderMessage(m,myName)); });
socket.on("message",m=>renderMessage(m,myName));
socket.on("onlineUsers",users=>{ els.usersCount.textContent=`${users.length} участник(а)`; els.onlineList.innerHTML=""; users.forEach(u=>{ const li=document.createElement("li"); li.innerHTML=`<div class="avatar"></div><div class="name">${escapeHtml(u)}</div>`; els.onlineList.appendChild(li); }); });
