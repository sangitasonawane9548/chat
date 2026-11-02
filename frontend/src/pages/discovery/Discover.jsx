import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Sparkles, Users, Info, ShieldCheck } from 'lucide-react';
import PageTransition from '@/components/common/PageTransition';
import UserSearchBar from '@/components/discovery/UserSearchBar';
import UserSearchResults from '@/components/discovery/UserSearchResults';
import UserCard from '@/components/discovery/UserCard';
import UserSkeleton from '@/components/discovery/UserSkeleton';
import EmptyState from '@/components/common/EmptyState';
import { searchUsers, getUserSuggestions } from '@/services/api';

export const Discover = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') || '';

  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, limit: 12, total: 0, totalPages: 0 });
  const [error, setError] = useState('');

  // Load suggested users on mount
  useEffect(() => {
    const loadSuggestions = async () => {
      try {
        setLoadingSuggestions(true);
        const data = await getUserSuggestions();
        if (data.success) {
          setSuggestions(data.users || []);
        }
      } catch (err) {
        // Ignore background suggestion load errors
      } finally {
        setLoadingSuggestions(false);
      }
    };
    loadSuggestions();
  }, []);

  // Perform debounced search
  const performSearch = useCallback(async (searchQuery, pageNum = 1, append = false) => {
    const clean = searchQuery.replace(/^@/, '').trim();
    if (!clean) {
      setResults([]);
      setPagination({ page: 1, limit: 12, total: 0, totalPages: 0 });
      return;
    }

    try {
      if (pageNum === 1) setLoading(true);
      else setLoadingMore(true);
      setError('');

      const res = await searchUsers(clean, pageNum, 12);
      if (res.success) {
        setResults((prev) => (append ? [...prev, ...(res.users || [])] : res.users || []));
        setPagination(res.pagination);
      }
    } catch (err) {
      setError(err.message || 'Error searching users');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  // Debounced search on query change
  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.trim()) {
        setSearchParams({ q: query.trim() }, { replace: true });
        performSearch(query, 1, false);
      } else {
        setSearchParams({}, { replace: true });
        setResults([]);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [query, performSearch, setSearchParams]);

  const handleClear = () => {
    setQuery('');
    setResults([]);
    setSearchParams({});
  };

  const handleLoadMore = () => {
    if (pagination.page < pagination.totalPages) {
      performSearch(query, pagination.page + 1, true);
    }
  };

  const handleStatusChange = (userId, newStatus, newRequestId, newConversationId) => {
    setResults((prev) =>
      prev.map((u) =>
        u.id === userId
          ? {
              ...u,
              relationship: newStatus,
              request_id: newRequestId !== undefined ? newRequestId : u.request_id,
              conversation_id: newConversationId || u.conversation_id
            }
          : u
      )
    );
    setSuggestions((prev) =>
      prev.map((u) =>
        u.id === userId
          ? {
              ...u,
              relationship: newStatus,
              request_id: newRequestId !== undefined ? newRequestId : u.request_id,
              conversation_id: newConversationId || u.conversation_id
            }
          : u
      )
    );
  };

  return (
    <PageTransition className="p-4 sm:p-8 max-w-5xl mx-auto space-y-8">
      {/* Header section */}
      <div className="flex flex-col items-center text-center space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-primary/10 border border-brand-primary/20 text-brand-primary text-xs font-semibold">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Username Directory</span>
        </div>

        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold font-display text-brand-text tracking-tight">
            Discover People
          </h1>
          <p className="text-xs sm:text-sm text-brand-muted mt-1 max-w-md mx-auto">
            Find and connect with other users across the encrypted network using their unique @username
          </p>
        </div>

        {/* Prominent Search Bar */}
        <UserSearchBar
          value={query}
          onChange={setQuery}
          onClear={handleClear}
          isLoading={loading}
          placeholder="Search by @username or full name..."
        />

        {/* Search Tips */}
        <div className="flex flex-wrap items-center justify-center gap-2 text-[11px] text-brand-subtle">
          <span className="flex items-center gap-1">
            <Info className="w-3 h-3 text-brand-secondary" />
            <span>Case-insensitive</span>
          </span>
          <span>•</span>
          <span>Type @handle for exact match</span>
          <span>•</span>
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3 h-3 text-brand-primary" />
            <span>Private emails hidden</span>
          </span>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="space-y-6">
        {loading ? (
          <UserSkeleton count={6} />
        ) : query.trim() ? (
          <UserSearchResults
            users={results}
            query={query}
            onStatusChange={handleStatusChange}
            pagination={pagination}
            onLoadMore={handleLoadMore}
            isLoadingMore={loadingMore}
          />
        ) : (
          /* Suggestions view when search is empty */
          <div className="space-y-6">
            <div className="flex items-center justify-between pb-2 border-b border-brand-border/60">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-brand-primary" />
                <h3 className="text-sm font-semibold text-brand-text">Suggested People</h3>
              </div>
              <span className="text-xs text-brand-subtle">
                Publicly discoverable accounts
              </span>
            </div>

            {loadingSuggestions ? (
              <UserSkeleton count={4} />
            ) : suggestions.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {suggestions.map((u) => (
                  <UserCard
                    key={u.id}
                    user={u}
                    onStatusChange={handleStatusChange}
                  />
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<Users className="w-8 h-8 text-brand-primary" />}
                title="Start Searching"
                description="Type any username in the search bar above to discover people and initiate one-to-one encrypted chats."
              />
            )}
          </div>
        )}
      </div>
    </PageTransition>
  );
};

export default Discover;

