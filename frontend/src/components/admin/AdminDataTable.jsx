import React from 'react';
import { ChevronLeft, ChevronRight, Inbox, Search } from 'lucide-react';
import Button from '@/components/ui/Button';

export const AdminDataTable = ({
  columns = [],
  data = [],
  loading = false,
  emptyMessage = 'No records found',
  pagination,
  onPageChange,
  searchQuery = '',
  onSearchChange,
  searchPlaceholder = 'Search records...',
  headerActions
}) => {
  return (
    <div className="glass-card rounded-2xl border border-brand-border overflow-hidden flex flex-col w-full min-w-0">
      {/* Table Toolbar */}
      {(onSearchChange || headerActions) && (
        <div className="p-3.5 sm:p-4 border-b border-brand-border/60 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-brand-bg/40">
          {onSearchChange && (
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-brand-subtle" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-brand-surface text-brand-text placeholder-brand-subtle rounded-xl border border-brand-border focus:outline-none focus:border-brand-primary/60 transition-all"
              />
            </div>
          )}

          {headerActions && (
            <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
              {headerActions}
            </div>
          )}
        </div>
      )}

      {/* Responsive Scrollable Container */}
      <div className="table-responsive w-full overflow-x-auto min-w-0">
        <table className="w-full text-left border-collapse text-xs select-none">
          <thead>
            <tr className="border-b border-brand-border bg-brand-bg/60 text-[11px] font-semibold uppercase tracking-wider text-brand-subtle">
              {columns.map((col, idx) => (
                <th
                  key={col.key || idx}
                  className={`px-4 py-3 whitespace-nowrap ${col.className || ''}`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-brand-border/30">
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="py-12 text-center text-brand-muted">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <div className="w-6 h-6 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" />
                    <span>Loading data records...</span>
                  </div>
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="py-12 text-center text-brand-subtle">
                  <div className="flex flex-col items-center justify-center gap-1.5">
                    <Inbox className="w-7 h-7 text-brand-muted opacity-60" />
                    <span className="font-medium text-xs">{emptyMessage}</span>
                  </div>
                </td>
              </tr>
            ) : (
              data.map((row, rowIdx) => (
                <tr
                  key={row.id || rowIdx}
                  className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors group"
                >
                  {columns.map((col, colIdx) => (
                    <td
                      key={col.key || colIdx}
                      className={`px-4 py-3 whitespace-nowrap align-middle ${col.className || ''}`}
                    >
                      {col.render ? col.render(row, rowIdx) : row[col.key]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {pagination && pagination.totalPages > 1 && (
        <div className="p-3 sm:p-4 border-t border-brand-border/60 flex items-center justify-between gap-3 text-xs bg-brand-bg/40 shrink-0">
          <span className="text-[11px] text-brand-subtle">
            Showing Page <strong className="text-brand-text">{pagination.page}</strong> of <strong className="text-brand-text">{pagination.totalPages}</strong> ({pagination.total} records)
          </span>

          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant="ghost"
              disabled={pagination.page <= 1}
              onClick={() => onPageChange?.(pagination.page - 1)}
              leftIcon={<ChevronLeft className="w-3.5 h-3.5" />}
              className="text-xs"
            >
              Prev
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => onPageChange?.(pagination.page + 1)}
              rightIcon={<ChevronRight className="w-3.5 h-3.5" />}
              className="text-xs"
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDataTable;

