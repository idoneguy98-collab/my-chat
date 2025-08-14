const socket=io();
const els={
  me:document.getElementById("me"),
  name:document.getElementById("name"),
  pass:document.getElementById("pass"),
  registerBtn:document.getElementById("registerBtn"),
  loginBtn:document.getElementById("loginBtn"),
  err:document.getElementById("err"),
  messages:document.getElementById("messages"),
  msg:document.getElementById("msg"),
  sendBtn:document.getElementById("sendBtn"),
  emojiBtn:document.getElementById("emojiBtn"),
  chatList:document.getElementById("chatList"),
  chatTitle:document.getElementById("chatTitle"),
  onlineList:document.getElementById("onlineList")
};
let myName=null;
let currentChat=null;
function fmtTime(ts){const d=new Date(ts);return String(d.getHours()).padStart(2,"0")+":"+String(d.getMinutes()).padStart(2,"0");}
function escapeHtml(str){return str.replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));}
function renderMessage(m,my){const li=document.createElement("li");li.className="msg"+(m.name===my?" me":"");li.innerHTML=`<div class="text">${escapeHtml(m.text)}</div><div class="meta">${escapeHtml(m.name)} · ${fmtTime(m.ts)}</div>`;els.messages.appendChild(li); els.messages.scrollTop=els.messages.scrollHeight;}
els.registerBtn.addEventListener("click",()=>{ socket.emit("register",{name:els.name.value.trim(),pass:els.pass.value}); });
els.loginBtn.addEventListener("click",()=>{ socket.emit("login",{name:els.name.value.trim(),pass:els.pass.value}); });
els.msg.addEventListener("keydown",e=>{if(e.key==="Enter") send();});
els.sendBtn.addEventListener("click",send);
els.emojiBtn.addEventListener("click",()=>{ els.msg.value+="😊"; els.msg.focus(); });
function send(){ if(!currentChat) return; const t=els.msg.value.trim(); if(!t) return; socket.emit("message",{chatId:currentChat,text:t}); els.msg.value=""; els.msg.focus(); }
socket.on("registerOk",msg=>{ els.err.textContent=msg; });
socket.on("registerError",msg=>{ els.err.textContent=msg; });
socket.on("loginOk",({me})=>{ myName=me; localStorage.setItem("myName",myName); els.me.textContent=`Вы вошли как: ${myName}`; els.err.textContent=""; els.msg.disabled=false; els.sendBtn.disabled=false; els.name.disabled=true; els.pass.disabled=true; els.registerBtn.disabled=true; els.loginBtn.disabled=true; });
socket.on("loginError",msg=>{ els.err.textContent=msg; });
socket.on("onlineUsers",users=>{ els.onlineList.innerHTML=""; users.forEach(u=>{ if(u!==myName){const li=document.createElement("li");li.textContent=u; li.addEventListener("click",()=>startChat(u)); els.onlineList.appendChild(li); } }); });
socket.on("chatList",chats=>{ els.chatList.innerHTML=""; chats.forEach(c=>{ const li=document.createElement("li");li.textContent=c.replace("__"," / "); li.addEventListener("click",()=>openChat(c)); els.chatList.appendChild(li); }); });
socket.on("chatHistory",({chatId,msgs})=>{ els.messages.innerHTML=""; currentChat=chatId; els.chatTitle.textContent=chatId.replace("__"," / "); msgs.forEach(m=>renderMessage(m,myName)); });
socket.on("message",({chatId,msg})=>{ if(chatId===currentChat) renderMessage(msg,myName); });
function startChat(friend){ socket.emit("startChat",{friend}); }
function openChat(chatId){ socket.emit("startChat",{friend:chatId.split("__").filter(n=>n!==myName)[0]}); }
