import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldAlert,
  Copy,
  Check,
  X,
  ExternalLink,
  Smartphone,
  Lock,
  Terminal,
  Zap,
  HelpCircle
} from 'lucide-react';
import Button from '@/components/ui/Button';
import { notify } from '@/components/common/ToastProvider';

export const MediaSecurityModal = ({ notice, onDismiss }) => {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState('flag'); // 'flag' | 'https' | 'adb'

  if (!notice) return null;

  const currentOrigin = notice.origin || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173');

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(currentOrigin);
      setCopied(true);
      notify.success('Dev URL copied to clipboard');
      setTimeout(() => setCopied(false), 2500);
    } catch (_) {
      notify.info(`URL: ${currentOrigin}`);
    }
  };

  const handleCopyFlag = async () => {
    try {
      await navigator.clipboard.writeText('chrome://flags/#unsafely-treat-insecure-origin-as-secure');
      notify.success('Chrome Flag URL copied');
    } catch (_) {}
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 xs:p-4 sm:p-6 bg-black/80 backdrop-blur-md overflow-y-auto"
      onClick={onDismiss}
    >
      <motion.div
        initial={{ scale: 0.94, opacity: 0, y: 15 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.94, opacity: 0, y: 15 }}
        transition={{ type: 'spring', damping: 25, stiffness: 350 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-3xl bg-brand-card border border-amber-500/30 p-5 sm:p-7 shadow-2xl relative text-brand-text my-auto select-none"
      >
        {/* Close Button */}
        <button
          onClick={onDismiss}
          className="absolute top-4 right-4 p-2 rounded-xl text-brand-muted hover:text-brand-text hover:bg-white/5 transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Icon + Title */}
        <div className="flex items-start gap-3.5 mb-4">
          <div className="w-11 h-11 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 shadow-lg shadow-amber-500/10">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                Mobile WebRTC Media Access
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-amber-500/20 text-amber-400 border border-amber-500/30">
                Action Required
              </span>
            </div>
            <p className="text-xs text-brand-muted mt-0.5 leading-relaxed">
              Mobile browsers block camera and microphone on plain <code className="text-amber-300 font-mono text-[11px]">http://</code> network origins.
            </p>
          </div>
        </div>

        {/* Root Cause Explanation */}
        <div className="p-3.5 rounded-2xl bg-amber-950/20 border border-amber-500/20 text-xs space-y-1.5 text-amber-200/90 mb-4 leading-relaxed">
          <div className="flex items-center gap-1.5 font-semibold text-amber-300">
            <Lock className="w-3.5 h-3.5 shrink-0" />
            <span>Why did this error happen?</span>
          </div>
          <p className="text-[11px] text-brand-muted">
            Modern mobile browsers (Chrome Android, Safari iOS) strictly hide <code className="text-white font-mono">navigator.mediaDevices</code> on unencrypted local IP addresses (<code className="text-white font-mono">{currentOrigin}</code>). WebRTC requires a <strong className="text-white font-semibold">Secure Context</strong>.
          </p>
        </div>

        {/* Tab Selection */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-brand-surface border border-brand-border mb-4 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('flag')}
            className={`flex-1 py-1.5 px-2 rounded-lg transition-all text-center flex items-center justify-center gap-1.5 ${
              activeTab === 'flag'
                ? 'bg-amber-500 text-black shadow-sm font-bold'
                : 'text-brand-muted hover:text-white'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Chrome Flag</span>
            <span className="text-[9px] uppercase px-1 py-0.2 bg-black/20 rounded font-bold">Fastest</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('https')}
            className={`flex-1 py-1.5 px-2 rounded-lg transition-all text-center flex items-center justify-center gap-1.5 ${
              activeTab === 'https'
                ? 'bg-amber-500 text-black shadow-sm font-bold'
                : 'text-brand-muted hover:text-white'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Vite HTTPS</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('adb')}
            className={`flex-1 py-1.5 px-2 rounded-lg transition-all text-center flex items-center justify-center gap-1.5 ${
              activeTab === 'adb'
                ? 'bg-amber-500 text-black shadow-sm font-bold'
                : 'text-brand-muted hover:text-white'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>USB Port Forward</span>
          </button>
        </div>

        {/* Tab 1: Chrome Flag */}
        {activeTab === 'flag' && (
          <div className="space-y-3 text-xs">
            <p className="text-brand-muted text-[11px]">
              For Chrome on Android, treat your local development IP as secure in under 30 seconds:
            </p>
            <ol className="space-y-2 list-decimal list-inside text-brand-text/90 text-xs">
              <li className="leading-relaxed">
                <span>In mobile Chrome, open a new tab and go to:</span>
                <div className="mt-1 flex items-center gap-2 p-2 rounded-xl bg-brand-surface border border-brand-border font-mono text-[11px] text-amber-300">
                  <span className="truncate">chrome://flags/#unsafely-treat-insecure-origin-as-secure</span>
                  <button
                    onClick={handleCopyFlag}
                    className="ml-auto p-1 text-brand-muted hover:text-white shrink-0"
                    title="Copy Flag URL"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              </li>
              <li className="leading-relaxed">
                <span>Under <strong className="text-white">"Insecure origins treated as secure"</strong>, enter your current URL:</span>
                <div className="mt-1 flex items-center justify-between p-2 rounded-xl bg-brand-surface border border-brand-border font-mono text-[11px] text-white">
                  <span className="truncate">{currentOrigin}</span>
                  <button
                    onClick={handleCopyUrl}
                    className="ml-2 px-2 py-0.5 rounded-lg bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 font-sans font-semibold text-[10px] flex items-center gap-1 shrink-0"
                  >
                    {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    <span>{copied ? 'Copied' : 'Copy URL'}</span>
                  </button>
                </div>
              </li>
              <li className="leading-relaxed">
                Change dropdown to <strong className="text-emerald-400">Enabled</strong> and tap <strong className="text-amber-300">Relaunch</strong>.
              </li>
            </ol>
          </div>
        )}

        {/* Tab 2: Vite HTTPS */}
        {activeTab === 'https' && (
          <div className="space-y-3 text-xs">
            <p className="text-brand-muted text-[11px]">
              Run the frontend with self-signed SSL certificates directly:
            </p>
            <div className="p-2.5 rounded-xl bg-brand-surface border border-brand-border font-mono text-[11px] text-amber-300 flex items-center justify-between">
              <span>npm --prefix frontend run dev:https</span>
            </div>
            <p className="text-brand-muted text-[11px] leading-relaxed">
              Then on your phone, open <code className="text-white font-mono">https://{notice.hostname || 'your-ip'}:5173</code> and tap <em>"Advanced → Proceed"</em> once to accept the local dev certificate. Camera & microphone will work automatically!
            </p>
          </div>
        )}

        {/* Tab 3: ADB Reverse */}
        {activeTab === 'adb' && (
          <div className="space-y-3 text-xs">
            <p className="text-brand-muted text-[11px]">
              Connect your Android phone to your PC with a USB cable and reverse-forward port 5173:
            </p>
            <div className="p-2.5 rounded-xl bg-brand-surface border border-brand-border font-mono text-[11px] text-amber-300">
              adb reverse tcp:5173 tcp:5173
            </div>
            <p className="text-brand-muted text-[11px] leading-relaxed">
              Now on mobile Chrome, simply open <code className="text-white font-mono">http://localhost:5173</code>! Because it is <code className="text-amber-300 font-mono">localhost</code>, Chrome treats it as an authorized secure context and camera calling works with zero flags.
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="mt-6 pt-4 border-t border-brand-border flex flex-col xs:flex-row items-center justify-end gap-2.5">
          <Button
            size="sm"
            variant="outline"
            onClick={handleCopyUrl}
            leftIcon={copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            className="w-full xs:w-auto text-xs"
          >
            {copied ? 'Copied URL!' : 'Copy Current URL'}
          </Button>
          <Button
            size="sm"
            variant="primary"
            onClick={onDismiss}
            className="w-full xs:w-auto text-xs bg-amber-500 hover:bg-amber-600 text-black font-bold border-none"
          >
            Got It
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default MediaSecurityModal;

