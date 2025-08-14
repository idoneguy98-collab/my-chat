import React, { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import ChatList from './components/ChatList.jsx';
import ChatView from './components/ChatView.jsx';
import ProfileBar from './components/ProfileBar.jsx';

export default function Messenger({ api, token, user, onLogout }) {
  const [chats, setChats] = useState([]);
  const [activeChatId, setActiveChatId] = useState(1);
  const [presence, setPresence] = useState([]);
  const socketRef = useRef(null);

  const fetchChats = async () => {
    const res = await fetch(`${api}/api/chats`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    setChats(data);
  };

  useEffect(() => { fetchChats(); }, []);

  useEffect(() => {
    socketRef.current = io(api, { auth: { token } });
    socketRef.current.emit('join', activeChatId);
    socketRef.current.on('presence', setPresence);
    socketRef.current.on('message', () => fetchChats());
    socketRef.current.on('read', () => fetchChats());
    return () => { socketRef.current?.disconnect(); };
  }, [api, token, activeChatId]);

  return (
    <div className="h-screen flex bg-gray-100 dark:bg-gray-900">
      <ChatList
        api={api}
        token={token}
        chats={chats}
        setActiveChatId={(id) => {
          socketRef.current?.emit('leave', activeChatId);
          setActiveChatId(id);
          socketRef.current?.emit('join', id);
        }}
        activeChatId={activeChatId}
      />
      <div className="flex-1 flex flex-col">
        <ProfileBar api={api} token={token} user={user} onLogout={onLogout} />
        <ChatView api={api} token={token} user={user} chatId={activeChatId} socket={socketRef.current} />
      </div>
    </div>
  );
}
