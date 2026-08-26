'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { twMerge } from 'tailwind-merge';
import {
  LayoutDashboard,
  BrainCircuit,
  Target,
  Megaphone,
  CheckSquare,
  BookOpen,
  FileText,
  GitBranch,
  ShieldCheck,
  BarChart3,
  Building2,
  Settings,
  ChevronLeft,
  ChevronRight,
  Zap,
} from 'lucide-react';
import { useState } from 'react';

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  badge?: string;
}

const mainNav: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/chat', label: 'AI Director', icon: BrainCircuit },
  { href: '/goals', label: 'Goals', icon: Target },
  { href: '/campaigns', label: 'Campaigns', icon: Megaphone },
  { href: '/tasks', label: 'Tasks', icon: CheckSquare },
  { href: '/knowledge', label: 'Knowledge', icon: BookOpen },
  { href: '/content', label: 'Content', icon: FileText },
  { href: '/workflows', label: 'Workflows', icon: GitBranch },
  { href: '/approvals', label: 'Approvals', icon: ShieldCheck },
  { href: '/usage', label: 'AI Usage', icon: BarChart3 },
];

const bottomNav: NavItem[] = [
  { href: '/company', label: 'Company', icon: Building2 },
  { href: '/settings', label: 'Settings', icon: Settings },
];

function NavLink({
  item,
  active,
  collapsed,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href as never}
      title={collapsed ? item.label : undefined}
      className={twMerge(
        'group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150',
        collapsed ? 'justify-center px-2' : '',
        active
          ? 'bg-blue-600 text-white shadow-sm'
          : 'text-slate-400 hover:bg-[#1e2433] hover:text-slate-100',
      )}
    >
      <Icon
        size={18}
        className={twMerge('flex-shrink-0 transition-colors', active ? 'text-white' : 'text-slate-400 group-hover:text-slate-100')}
      />
      {!collapsed && <span className="truncate">{item.label}</span>}
      {!collapsed && item.badge && (
        <span className="ml-auto rounded-full bg-blue-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
          {item.badge}
        </span>
      )}
      {collapsed && (
        <span className="pointer-events-none absolute left-full ml-3 z-50 hidden whitespace-nowrap rounded-lg bg-gray-900 px-2.5 py-1.5 text-xs text-white shadow-xl group-hover:block">
          {item.label}
        </span>
      )}
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  function isActive(href: string) {
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname.startsWith(href);
  }

  return (
    <aside
      className="relative flex h-screen flex-shrink-0 flex-col border-r bg-[#0f1117] transition-all duration-200"
      style={{
        width: collapsed ? 64 : 240,
        borderColor: '#1e2433',
      }}
    >
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 px-4 border-b border-[#1e2433]">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 shadow-lg">
          <Zap size={14} className="text-white" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-100 leading-tight">SH Marketing</p>
            <p className="text-[10px] text-slate-500 leading-tight mt-0.5">AI Enterprise</p>
          </div>
        )}
      </div>

      {/* Main nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
        {mainNav.map((item) => (
          <NavLink key={item.href} item={item} active={isActive(item.href)} collapsed={collapsed} />
        ))}
      </nav>

      {/* Divider */}
      <div className="mx-3 border-t border-[#1e2433]" />

      {/* Bottom nav */}
      <div className="px-2 py-3 space-y-0.5">
        {bottomNav.map((item) => (
          <NavLink key={item.href} item={item} active={isActive(item.href)} collapsed={collapsed} />
        ))}
      </div>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed((v) => !v)}
        className="absolute -right-3 top-20 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-[#2a3754] bg-[#141924] text-slate-400 shadow-sm hover:text-slate-100 transition-colors"
      >
        {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>
    </aside>
  );
}
