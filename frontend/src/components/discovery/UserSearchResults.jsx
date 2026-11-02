import React from 'react';
import { SearchX, Sparkles, ChevronDown } from 'lucide-react';
import UserCard from './UserCard';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/common/EmptyState';

export const UserSearchResults = ({
  users,
  query,
  onStatusChange,
  pagination,
  onLoadMore,
  isLoadingMore
}) => {
  if (users.length === 0) {
    return (
      <EmptyState
        icon={<SearchX className="w-8 h-8 text-brand-muted" />}
        title="No users found"
        description={`We couldn't find any registered accounts matching "${query}". Check the spelling or search for an exact @username.`}
      />
    );
  }

  const hasMore = pagination && pagination.page < pagination.totalPages;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between text-xs text-brand-muted px-1">
        <span>
          Found <strong className="text-white">{pagination?.total || users.length}</strong> matching user{users.length === 1 ? '' : 's'}
        </span>
        <span className="text-brand-subtle text-[11px]">Click a profile to view details</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {users.map((user) => (
          <UserCard
            key={user.id}
            user={user}
            onStatusChange={onStatusChange}
          />
        ))}
      </div>

      {hasMore && (
        <div className="flex justify-center pt-4">
          <Button
            variant="outline"
            size="md"
            onClick={onLoadMore}
            isLoading={isLoadingMore}
            leftIcon={<ChevronDown className="w-4 h-4" />}
          >
            Load More Results
          </Button>
        </div>
      )}
    </div>
  );
};

export default UserSearchResults;

