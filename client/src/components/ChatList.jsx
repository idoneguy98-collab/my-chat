import React, { useEffect, useState } from 'react';

function ChatItem({ chat, active, onClick }) {
  const preview = chat.last_type === 'image' ? '📷 Photo'
    : chat.last_type === 'file' ? '📎 File'
    : chat.last_type === 'sticker' ? '😊 Sticker'
    : (chat.last_message || 'No messages yet');
  return (
    <button onClick={onClick} className={`w-full text-left px-4 py-3 border-b hover:bg-gray-50 dark:hover:bg-gray-800 ${active?'bg-blue-50 dark:bg-blue-900/30':''}`}>
      <div className="flex items-center justify-between">
        <div className="font-medium text-gray-900 dark:text-gray-100">{chat.title || (chat.is_group ? 'Group' : 'Direct chat')}</div>
        {chat.unread_count > 0 && (
          <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-blue-600 text-white">{chat.unread_count}</span>
        )}
      </div>
      <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{preview}</div>
    </button>
  );
}

export default function ChatList({ api, token, chats, activeChatId, setActiveChatId }) {
  const [users, setUsers] = useState([]);
  const [query, setQuery] = useState('');
  useEffect(() => {
    (async () => {
      const res = await fetch(`${api}/api/users`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setUsers(data);
    })();
  }, [api, token]);

  const startDM = async (peerId) => {
    const res = await fetch(`${api}/api/chats/dm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ peerId })
    });
    const data = await res.json();
    setActiveChatId(data.chatId);
  };

  const filteredChats = chats.filter(c => (c.title || '').toLowerCase().includes(query.toLowerCase()));
  return (
    <div className="w-80 bg-white dark:bg-gray-850 bg-white border-r border-gray-200 dark:border-gray-800 hidden md:flex flex-col">
      <div className="p-3 border-b dark:border-gray-800">
        <input className="w-full border dark:border-gray-700 rounded-xl p-2 dark:bg-gray-800 dark:text-white" placeholder="Search"
          value={query} onChange={e=>setQuery(e.target.value)} />
      </div>
      <div className="overflow-y-auto">
        {filteredChats.map(c => (
          <ChatItem key={c.id} chat={c} active={activeChatId===c.id} onClick={()=>setActiveChatId(c.id)} />
        ))}
      </div>
      <div className="p-3 text-xs text-gray-500 dark:text-gray-400 border-t dark:border-gray-800">Start DM:</div>
      <div className="overflow-y-auto">
        {users.map(u => (
          <button key={u.id} onClick={()=>startDM(u.id)} className="w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-800">@{u.username}</button>
        ))}
      </div>
    </div>
  );
}
