import React, { useState } from 'react';
import { Picker } from 'emoji-mart';
import 'emoji-mart/css/emoji-mart.css';

export default function EmojiPicker({ onSelect }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button className="px-2 py-1 rounded-xl border dark:border-gray-600" onClick={() => setOpen(o => !o)}>😊</button>
      {open && (
        <div className="absolute bottom-12 z-20">
          <Picker onSelect={(emoji) => { onSelect(emoji.native); setOpen(false); }} />
        </div>
      )}
    </div>
  );
}
