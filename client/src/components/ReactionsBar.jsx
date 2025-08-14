import React, { useState } from 'react';

const EMOJIS = ['👍','❤️','😂','😮','😢','🔥'];

export default function ReactionsBar({ onReact }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-1">
      <button className="text-xs opacity-70 underline" onClick={()=>setOpen(o=>!o)}>React</button>
      {open && (
        <div className="mt-1 flex gap-1">
          {EMOJIS.map(e => (
            <button key={e} onClick={()=>{ onReact(e); setOpen(false); }} className="text-lg">{e}</button>
          ))}
        </div>
      )}
    </div>
  );
}
