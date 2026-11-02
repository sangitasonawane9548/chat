import React from 'react';
import { motion } from 'framer-motion';

export const TypingIndicator = ({ username, users = [] }) => {
  let text = 'Typing...';

  const userList = Array.isArray(users) ? users : username ? [username] : [];

  if (userList.length === 1) {
    const name = userList[0];
    text = name.startsWith('@') ? `${name} is typing...` : `@${name} is typing...`;
  } else if (userList.length === 2) {
    const u1 = userList[0].startsWith('@') ? userList[0] : `@${userList[0]}`;
    const u2 = userList[1].startsWith('@') ? userList[1] : `@${userList[1]}`;
    text = `${u1} and ${u2} are typing...`;
  } else if (userList.length >= 3) {
    text = 'Several people are typing...';
  } else if (username) {
    text = `@${username} is typing...`;
  }

  return (
    <div className="flex items-center gap-2 px-3 xs:px-4 py-1.5 text-xs text-brand-muted select-none shrink-0">
      <div className="flex items-center gap-1">
        <motion.span
          className="w-1.5 h-1.5 rounded-full bg-brand-primary"
          animate={{ scale: [1, 1.4, 1], opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1, repeat: Infinity, delay: 0 }}
        />
        <motion.span
          className="w-1.5 h-1.5 rounded-full bg-brand-primary"
          animate={{ scale: [1, 1.4, 1], opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1, repeat: Infinity, delay: 0.2 }}
        />
        <motion.span
          className="w-1.5 h-1.5 rounded-full bg-brand-primary"
          animate={{ scale: [1, 1.4, 1], opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1, repeat: Infinity, delay: 0.4 }}
        />
      </div>
      <span className="font-medium text-brand-primary/90">
        {text}
      </span>
    </div>
  );
};

export default TypingIndicator;


