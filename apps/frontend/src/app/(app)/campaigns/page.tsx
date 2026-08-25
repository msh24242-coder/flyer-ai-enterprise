'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/auth';
import { api } from '@/lib/api';
import { Header } from '@/components/layout/header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

type Campaign = { id: string; title: string; status: string; budget?: number; startDate?: string; endDate?: string; description?: string };

function statusVariant(status: string): 'default' | 'success' | 'warning' | 'error' | 'info' {
  const map: Record<string, 'default' | 'success' | 'warning' | 'error' | 'info'> = {
    ACTIVE: 'success', COMPLETED: 'info', PAUSED: 'warning', CANCELLED: 'error', DRAFT: 'default',
  };
  return map[status] ?? 'default';
}

export default function CampaignsPage() {
  const { user, accessToken } = useAuth();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !accessToken) return;
    api.campaigns.list(user.companyId, accessToken)
      .then(setCampaigns)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load campaigns'))
      .finally(() => setLoading(false));
  }, [user, accessToken]);

  return (
    <div className="flex flex-col">
      <Header title="Campaigns" />

      <div className="flex-1 p-6">
        <p className="mb-6 text-sm text-gray-500">All marketing campaigns created by you and the AI Director.</p>

        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
          </div>
        ) : campaigns.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-4xl">📣</p>
            <h3 className="mt-4 text-lg font-semibold text-gray-900">No campaigns yet</h3>
            <p className="mt-2 text-sm text-gray-500">Ask the AI Director to create a campaign for you.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {campaigns.map((campaign) => (
              <Card key={campaign.id} className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="truncate font-medium text-gray-900">{campaign.title}</p>
                    {campaign.description && (
                      <p className="mt-0.5 line-clamp-2 text-sm text-gray-500">{campaign.description}</p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-3 text-xs text-gray-400">
                      {campaign.budget != null && (
                        <span>Budget: ${campaign.budget.toLocaleString()}</span>
                      )}
                      {campaign.startDate && (
                        <span>Start: {new Date(campaign.startDate).toLocaleDateString()}</span>
                      )}
                      {campaign.endDate && (
                        <span>End: {new Date(campaign.endDate).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>
                  <Badge variant={statusVariant(campaign.status)}>{campaign.status}</Badge>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
