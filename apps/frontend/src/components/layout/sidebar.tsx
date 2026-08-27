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
  Package,
  Images,
} from 'lucide-react';
import { useState } from 'react';
import { useMobileNav } from '@/context/mobile-nav';
import { usePreferences } from '@/context/preferences';
import type { Translations } from '@/i18n/en';

interface NavItem {
  href: string;
  labelKey: keyof Translations['nav'];
  icon: React.ElementType;
  badge?: string;
}

const mainNav: NavItem[] = [
  { href: '/dashboard', labelKey: 'dashboard', icon: LayoutDashboard },
  { href: '/chat', labelKey: 'aiDirector', icon: BrainCircuit },
  { href: '/goals', labelKey: 'goals', icon: Target },
  { href: '/campaigns', labelKey: 'campaigns', icon: Megaphone },
  { href: '/products', labelKey: 'products', icon: Package },
  { href: '/assets', labelKey: 'assets', icon: Images },
  { href: '/tasks', labelKey: 'tasks', icon: CheckSquare },
  { href: '/knowledge', labelKey: 'knowledge', icon: BookOpen },
  { href: '/content', labelKey: 'content', icon: FileText },
  { href: '/workflows', labelKey: 'workflows', icon: GitBranch },
  { href: '/approvals', labelKey: 'approvals', icon: ShieldCheck },
  { href: '/usage', labelKey: 'aiUsage', icon: BarChart3 },
];

const bottomNav: NavItem[] = [
  { href: '/company', labelKey: 'company', icon: Building2 },
  { href: '/settings', labelKey: 'settings', icon: Settings },
];

function NavLink({
  item,
  label,
  active,
  collapsed,
}: {
  item: NavItem;
  label: string;
  active: boolean;
  collapsed: boolean;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href as never}
      title={collapsed ? label : undefined}
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
      {!collapsed && <span className="truncate">{label}</span>}
      {!collapsed && item.badge && (
        <span className="ms-auto rounded-full bg-blue-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
          {item.badge}
        </span>
      )}
      {collapsed && (
        <span className="pointer-events-none absolute start-full ms-3 z-50 hidden whitespace-nowrap rounded-lg bg-gray-900 px-2.5 py-1.5 text-xs text-white shadow-xl group-hover:block">
          {label}
        </span>
      )}
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const { isOpen, close } = useMobileNav();
  const { t } = usePreferences();

  function isActive(href: string) {
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname.startsWith(href);
  }

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={close}
          aria-hidden="true"
        />
      )}
      <aside
        className={twMerge(
          'fixed inset-y-0 start-0 z-40 flex h-screen flex-shrink-0 flex-col border-e bg-[#0f1117] transition-transform duration-200',
          'md:relative ltr:md:translate-x-0 rtl:md:translate-x-0',
          isOpen ? 'translate-x-0' : 'ltr:-translate-x-full rtl:translate-x-full',
        )}
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
            <p className="text-sm font-semibold text-slate-100 leading-tight">{t((d) => d.sidebar.productName)}</p>
            <p className="text-[10px] text-slate-500 leading-tight mt-0.5">{t((d) => d.sidebar.productTagline)}</p>
          </div>
        )}
      </div>

      {/* Main nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5" onClick={close}>
        {mainNav.map((item) => (
          <NavLink key={item.href} item={item} label={t((d) => d.nav[item.labelKey])} active={isActive(item.href)} collapsed={collapsed} />
        ))}
      </nav>

      {/* Divider */}
      <div className="mx-3 border-t border-[#1e2433]" />

      {/* Bottom nav */}
      <div className="px-2 py-3 space-y-0.5" onClick={close}>
        {bottomNav.map((item) => (
          <NavLink key={item.href} item={item} label={t((d) => d.nav[item.labelKey])} active={isActive(item.href)} collapsed={collapsed} />
        ))}
      </div>

      {/* Collapse toggle (desktop only) */}
      <button
        onClick={() => setCollapsed((v) => !v)}
        aria-label={collapsed ? t((d) => d.sidebar.expand) : t((d) => d.sidebar.collapse)}
        className="absolute -end-3 top-20 z-10 hidden h-6 w-6 items-center justify-center rounded-full border border-[#2a3754] bg-[#141924] text-slate-400 shadow-sm transition-colors hover:text-slate-100 md:flex"
      >
        {collapsed ? <ChevronRight size={12} className="rtl:-scale-x-100" /> : <ChevronLeft size={12} className="rtl:-scale-x-100" />}
      </button>
      </aside>
    </>
  );
}
