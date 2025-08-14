import React, { useEffect, useRef, useState } from 'react';
import EmojiPicker from './EmojiPicker.jsx';
import StickerPicker from './StickerPicker.jsx';
import ReactionsBar from './ReactionsBar.jsx';

export default function ChatView({ api, token, user, chatId, socket }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [typingUsers, setTypingUsers] = useState(new Set());
  const endRef = useRef(null);
  const fileRef = useRef();

  const load = async () => {
    const res = await fetch(`${api}/api/messages?chatId=${chatId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    setMessages(data);
    if (data.length) {
      const lastId = data[data.length - 1].id;
      await fetch(`${api}/api/chats/read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ chatId, lastMessageId: lastId })
      });
    }
  };

  useEffect(() => { load(); }, [chatId]);

  useEffect(() => {
    if (!socket) return;
    const onMsg = (m) => {
      if (m.chat_id === chatId) setMessages(prev => [...prev, m]);
    };
    const onTyping = ({ chatId: c, userId, typing }) => {
      if (c !== chatId || userId === user.id) return;
      setTypingUsers(prev => {
        const s = new Set(prev);
        if (typing) s.add(userId); else s.delete(userId);
        return s;
      });
      if (typing) setTimeout(() => {
        setTypingUsers(prev => { const s=new Set(prev); s.delete(userId); return s; });
      }, 3000);
    };
    const onReaction = (rec) => {
      setMessages(prev => prev.map(m => m.id===rec.messageId ? {...m, _reactions: [...(m._reactions||[]), rec]} : m));
    };
    const onRead = ({ chatId: c, userId, lastMessageId }) => {
      if (c !== chatId) return;
      setMessages(prev => prev.map(m => m.id <= lastMessageId ? {...m, _readBy: [...new Set([...(m._readBy||[]), userId])]} : m));
    };
    socket.on('message', onMsg);
    socket.on('typing', onTyping);
    socket.on('reaction', onReaction);
    socket.on('read', onRead);
    return () => {
      socket.off('message', onMsg);
      socket.off('typing', onTyping);
      socket.off('reaction', onReaction);
      socket.off('read', onRead);
    };
  }, [socket, chatId, user.id]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const sendText = async () => {
    const content = text.trim();
    if (!content) return;
    await fetch(`${api}/api/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ chatId, content })
    });
    setText('');
  };

  const sendFile = async (file) => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('chatId', chatId);
    await fetch(`${api}/api/messages/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: fd
    });
  };

  const onFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) sendFile(file);
    e.target.value = '';
  };

  const sendSticker = async (url) => {
    await fetch(`${api}/api/messages/sticker`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ chatId, url })
    });
  };

  const react = async (messageId, emoji) => {
    await fetch(`${api}/api/messages/react`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ messageId, emoji })
    });
  };

  return (
    <div className="flex-1 flex flex-col">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3">
        {messages.map(m => (
          <div key={m.id} className={`flex mb-2 ${m.sender_id===user.id?'justify-end':''}`}>
            <div className={`max-w-[75%] rounded-2xl px-3 py-2 shadow text-sm ${m.sender_id===user.id?'bg-blue-600 text-white':'bg-white dark:bg-gray-800 dark:text-gray-100'}`}>
              <div className="flex items-center gap-2 mb-1 opacity-80 text-xs">
                {m.sender_avatar ? <img src={m.sender_avatar} className="w-5 h-5 rounded-full" /> : <div className="w-5 h-5 rounded-full bg-gray-300" />}
                <div>{m.sender_username}</div>
              </div>
              {m.type==='text' && <div>{m.content}</div>}
              {m.type==='image' && <div className="mt-1"><img src={m.file_url} className="rounded-xl max-w-full" /></div>}
              {m.type==='file' && <div className="mt-1">
                <a href={m.file_url} target="_blank" className="underline">{m.content || 'File'}</a>
              </div>}
              {m.type==='sticker' && <div className="mt-1"><img src={m.file_url} className="w-40 h-40" /></div>}
              {/* Reactions */}
              <div className="mt-1 flex gap-1 flex-wrap">
                {(m._reactions||[]).map((r,i) => <span key={i} className="text-base">{r.emoji}</span>)}
              </div>
              <div className="mt-1 text-[10px] opacity-70 flex items-center gap-1">
                <span>{new Date(m.created_at).toLocaleTimeString()}</span>
                {/* double check if read by someone (simplified) */}
                <span>{(m._readBy||[]).length>0 ? '✔✔' : '✔'}</span>
              </div>
              <ReactionsBar onReact={(emoji)=>react(m.id, emoji)} />
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {/* Typing indicator */}
      {typingUsers.size>0 && (
        <div className="px-4 pb-1 text-xs text-gray-500 dark:text-gray-400">{typingUsers.size===1 ? 'Someone is typing…' : 'Multiple people are typing…'}</div>
      )}

      {/* Composer */}
      <div className="p-3 bg-white dark:bg-gray-800 border-t dark:border-gray-700 flex gap-2 items-end">
        <EmojiPicker onSelect={(emoji) => setText(t => (t + emoji))} />
        <button onClick={()=>fileRef.current.click()} className="px-2 py-1 rounded-xl border dark:border-gray-600">📎</button>
        <input ref={fileRef} type="file" className="hidden" onChange={onFileChange} />
        <StickerPicker api={api} onSend={sendSticker} />
        <textarea
          value={text}
          onChange={e => {
            setText(e.target.value);
            socket?.emit('typing', { chatId, typing: true });
          }}
          rows={1}
          placeholder="Write a message"
          className="flex-1 border dark:border-gray-600 rounded-2xl p-3 max-h-40 dark:bg-gray-700 dark:text-white"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault(); sendText();
            }
          }}
        />
        <button onClick={sendText} className="px-4 py-2 rounded-2xl bg-blue-600 text-white font-semibold">Send</button>
      </div>
    </div>
  );
}
