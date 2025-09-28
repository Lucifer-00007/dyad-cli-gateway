/**
 * API Keys List Component
 * Displays all API keys with status, permissions, and usage statistics
 */

import React, { useState, useMemo } from 'react';
import { Plus, Search, Filter, MoreHorizontal, Key, Shield, Activity, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useApiKeys, useApiKeyStats } from '@/hooks/api/use-api-keys';
import { ApiKey } from '@/types';
import { formatDistanceToNow } from 'date-fns';
import { ApiKeyForm } from './api-key-form';
import { ApiKeyDetail } from './api-key-detail';
import { ApiKeyRevocationDialog } from './api-key-revocation-dialog';
import { ApiKeyUsageAnalytics } from './api-key-usage-analytics';

interface ApiKeysListProps {
  onCreateKey?: (key: ApiKey) => void;
  onUpdateKey?: (key: ApiKey) => void;
  onDeleteKey?: (keyId: string) => void;
}

export const ApiKeysList: React.FC<ApiKeysListProps> = ({
  onCreateKey,
  onUpdateKey,
  onDeleteKey,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'revoked' | 'expired'>('all');
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedKeyForDetail, setSelectedKeyForDetail] = useState<string | null>(null);
  const [selectedKeyForRevocation, setSelectedKeyForRevocation] = useState<string | null>(null);
  const [showUsageAnalytics, setShowUsageAnalytics] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const { data: apiKeysData, isLoading, error } = useApiKeys({
    page: currentPage,
    limit: pageSize,
    search: searchTerm || undefined,
    enabled: statusFilter === 'all' ? undefined : statusFilter === 'active',
  });

  const { data: stats } = useApiKeyStats();

  const filteredKeys = useMemo(() => {
    if (!apiKeysData?.results) return [];
    
    return apiKeysData.results.filter(key => {
      if (statusFilter === 'active') return key.enabled;
      if (statusFilter === 'revoked') return !key.enabled;
      if (statusFilter === 'expired') {
        // Add expiration logic if needed
        return false;
      }
      return true;
    });
  }, [apiKeysData?.results, statusFilter]);

  const getStatusBadge = (key: ApiKey) => {
    if (!key.enabled) {
      return <Badge variant="destructive">Revoked</Badge>;
    }
    
    const lastUsed = key.lastUsed ? new Date(key.lastUsed) : null;
    const isRecentlyUsed = lastUsed && Date.now() - lastUsed.getTime() < 24 * 60 * 60 * 1000;
    
    return (
      <Badge variant={isRecentlyUsed ? "default" : "secondary"}>
        {isRecentlyUsed ? "Active" : "Inactive"}
      </Badge>
    );
  };

  const getUsageIndicator = (key: ApiKey) => {
    const usage = key.usage;
    const rateLimits = key.rateLimits;
    
    const requestsPercentage = rateLimits.requestsPerMinute > 0 
      ? (usage.requestsToday / (rateLimits.requestsPerMinute * 24 * 60)) * 100 
      : 0;
    
    const tokensPercentage = rateLimits.tokensPerMinute > 0 
      ? (usage.tokensToday / (rateLimits.tokensPerMinute * 24 * 60)) * 100 
      : 0;
    
    const maxPercentage = Math.max(requestsPercentage, tokensPercentage);
    
    if (maxPercentage > 90) {
      return <Badge variant="destructive" className="text-xs">High Usage</Badge>;
    } else if (maxPercentage > 70) {
      return <Badge variant="outline" className="text-xs">Medium Usage</Badge>;
    } else if (maxPercentage > 0) {
      return <Badge variant="secondary" className="text-xs">Low Usage</Badge>;
    }
    
    return <Badge variant="outline" className="text-xs">No Usage</Badge>;
  };

  const columns = [
    {
      id: 'select',
      header: ({ table }: any) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      ),
      cell: ({ row }: any) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: 'name',
      header: 'Name',
      cell: ({ row }: any) => {
        const key = row.original as ApiKey;
        return (
          <div className="flex items-center space-x-2">
            <Key className="h-4 w-4 text-muted-foreground" />
            <div>
              <div className="font-medium">{key.name}</div>
              <div className="text-sm text-muted-foreground">
                {key.keyPrefix}***
              </div>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }: any) => getStatusBadge(row.original as ApiKey),
    },
    {
      accessorKey: 'permissions',
      header: 'Permissions',
      cell: ({ row }: any) => {
        const key = row.original as ApiKey;
        return (
          <div className="flex items-center space-x-1">
            <Shield className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">{key.permissions.length} permissions</span>
          </div>
        );
      },
    },
    {
      accessorKey: 'usage',
      header: 'Usage Today',
      cell: ({ row }: any) => {
        const key = row.original as ApiKey;
        return (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span>{key.usage.requestsToday} requests</span>
              {getUsageIndicator(key)}
            </div>
            <div className="text-xs text-muted-foreground">
              {key.usage.tokensToday.toLocaleString()} tokens
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: 'rateLimits',
      header: 'Rate Limits',
      cell: ({ row }: any) => {
        const key = row.original as ApiKey;
        return (
          <div className="text-sm">
            <div>{key.rateLimits.requestsPerMinute}/min requests</div>
            <div className="text-muted-foreground">
              {key.rateLimits.tokensPerMinute.toLocaleString()}/min tokens
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: 'lastUsed',
      header: 'Last Used',
      cell: ({ row }: any) => {
        const key = row.original as ApiKey;
        return key.lastUsed ? (
          <div className="text-sm">
            {formatDistanceToNow(new Date(key.lastUsed), { addSuffix: true })}
          </div>
        ) : (
          <span className="text-muted-foreground text-sm">Never</span>
        );
      },
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }: any) => {
        const key = row.original as ApiKey;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setSelectedKeyForDetail(key.id)}>
                View Details
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSelectedKeyForDetail(key.id)}>
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSelectedKeyForRevocation(key.id)}>
                {key.enabled ? 'Revoke' : 'Enable'}
              </DropdownMenuItem>
              <DropdownMenuItem 
                className="text-destructive"
                onClick={() => onDeleteKey?.(key.id)}
              >
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  if (error) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-center">
            <AlertTriangle className="h-8 w-8 text-destructive mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              Failed to load API keys. Please try again.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Keys</CardTitle>
              <Key className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground">
                {stats.active} active, {stats.revoked} revoked
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Requests Today</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalRequestsToday.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                {stats.totalTokensToday.toLocaleString()} tokens
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Monthly Usage</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalRequestsThisMonth.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                {stats.totalTokensThisMonth.toLocaleString()} tokens
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg per Key</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{Math.round(stats.averageRequestsPerKey)}</div>
              <p className="text-xs text-muted-foreground">requests/day</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Controls */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>API Keys</CardTitle>
            <div className="flex items-center space-x-2">
              <Button onClick={() => setShowUsageAnalytics(true)} variant="outline">
                <Activity className="h-4 w-4 mr-2" />
                Analytics
              </Button>
              <Button onClick={() => setShowCreateForm(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create API Key
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4 mb-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search API keys..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={(value: any) => setStatusFilter(value)}>
              <SelectTrigger className="w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Keys</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="revoked">Revoked</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DataTable
            columns={columns}
            data={filteredKeys}
            pagination={{
              page: currentPage,
              pageSize,
              totalPages: apiKeysData?.totalPages || 1,
              totalResults: apiKeysData?.totalResults || 0,
              onPageChange: setCurrentPage,
              onPageSizeChange: setPageSize,
            }}
            loading={isLoading}
            onRowSelectionChange={setSelectedKeys}
          />
        </CardContent>
      </Card>

      {/* Dialogs */}
      {showCreateForm && (
        <ApiKeyForm
          open={showCreateForm}
          onClose={() => setShowCreateForm(false)}
          onSuccess={(key) => {
            setShowCreateForm(false);
            onCreateKey?.(key);
          }}
        />
      )}

      {selectedKeyForDetail && (
        <ApiKeyDetail
          keyId={selectedKeyForDetail}
          open={!!selectedKeyForDetail}
          onClose={() => setSelectedKeyForDetail(null)}
          onUpdate={onUpdateKey}
        />
      )}

      {selectedKeyForRevocation && (
        <ApiKeyRevocationDialog
          keyId={selectedKeyForRevocation}
          open={!!selectedKeyForRevocation}
          onClose={() => setSelectedKeyForRevocation(null)}
          onSuccess={() => {
            setSelectedKeyForRevocation(null);
            // Refresh data
          }}
        />
      )}

      {showUsageAnalytics && (
        <ApiKeyUsageAnalytics
          open={showUsageAnalytics}
          onClose={() => setShowUsageAnalytics(false)}
        />
      )}
    </div>
  );
};