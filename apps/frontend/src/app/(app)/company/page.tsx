'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/context/auth';
import { api } from '@/lib/api';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { Badge } from '@/components/ui/badge';
import { Building2, Users, Check, Globe, Briefcase, UserX } from 'lucide-react';
import type { BadgeVariant } from '@/components/ui/badge';

type CompanyData = {
  id: string;
  name: string;
  slug: string;
  industry?: string;
  website?: string;
};

type Member = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  isActive: boolean;
};

const ROLES = ['MEMBER', 'ADMIN', 'OWNER'] as const;

function roleBadgeVariant(role: string): BadgeVariant {
  const map: Record<string, BadgeVariant> = { OWNER: 'warning', ADMIN: 'info', MEMBER: 'default' };
  return map[role] ?? 'default';
}

function Section({ icon: Icon, title, description, children }: {
  icon: React.ElementType; title: string; description: string; children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border" style={{ background: 'var(--surface-1)', borderColor: 'var(--surface-border)' }}>
      <div className="flex items-start gap-4 border-b px-6 py-5" style={{ borderColor: 'var(--surface-border)' }}>
        <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: 'var(--info-bg)' }}>
          <Icon size={16} style={{ color: 'var(--info-text)' }} />
        </div>
        <div>
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</h2>
          <p className="mt-0.5 text-xs" style={{ color: 'var(--text-tertiary)' }}>{description}</p>
        </div>
      </div>
      <div className="px-6 py-5">{children}</div>
    </section>
  );
}

export default function CompanyPage() {
  const { user, accessToken } = useAuth();
  const companyId = user?.companyId ?? '';
  const token = accessToken ?? '';

  const [company, setCompany] = useState<CompanyData | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [industry, setIndustry] = useState('');
  const [website, setWebsite] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);

  const [roleChanging, setRoleChanging] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!companyId || !token) return;
    try {
      const [co, mems] = await Promise.all([
        api.company.get(companyId, token),
        api.company.getMembers(companyId, token),
      ]);
      setCompany(co);
      setName(co.name ?? '');
      setIndustry(co.industry ?? '');
      setWebsite(co.website ?? '');
      setMembers(mems);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load company');
    } finally {
      setLoading(false);
    }
  }, [companyId, token]);

  useEffect(() => { void load(); }, [load]);

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    setProfileSuccess(false);
    setError(null);
    try {
      const updated = await api.company.update(companyId, token, {
        name: name.trim() || undefined,
        industry: industry.trim() || undefined,
        website: website.trim() || undefined,
      });
      setCompany(updated);
      setProfileSuccess(true);
      setTimeout(() => setProfileSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleRoleChange(memberId: string, role: string) {
    setRoleChanging(memberId);
    try {
      await api.company.updateMemberRole(companyId, token, memberId, role);
      setMembers((prev) => prev.map((m) => m.id === memberId ? { ...m, role } : m));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update role');
    } finally {
      setRoleChanging(null);
    }
  }

  async function handleRemove(memberId: string) {
    if (!confirm('Remove this member from the company?')) return;
    setRemoving(memberId);
    try {
      await api.company.removeMember(companyId, token, memberId);
      setMembers((prev) => prev.filter((m) => m.id !== memberId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove member');
    } finally {
      setRemoving(null);
    }
  }

  return (
    <div className="flex flex-col h-full">
      <Header title="Company" />
      <PageHeader title="Company" description="Manage your organization profile and team members" />

      <div className="flex-1 overflow-y-auto p-6 space-y-5 max-w-2xl">
        {error && (
          <div className="rounded-xl border px-4 py-3 text-sm animate-fade-in"
            style={{ background: 'var(--error-bg)', borderColor: 'var(--error-border)', color: 'var(--error-text)' }}>
            {error}
          </div>
        )}

        {/* Company Profile */}
        <Section icon={Building2} title="Company Profile" description="Your organization's name, industry, and web presence">
          {loading ? (
            <Skeleton className="h-48 w-full" />
          ) : (
            <form onSubmit={(e) => void handleSaveProfile(e)} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Company Name</label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Corp" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                    <span className="flex items-center gap-1"><Briefcase size={11} /> Industry</span>
                  </label>
                  <Input value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="e.g. SaaS, E-commerce" />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                    <span className="flex items-center gap-1"><Globe size={11} /> Website</span>
                  </label>
                  <Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://example.com" type="url" />
                </div>
              </div>

              {company && (
                <div className="rounded-lg px-3 py-2.5 text-xs font-mono" style={{ background: 'var(--bg-muted)', color: 'var(--text-tertiary)' }}>
                  ID: {company.id.slice(0, 16)}… · Slug: {company.slug}
                </div>
              )}

              {profileSuccess && (
                <div className="flex items-center gap-2 rounded-lg border px-4 py-3 text-sm"
                  style={{ background: 'var(--success-bg)', borderColor: 'var(--success-border)', color: 'var(--success-text)' }}>
                  <Check size={14} /> Profile saved successfully
                </div>
              )}

              <Button type="submit" loading={savingProfile} size="sm">
                {savingProfile ? 'Saving…' : 'Save Profile'}
              </Button>
            </form>
          )}
        </Section>

        {/* Team Members */}
        <Section icon={Users} title="Team Members" description="Manage roles and access for your organization">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
            </div>
          ) : members.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No team members"
              description="Invite your team to collaborate in the AI Marketing OS."
            />
          ) : (
            <div className="space-y-2">
              {members.map((member) => (
                <div
                  key={member.id}
                  className="group flex items-center gap-4 rounded-xl border px-4 py-3"
                  style={{ background: 'var(--surface-2)', borderColor: 'var(--surface-border)' }}
                >
                  {/* Avatar */}
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold"
                    style={{ background: 'var(--info-bg)', color: 'var(--info-text)' }}>
                    {member.firstName[0]}{member.lastName[0]}
                  </div>

                  {/* Name + email */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                        {member.firstName} {member.lastName}
                      </p>
                      {member.id === user?.id && (
                        <span className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
                          style={{ background: 'var(--brand-600)', color: '#fff' }}>
                          You
                        </span>
                      )}
                    </div>
                    <p className="text-xs truncate" style={{ color: 'var(--text-tertiary)' }}>{member.email}</p>
                  </div>

                  {/* Role */}
                  <div className="flex-shrink-0">
                    {member.id === user?.id || member.role === 'OWNER' ? (
                      <Badge variant={roleBadgeVariant(member.role)}>{member.role}</Badge>
                    ) : (
                      <select
                        value={member.role}
                        onChange={(e) => void handleRoleChange(member.id, e.target.value)}
                        disabled={roleChanging === member.id}
                        className="rounded-lg border px-2 py-1 text-xs font-medium disabled:opacity-50"
                        style={{ background: 'var(--surface-1)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }}
                      >
                        {ROLES.filter((r) => r !== 'OWNER').map((r) => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    )}
                  </div>

                  {/* Remove */}
                  {member.id !== user?.id && member.role !== 'OWNER' && (
                    <button
                      onClick={() => void handleRemove(member.id)}
                      disabled={removing === member.id}
                      className="flex-shrink-0 flex h-7 w-7 items-center justify-center rounded-lg opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
                      style={{ color: 'var(--error-text)' }}
                      title="Remove member"
                    >
                      {removing === member.id
                        ? <span className="text-xs">…</span>
                        : <UserX size={13} />
                      }
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}
