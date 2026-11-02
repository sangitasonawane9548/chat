import React from 'react';
import { BarChart3, Activity, HardDrive, Phone, MessageSquare, Clock, Zap } from 'lucide-react';
import PageTransition from '@/components/common/PageTransition';
import AdminStatCard from '@/components/admin/AdminStatCard';

export const AdminAnalytics = () => {
  const messageDistribution = [
    { label: 'Direct Messages', percent: 64, count: '3,130 msgs', color: 'bg-brand-primary' },
    { label: 'Group Messages', percent: 26, count: '1,271 msgs', color: 'bg-brand-secondary' },
    { label: 'Voice Notes (WebM)', percent: 6, count: '293 notes', color: 'bg-purple-500' },
    { label: 'Media Attachments', percent: 4, count: '198 files', color: 'bg-amber-400' }
  ];

  const hourlyActivity = [
    { hour: '00:00', load: 15 },
    { hour: '03:00', load: 8 },
    { hour: '06:00', load: 22 },
    { hour: '09:00', load: 68 },
    { hour: '12:00', load: 85 },
    { hour: '15:00', load: 94 },
    { hour: '18:00', load: 100 },
    { hour: '21:00', load: 88 },
  ];

  return (
    <PageTransition className="space-y-6 max-w-7xl mx-auto min-w-0">
      <div>
        <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
          <span>Platform Telemetry & Analytics</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-brand-secondary/15 text-brand-secondary border border-brand-secondary/30">
            Real-Time Data
          </span>
        </h2>
        <p className="text-xs text-brand-muted mt-0.5">
          System volume, WebRTC call minutes, bandwidth utilization and active usage patterns
        </p>
      </div>

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-4 gap-4">
        <AdminStatCard
          title="Total Messages"
          value="4,892"
          change="+24.2%"
          isPositive={true}
          icon={MessageSquare}
          color="primary"
          subtitle="Past 30 days"
        />
        <AdminStatCard
          title="WebRTC Minutes"
          value="1,420 min"
          change="+31.5%"
          isPositive={true}
          icon={Phone}
          color="secondary"
          subtitle="Zero relay lag"
        />
        <AdminStatCard
          title="Attachment Storage"
          value="1.84 GB"
          change="84% free"
          isPositive={true}
          icon={HardDrive}
          color="amber"
          subtitle="Local file store"
        />
        <AdminStatCard
          title="P99 Signaling Latency"
          value="18 ms"
          change="Optimal"
          isPositive={true}
          icon={Zap}
          color="primary"
          subtitle="Socket.IO ping"
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Message Type Distribution */}
        <div className="glass-card rounded-2xl p-5 border border-brand-border space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-brand-border">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-brand-primary" />
              <span>Traffic Distribution</span>
            </h3>
            <span className="text-xs text-brand-subtle">4,892 total messages</span>
          </div>

          <div className="space-y-4 text-xs">
            {messageDistribution.map((item) => (
              <div key={item.label} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white">{item.label}</span>
                  <span className="font-mono text-brand-subtle">{item.count} ({item.percent}%)</span>
                </div>
                <div className="w-full bg-white/5 h-2.5 rounded-full overflow-hidden">
                  <div
                    className={`${item.color} h-full rounded-full transition-all duration-500`}
                    style={{ width: `${item.percent}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Peak Activity Hours */}
        <div className="glass-card rounded-2xl p-5 border border-brand-border space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-brand-border">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-brand-secondary" />
              <span>Peak Network Load (24-Hour)</span>
            </h3>
            <span className="text-xs text-brand-secondary font-mono font-bold">Peak: 18:00 - 21:00</span>
          </div>

          <div className="flex items-end justify-between h-44 pt-6 px-2 gap-2 text-[10px] text-brand-subtle">
            {hourlyActivity.map((bar) => (
              <div key={bar.hour} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                <span className="text-[9px] font-mono font-semibold text-white">{bar.load}%</span>
                <div className="w-full bg-white/5 rounded-t-lg overflow-hidden flex flex-col justify-end h-28">
                  <div
                    className="w-full bg-gradient-to-t from-brand-primary to-brand-secondary rounded-t-lg transition-all duration-300"
                    style={{ height: `${bar.load}%` }}
                  />
                </div>
                <span className="font-mono">{bar.hour}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </PageTransition>
  );
};

export default AdminAnalytics;

