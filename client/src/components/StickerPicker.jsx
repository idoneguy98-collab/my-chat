import React, { useEffect, useState } from 'react';

export default function StickerPicker({ api, onSend }) {
  const [open, setOpen] = useState(false);
  const [stickers, setStickers] = useState([]);
  useEffect(() => {
    (async () => {
      const res = await fetch(`${api}/api/stickers`);
      const data = await res.json();
      setStickers(data);
    })();
  }, [api]);
  return (
    <div className="relative">
      <button className="px-2 py-1 rounded-xl border dark:border-gray-600" onClick={() => setOpen(o => !o)}>💟</button>
      {open && (
        <div className="absolute bottom-12 z-20 p-2 bg-white dark:bg-gray-800 rounded-xl shadow grid grid-cols-3 gap-2 border dark:border-gray-700">
          {stickers.map((s, i) => (
            <button key={i} onClick={()=>{ onSend(s); setOpen(false); }}>
              <img src={s} className="w-20 h-20" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
