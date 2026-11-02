import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import Avatar from '@/components/ui/Avatar';
import ChatRequestButton from '@/components/requests/ChatRequestButton';

export const UserCard = ({ user, onStatusChange }) => {
  const navigate = useNavigate();

  const handleCardClick = () => {
    navigate(`/profile/${user.username}`);
  };

  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ duration: 0.15 }}
      onClick={handleCardClick}
      className="glass-card rounded-2xl p-4 sm:p-5 flex flex-col justify-between border border-brand-border hover:border-brand-border-strong hover:bg-brand-card/90 transition-all cursor-pointer group shadow-sm"
    >
      <div className="flex items-start gap-3.5">
        <div className="relative shrink-0">
          <Avatar
            name={user.full_name}
            src={user.profile_picture}
            size="lg"
            shape="rounded"
            status={user.is_online ? 'online' : null}
          />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <h4 className="text-sm font-semibold text-brand-text truncate group-hover:text-brand-primary transition-colors">
              {user.full_name}
            </h4>
            {user.is_online && (
              <span className="w-1.5 h-1.5 rounded-full bg-brand-online shrink-0" title="Online" />
            )}
          </div>
          <p className="text-xs text-violet-500 font-medium truncate">
            @{user.username}
          </p>

          {user.bio ? (
            <p className="text-xs text-brand-muted mt-2 line-clamp-2 leading-relaxed">
              {user.bio}
            </p>
          ) : (
            <p className="text-xs text-brand-subtle italic mt-2">
              No bio available
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap mt-4 pt-3 border-t border-brand-border/60">
        <span className="text-[11px] text-brand-subtle">
          {user.relationship === 'connected'
            ? '✓ Connected'
            : user.relationship === 'pending_outgoing'
            ? 'Request Sent'
            : user.relationship === 'pending_incoming'
            ? 'Sent you a request'
            : 'Not Connected'}
        </span>

        <ChatRequestButton
          user={user}
          onStatusChange={onStatusChange}
          size="sm"
        />
      </div>
    </motion.div>
  );
};

export default UserCard;

