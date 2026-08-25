'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/context/auth';
import { api } from '@/lib/api';
import { Header } from '@/components/layout/header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';

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

export default function CompanyPage() {
  const { user, accessToken } = useAuth();
  const companyId = user?.companyId ?? '';
  const token = accessToken ?? '';

  const [company, setCompany] = useState<CompanyData | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Profile form state
  const [name, setName] = useState('');
  const [industry, setIndustry] = useState('');
  const [website, setWebsite] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);

  // Role change state
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

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <Header title="Company" />
        <div className="flex-1 p-6 space-y-4">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <Header title="Company" />
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {/* Company Profile */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Company Profile</h2>
          <form onSubmit={(e) => void handleSaveProfile(e)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Company Name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Corp" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Industry</label>
              <Input value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="e.g. SaaS, E-commerce, Healthcare" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Website</label>
              <Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://example.com" type="url" />
            </div>
            <div className="flex items-center gap-3">
              <Button type="submit" disabled={savingProfile}>
                {savingProfile ? 'Saving…' : 'Save Profile'}
              </Button>
              {profileSuccess && (
                <span className="text-sm text-green-600">Saved!</span>
              )}
            </div>
            {company && (
              <p className="text-xs text-muted-foreground">Company ID: {company.id} · Slug: {company.slug}</p>
            )}
          </form>
        </Card>

        {/* Team Members */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Team Members</h2>
          {members.length === 0 ? (
            <p className="text-sm text-muted-foreground">No members found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 pr-4 font-medium">Name</th>
                    <th className="text-left py-2 pr-4 font-medium">Email</th>
                    <th className="text-left py-2 pr-4 font-medium">Role</th>
                    <th className="text-left py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((member) => (
                    <tr key={member.id} className="border-b last:border-0">
                      <td className="py-3 pr-4">
                        {member.firstName} {member.lastName}
                        {member.id === user?.id && (
                          <span className="ml-2 text-xs bg-blue-100 text-blue-700 rounded px-1">You</span>
                        )}
                      </td>
                      <td className="py-3 pr-4 text-muted-foreground">{member.email}</td>
                      <td className="py-3 pr-4">
                        {member.id === user?.id ? (
                          <span className="text-muted-foreground">{member.role}</span>
                        ) : (
                          <select
                            value={member.role}
                            onChange={(e) => void handleRoleChange(member.id, e.target.value)}
                            disabled={roleChanging === member.id || member.role === 'OWNER'}
                            className="border rounded px-2 py-1 text-sm bg-background disabled:opacity-50"
                          >
                            {ROLES.map((r) => (
                              <option key={r} value={r} disabled={r === 'OWNER'}>{r}</option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td className="py-3">
                        {member.id !== user?.id && member.role !== 'OWNER' && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => void handleRemove(member.id)}
                            disabled={removing === member.id}
                            className="text-red-600 border-red-200 hover:bg-red-50"
                          >
                            {removing === member.id ? 'Removing…' : 'Remove'}
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
