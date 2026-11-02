import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, X, Clock, User, MessageSquare } from 'lucide-react';
import Avatar from '@/components/ui/Avatar';
import Button from '@/components/ui/Button';

export const RequestCard = ({
  request,
  type = 'incoming', // 'incoming' or 'sent'
  onAccept,
  onDecline,
  onCancel
}) => {
  const navigate = useNavigate();
  const [loadingAction, setLoadingAction] = useState(false);

  const formattedDate = new Date(request.created_at).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const handleAccept = async () => {
    try {
      setLoadingAction(true);
      await onAccept(request.id);
    } finally {
      setLoadingAction(false);
    }
  };

  const handleDecline = async () => {
    try {
      setLoadingAction(true);
      await onDecline(request.id);
    } finally {
      setLoadingAction(false);
    }
  };

  const handleCancel = async () => {
    try {
      setLoadingAction(true);
      await onCancel(request.id);
    } finally {
      setLoadingAction(false);
    }
  };

  return (
    <div className="glass-card rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-brand-border hover:border-brand-border-strong transition-all">
      <div
        onClick={() => navigate(`/profile/${request.username}`)}
        className="flex items-center gap-3.5 cursor-pointer group min-w-0"
      >
        <Avatar
          name={request.full_name}
          src={request.profile_picture}
          size="lg"
          shape="rounded"
          status={request.is_online ? 'online' : null}
        />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold text-white group-hover:text-brand-primary transition-colors truncate">
              {request.full_name}
            </h4>
            {request.is_online && (
              <span className="w-1.5 h-1.5 rounded-full bg-brand-online" title="Online" />
            )}
          </div>
          <p className="text-xs text-brand-secondary font-medium truncate">
            @{request.username}
          </p>
          <p className="text-[11px] text-brand-subtle flex items-center gap-1.5 mt-1">
            <Clock className="w-3 h-3" />
            <span>Requested {formattedDate}</span>
          </p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2 self-end sm:self-center shrink-0 flex-wrap sm:flex-nowrap justify-end">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(`/profile/${request.username}`)}
          leftIcon={<User className="w-3.5 h-3.5" />}
        >
          View
        </Button>

        {type === 'incoming' ? (
          <>
            <Button
              variant="outline"
              size="sm"
              isLoading={loadingAction}
              onClick={handleDecline}
              leftIcon={<X className="w-3.5 h-3.5" />}
              className="text-brand-danger border-brand-danger/30 hover:bg-brand-danger/10"
            >
              Decline
            </Button>
            <Button
              variant="primary"
              size="sm"
              isLoading={loadingAction}
              onClick={handleAccept}
              leftIcon={<Check className="w-3.5 h-3.5" />}
            >
              Accept
            </Button>
          </>
        ) : (
          <Button
            variant="outline"
            size="sm"
            isLoading={loadingAction}
            onClick={handleCancel}
            leftIcon={<X className="w-3.5 h-3.5" />}
          >
            Cancel Request
          </Button>
        )}
      </div>
    </div>
  );
};

export default RequestCard;

