import React from 'react';
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';

export const RequestTabs = ({ activeTab, onTabChange, incomingCount = 0, sentCount = 0 }) => {
  return (
    <div className="flex items-center gap-2 border-b border-brand-border/60 pb-3 text-xs">
      <button
        onClick={() => onTabChange('incoming')}
        className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all ${
          activeTab === 'incoming'
            ? 'bg-brand-primary text-white shadow-glow-primary'
            : 'text-brand-muted hover:text-white hover:bg-white/5'
        }`}
      >
        <ArrowDownLeft className="w-3.5 h-3.5" />
        <span>Incoming Requests</span>
        {incomingCount > 0 && (
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
              activeTab === 'incoming' ? 'bg-white text-brand-primary' : 'bg-brand-primary text-white'
            }`}
          >
            {incomingCount}
          </span>
        )}
      </button>

      <button
        onClick={() => onTabChange('sent')}
        className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all ${
          activeTab === 'sent'
            ? 'bg-brand-primary text-white shadow-glow-primary'
            : 'text-brand-muted hover:text-white hover:bg-white/5'
        }`}
      >
        <ArrowUpRight className="w-3.5 h-3.5" />
        <span>Sent Requests</span>
        {sentCount > 0 && (
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
              activeTab === 'sent' ? 'bg-white text-brand-primary' : 'bg-white/10 text-brand-muted'
            }`}
          >
            {sentCount}
          </span>
        )}
      </button>
    </div>
  );
};

export default RequestTabs;

