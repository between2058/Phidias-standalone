'use client';

import Link from 'next/link';
import { Camera, Pencil, Sparkles } from 'lucide-react';
import TopNavBar from '@/components/shared/TopNavBar';
import { usePhidiasStore } from '@/store/phidias-store';

// ─── Data ────────────────────────────────────────────────────────────────────

const quickActions = [
  {
    icon: <Camera size={24} />,
    iconColor: '#4a90d9',
    title: 'Image to 3D',
    subtitle: 'Upload a photo, get a model',
    href: '/workspace/image',
  },
  {
    icon: <Pencil size={24} />,
    iconColor: '#7c5cfc',
    title: 'Text to 3D',
    subtitle: 'Describe any object',
    href: '/workspace/model',
  },
  //   {
  //     icon: <Clapperboard size={24} />,
  //     iconColor: '#4ade80',
  //     title: 'Video to Scene',
  //     subtitle: 'Reconstruct from video',
  //     href: '/workspace/scene',
  //   },
  //   {
  //     icon: <Hexagon size={24} />,
  //     iconColor: '#f87171',
  //     title: 'Retopology',
  //     subtitle: 'Optimize existing mesh',
  //     href: '/workspace/retopo',
  //   },
  //   {
  //     icon: <Globe size={24} />,
  //     iconColor: '#D5B451',
  //     title: 'Build World',
  //     subtitle: 'Arrange assets in 3D',
  //     href: '/workspace/world',
  //   },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HomePage() {
  const hostApp = usePhidiasStore((state) => state.hostApp);
  const user = usePhidiasStore((state) => state.user);
  return (
    <div
      className="flex flex-col min-h-screen"
      style={{ background: '#0A1E35' }}
    >
      {hostApp === 'standalone' && <TopNavBar />}

      {/* Scrollable page content */}
      <div className="flex-1 flex flex-col overflow-y-auto scrollbar-thin">
        {/* ── Hero Section ────────────────────────────────────────────────── */}
        <section className="relative w-full shrink-0" style={{ height: 340 }}>
          {/* Multi-layer background matching design gradients */}
          <div
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(90deg, #0A1E35EE 0%, #0E243ECC 45%, #0E243E88 70%, #0E243E40 100%)',
            }}
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(180deg, #0A1E35FF 0%, #0A1E3500 30%)',
            }}
          />
          <div
            className="absolute inset-0"
            style={{
              background: 'linear-gradient(0deg, #0A1E35DD 0%, #0A1E3500 25%)',
            }}
          />

          {/* Decorative grid lines */}
          <div
            className="absolute pointer-events-none"
            style={{ right: 80, top: 0, bottom: 0, opacity: 0.08 }}
          >
            <svg width="500" height="280" viewBox="0 0 500 280">
              <line
                x1="50"
                y1="80"
                x2="450"
                y2="80"
                stroke="#D5B451"
                strokeWidth="0.5"
              />
              <line
                x1="50"
                y1="140"
                x2="450"
                y2="140"
                stroke="#D5B451"
                strokeWidth="0.5"
              />
              <line
                x1="50"
                y1="200"
                x2="450"
                y2="200"
                stroke="#D5B451"
                strokeWidth="0.5"
              />
              <line
                x1="150"
                y1="40"
                x2="150"
                y2="240"
                stroke="#D5B451"
                strokeWidth="0.5"
              />
              <line
                x1="250"
                y1="40"
                x2="250"
                y2="240"
                stroke="#D5B451"
                strokeWidth="0.5"
              />
              <line
                x1="350"
                y1="40"
                x2="350"
                y2="240"
                stroke="#D5B451"
                strokeWidth="0.5"
              />
            </svg>
          </div>

          {/* Decorative globe rings */}
          {/* <div
                        className="absolute pointer-events-none"
                        style={{ right: 120, top: 30, opacity: 0.12 }}
                    >
                        <div
                            className="rounded-full"
                            style={{ width: 220, height: 220, border: '1.5px solid #D5B451' }}
                        />
                        <div
                            className="absolute rounded-full"
                            style={{
                                width: 140,
                                height: 140,
                                border: '1px solid #D5B451',
                                top: 40,
                                left: 40,
                                opacity: 0.7,
                            }}
                        />
                    </div> */}

          {/* Hero content */}
          <div
            className="relative z-10 flex flex-col gap-4 px-16 justify-center h-full"
            style={{ maxWidth: 600 }}
          >
            <h1 className="text-[32px] font-bold text-white leading-tight">
              Welcome back, {user}
            </h1>
            <p className="text-base" style={{ color: '#8BA4BE' }}>
              Describe it. Scan it. Build with it.
            </p>
            <div className="flex items-center gap-3 pt-2">
              <Link
                href="/workspace/model"
                className="flex items-center gap-2 px-6 py-3 rounded-[10px] text-sm font-semibold transition-opacity hover:opacity-90"
                style={{ background: '#D5B451', color: '#0E243E' }}
              >
                <Sparkles size={18} />
                To Model Workspace
              </Link>
              {/* <Link
                                href="/workspace/scene"
                                className="flex items-center gap-2 px-6 py-3 rounded-[10px] text-sm font-semibold border transition-colors hover:bg-white/5"
                                style={{ borderColor: '#D5B451', color: '#D5B451', borderWidth: 1.5 }}
                            >
                                <Globe size={18} />
                                New Scene
                            </Link> */}
            </div>
          </div>
        </section>

        {/* ── Quick Start ──────────────────────────────────────────────────── */}
        <section className="px-16 pt-7 flex flex-col gap-4">
          <h2 className="text-[18px] font-semibold text-white">Quick Start</h2>
          <div className="grid grid-cols-5 gap-3.5">
            {quickActions.map((action) => (
              <Link
                key={action.href}
                href={action.href}
                className="flex flex-col gap-2 rounded-xl transition-colors cursor-pointer hover:opacity-90"
                style={{
                  background: '#13304F',
                  border: '1px solid #1A3A5A',
                  padding: '20px 16px',
                }}
              >
                <span style={{ color: action.iconColor }}>{action.icon}</span>
                <span className="text-[13px] font-semibold text-white">
                  {action.title}
                </span>
                <span
                  className="text-[11px] leading-tight"
                  style={{ color: '#4D6E8A' }}
                >
                  {action.subtitle}
                </span>
              </Link>
            ))}
          </div>
        </section>

        {/* ── Main Content Area ────────────────────────────────────────────── */}
        <section className="flex gap-7 px-16 py-7">
          {/* Left Column — Recent Projects */}
          {/* <div className="flex flex-col gap-5 flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                            <h2 className="text-[18px] font-semibold text-white">Recent Projects</h2>
                            <button
                                className="text-xs font-medium transition-opacity hover:opacity-80"
                                style={{ color: '#D5B451' }}
                            >
                                View All →
                            </button>
                        </div>

                        <div className="flex flex-col gap-3.5">
                            <div className="flex gap-3.5">
                                {recentProjects.slice(0, 3).map((p) => (
                                    <ProjectCard key={p.id} project={p} />
                                ))}
                            </div>
                            <div className="flex gap-3.5">
                                {recentProjects.slice(3, 6).map((p) => (
                                    <ProjectCard key={p.id} project={p} />
                                ))}
                            </div>
                        </div>
                    </div> */}

          {/* Right Column */}
          <div className="flex flex-col gap-5 shrink-0" style={{ width: 380 }}>
            {/* Recent Activity */}
            {/* <div className="flex flex-col gap-3">
                            <div className="flex items-center justify-between">
                                <h3 className="text-[15px] font-semibold text-white">Recent Activity</h3>
                                <button
                                    className="text-[11px] font-medium transition-opacity hover:opacity-80"
                                    style={{ color: '#D5B451' }}
                                >
                                    View All →
                                </button>
                            </div>
                            <div
                                className="rounded-[10px] overflow-hidden"
                                style={{ background: '#13304F', border: '1px solid #1A3A5A' }}
                            >
                                {activityItems.map((item, i) => (
                                    <div
                                        key={i}
                                        className={cn(
                                            'flex items-center gap-2.5 px-3.5 py-3',
                                            i < activityItems.length - 1 && 'border-b'
                                        )}
                                        style={
                                            i < activityItems.length - 1
                                                ? { borderColor: '#1A3A5A' }
                                                : undefined
                                        }
                                    >
                                        <div
                                            className="flex items-center justify-center rounded-lg shrink-0"
                                            style={{ width: 32, height: 32, background: item.iconBg }}
                                        >
                                            <span style={{ color: item.iconColor }}>{item.icon}</span>
                                        </div>
                                        <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                                            <span className="text-xs text-white truncate">{item.desc}</span>
                                            <span className="text-[10px]" style={{ color: '#4D6E8A' }}>
                                                {item.time}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div> */}

            {/* Usage & Credits */}
            {/* <div
                            className="rounded-xl flex flex-col gap-3.5"
                            style={{
                                background: '#13304F',
                                border: '1px solid #1A3A5A',
                                padding: 18,
                            }}
                        >
                            <h3 className="text-[15px] font-semibold text-white">Usage &amp; Credits</h3>

                            <div className="flex items-center gap-2.5">
                                <span className="text-[36px] font-bold text-white leading-none">300</span>
                                <div className="flex flex-col gap-0.5">
                                    <span className="text-xs" style={{ color: '#8BA4BE' }}>
                                        credits remaining
                                    </span>
                                    <span className="text-[11px] font-medium" style={{ color: '#D5B451' }}>
                                        Upgrade for more
                                    </span>
                                </div>
                            </div>

                            <div className="w-full h-px" style={{ background: '#1A3A5A' }} />

                            <div className="flex flex-col gap-1.5">
                                <div className="flex items-center justify-between">
                                    <span className="text-[11px]" style={{ color: '#8BA4BE' }}>
                                        Credits used this month
                                    </span>
                                    <span className="text-[11px] font-medium text-white">120 / 500</span>
                                </div>
                                <div
                                    className="w-full h-1.5 rounded-full overflow-hidden"
                                    style={{ background: '#183A5A' }}
                                >
                                    <div
                                        className="h-full rounded-full"
                                        style={{
                                            width: '24%',
                                            background: 'linear-gradient(90deg, #D5B451 0%, #7c5cfc 100%)',
                                        }}
                                    />
                                </div>
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <div className="flex items-center justify-between">
                                    <span className="text-[11px]" style={{ color: '#8BA4BE' }}>
                                        Models generated
                                    </span>
                                    <span className="text-[11px] font-medium text-white">14 this month</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-[11px]" style={{ color: '#8BA4BE' }}>
                                        Storage used
                                    </span>
                                    <span className="text-[11px] font-medium text-white">2.3 GB / 10 GB</span>
                                </div>
                            </div>
                        </div> */}

            {/* Templates & Inspiration */}
            {/* <div className="flex flex-col gap-3">
                            <h3 className="text-[15px] font-semibold text-white">
                                Templates &amp; Inspiration
                            </h3>
                            <div className="flex flex-col gap-2.5">
                                {templates.map((t) => (
                                    <div
                                        key={t.title}
                                        className="flex items-center gap-3 rounded-[10px] cursor-pointer hover:opacity-90 transition-opacity"
                                        style={{
                                            background: '#13304F',
                                            border: '1px solid #1A3A5A',
                                            padding: '10px 12px',
                                        }}
                                    >
                                        <div
                                            className="rounded-lg shrink-0 bg-[#0E243E]"
                                            style={{ width: 56, height: 56 }}
                                        />
                                        <div className="flex flex-col gap-1 min-w-0 flex-1">
                                            <span className="text-xs font-semibold text-white truncate">
                                                {t.title}
                                            </span>
                                            <span
                                                className="text-[10px] font-medium"
                                                style={{ color: '#D5B451' }}
                                            >
                                                {t.btn}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div> */}
          </div>
        </section>

        {/* ── Community Section ────────────────────────────────────────────── */}
        {/* <section
                    className="flex flex-col gap-4 px-16 pb-8"
                    style={{ paddingTop: 12 }}
                >
                    <div className="w-full h-px" style={{ background: '#1A3A5A' }} />

                    <div className="flex items-center justify-between">
                        <h2 className="text-[18px] font-semibold text-white">Community</h2>
                        <button
                            className="text-xs font-medium transition-opacity hover:opacity-80"
                            style={{ color: '#D5B451' }}
                        >
                            Explore All →
                        </button>
                    </div>

                    <div className="grid grid-cols-4 gap-3.5">
                        {communityItems.map((item) => (
                            <div
                                key={item.title}
                                className="rounded-xl overflow-hidden cursor-pointer group hover:opacity-90 transition-opacity"
                                style={{ background: '#13304F', border: '1px solid #1A3A5A' }}
                            >

                                <div className="h-[120px] relative overflow-hidden">
                                    <img
                                        src={item.image}
                                        alt={item.title}
                                        className="w-full h-full object-cover"
                                    />
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                                </div>

                                <div className="flex flex-col gap-1.5 px-3 py-2.5">
                                    <span className="text-xs font-semibold text-white">{item.title}</span>
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px]" style={{ color: '#4D6E8A' }}>
                                            by {item.creator}
                                        </span>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px]" style={{ color: '#4D6E8A' }}>
                                                ❤ {item.likes}
                                            </span>
                                            <span className="text-[10px]" style={{ color: '#4D6E8A' }}>
                                                👁 {item.views}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </section> */}
      </div>
    </div>
  );
}
