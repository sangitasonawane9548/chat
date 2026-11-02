import React, { useState } from 'react';
import { ShieldCheck, Plus, Trash2, Sliders, AlertOctagon, Check } from 'lucide-react';
import PageTransition from '@/components/common/PageTransition';
import Button from '@/components/ui/Button';
import { notify } from '@/components/common/ToastProvider';

export const AdminModeration = () => {
  const [bannedKeywords, setBannedKeywords] = useState([
    'free-crypto-giveaway',
    'telegram_bot_invite',
    'discord.gg/scam',
    'credit-card-generator'
  ]);
  const [newKeyword, setNewKeyword] = useState('');
  const [autoMuteThreshold, setAutoMuteThreshold] = useState(5);
  const [linkFiltering, setLinkFiltering] = useState(true);

  const handleAddKeyword = (e) => {
    e.preventDefault();
    if (!newKeyword.trim()) return;
    const clean = newKeyword.trim().toLowerCase();
    if (bannedKeywords.includes(clean)) {
      notify.warning('Keyword already in filter list');
      return;
    }
    setBannedKeywords([...bannedKeywords, clean]);
    setNewKeyword('');
    notify.success(`Keyword "${clean}" added to filter`);
  };

  const handleRemoveKeyword = (kw) => {
    setBannedKeywords(bannedKeywords.filter((k) => k !== kw));
    notify.info(`Removed "${kw}"`);
  };

  const handleSavePolicy = () => {
    notify.success('Automated moderation policy saved');
  };

  return (
    <PageTransition className="space-y-6 max-w-5xl mx-auto min-w-0">
      <div>
        <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
          <span>Automated Moderation & Content Guard</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-purple-500/20 text-purple-400 border border-purple-500/30">
            Active Engine
          </span>
        </h2>
        <p className="text-xs text-brand-muted mt-0.5">
          Proactively protect channels with keyword blacklists, rate limits, and real-time heuristics
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Keyword Blacklist */}
        <div className="glass-card rounded-2xl p-5 border border-brand-border space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-brand-border">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <AlertOctagon className="w-4 h-4 text-brand-danger" />
              <span>Banned Keywords & Regex</span>
            </h3>
            <span className="text-xs text-brand-subtle">{bannedKeywords.length} rules</span>
          </div>

          <form onSubmit={handleAddKeyword} className="flex items-center gap-2">
            <input
              type="text"
              value={newKeyword}
              onChange={(e) => setNewKeyword(e.target.value)}
              placeholder="Add keyword or domain to block..."
              className="flex-1 px-3 py-1.5 text-xs bg-brand-surface text-brand-text rounded-xl border border-brand-border focus:outline-none focus:border-brand-primary"
            />
            <Button size="sm" variant="primary" type="submit" leftIcon={<Plus className="w-3.5 h-3.5" />}>
              Add
            </Button>
          </form>

          <div className="flex flex-wrap gap-2 max-h-56 overflow-y-auto p-2 bg-brand-bg/60 rounded-xl border border-brand-border">
            {bannedKeywords.map((kw) => (
              <span
                key={kw}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-brand-danger/10 border border-brand-danger/25 text-xs text-brand-text"
              >
                <span>{kw}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveKeyword(kw)}
                  className="text-brand-subtle hover:text-brand-text"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        </div>

        {/* Rate Limits & Auto-actions */}
        <div className="glass-card rounded-2xl p-5 border border-brand-border space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-brand-border">
            <h3 className="text-sm font-bold text-brand-text flex items-center gap-2">
              <Sliders className="w-4 h-4 text-brand-primary" />
              <span>Heuristic Thresholds</span>
            </h3>
            <Button size="xs" variant="primary" onClick={handleSavePolicy}>
              Save Rules
            </Button>
          </div>

          <div className="space-y-4 text-xs">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-semibold text-brand-text">Rapid Message Flood Mute Limit</span>
                <span className="font-mono text-brand-secondary font-bold">{autoMuteThreshold} msgs / 3s</span>
              </div>
              <input
                type="range"
                min={3}
                max={15}
                value={autoMuteThreshold}
                onChange={(e) => setAutoMuteThreshold(Number(e.target.value))}
                className="w-full accent-brand-primary"
              />
            </div>

            <div className="p-3 rounded-xl bg-brand-bg/50 border border-brand-border flex items-center justify-between">
              <div>
                <p className="font-semibold text-brand-text">Block Unverified Domain Links</p>
                <p className="text-[11px] text-brand-subtle">Prevent newly registered accounts from posting URLs</p>
              </div>
              <button
                type="button"
                onClick={() => setLinkFiltering(!linkFiltering)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  linkFiltering ? 'bg-brand-primary' : 'bg-white/10'
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  linkFiltering ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </PageTransition>
  );
};

export default AdminModeration;

