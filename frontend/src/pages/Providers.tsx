import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader, PageHeaderActions } from '@/components/layout';
import { DataTable, ColumnDef } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Play, 
  Settings, 
  Eye, 
  Power, 
  PowerOff,
  AlertCircle,
  CheckCircle,
  Clock,
  Activity
} from 'lucide-react';
import { useDeleteConfirmation, useConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { useToast } from '@/hooks/use-toast';
import { 
  useProviders, 
  useDeleteProvider, 
  useToggleProvider, 
  useTestProvider 
} from '@/hooks/api/use-providers';
import { Provider } from '@/types';
import { formatDistanceToNow } from 'date-fns';

const Providers: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [testingProvider, setTestingProvider] = useState<string | null>(null);
  
  const { showDeleteConfirmation, ConfirmationDialog: DeleteDialog } = useDeleteConfirmation();
  const { showConfirmation, ConfirmationDialog: ToggleDialog } = useConfirmationDialog();

  // API hooks
  const { data: providersData, isLoading, error, refetch } = useProviders();
  const deleteProviderMutation = useDeleteProvider();
  const toggleProviderMutation = useToggleProvider();
  const testProviderMutation = useTestProvider();

  const providers = providersData?.results || [];

  const handleCreate = () => {
    navigate('/providers/new');
  };

  const handleEdit = (provider: Provider) => {
    navigate(`/providers/${provider.id}/edit`);
  };

  const handleView = (provider: Provider) => {
    navigate(`/providers/${provider.id}`);
  };

  const handleDelete = (provider: Provider) => {
    showDeleteConfirmation(
      `provider "${provider.name}"`,
      async () => {
        try {
          await deleteProviderMutation.mutateAsync(provider.id);
          toast({
            title: 'Provider deleted',
            description: `${provider.name} has been successfully deleted.`,
          });
        } catch (error) {
          toast({
            title: 'Delete failed',
            description: 'Failed to delete provider. Please try again.',
            variant: 'destructive',
          });
        }
      },
      {
        description: `This will permanently delete the provider "${provider.name}" and all its configurations. This action cannot be undone.`,
      }
    );
  };

  const handleToggle = (provider: Provider) => {
    const action = provider.enabled ? 'disable' : 'enable';
    const actionTitle = provider.enabled ? 'Disable Provider' : 'Enable Provider';
    
    showConfirmation({
      title: actionTitle,
      description: `Are you sure you want to ${action} "${provider.name}"? ${
        provider.enabled 
          ? 'This will stop all requests to this provider.' 
          : 'This will allow requests to be sent to this provider.'
      }`,
      confirmText: action.charAt(0).toUpperCase() + action.slice(1),
      variant: provider.enabled ? 'warning' : 'default',
      onConfirm: async () => {
        try {
          await toggleProviderMutation.mutateAsync({ 
            id: provider.id, 
            enabled: !provider.enabled 
          });
          toast({
            title: `Provider ${action}d`,
            description: `${provider.name} has been ${action}d.`,
          });
        } catch (error) {
          toast({
            title: `Failed to ${action} provider`,
            description: `Could not ${action} ${provider.name}. Please try again.`,
            variant: 'destructive',
          });
        }
      },
    });
  };

  const handleTest = async (provider: Provider) => {
    setTestingProvider(provider.id);
    try {
      const result = await testProviderMutation.mutateAsync({ 
        id: provider.id, 
        dryRun: false 
      });
      
      if (result.status === 'success') {
        toast({
          title: 'Test successful',
          description: `${provider.name} responded successfully in ${result.duration}ms.`,
        });
      } else {
        toast({
          title: 'Test failed',
          description: result.error?.message || 'Provider test failed.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Test error',
        description: 'Failed to test provider. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setTestingProvider(null);
    }
  };

  const getStatusIcon = (provider: Provider) => {
    if (!provider.enabled) {
      return <PowerOff className="h-4 w-4 text-muted-foreground" />;
    }
    
    switch (provider.healthStatus?.status) {
      case 'healthy':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'unhealthy':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getStatusBadge = (provider: Provider) => {
    if (!provider.enabled) {
      return <Badge variant="secondary">Disabled</Badge>;
    }
    
    switch (provider.healthStatus?.status) {
      case 'healthy':
        return <Badge variant="default" className="bg-green-100 text-green-800 hover:bg-green-100">Healthy</Badge>;
      case 'unhealthy':
        return <Badge variant="destructive">Unhealthy</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const formatLastChecked = (provider: Provider) => {
    if (!provider.healthStatus?.lastChecked) {
      return 'Never';
    }
    
    try {
      return formatDistanceToNow(new Date(provider.healthStatus.lastChecked), { 
        addSuffix: true 
      });
    } catch {
      return 'Unknown';
    }
  };

  const columns: ColumnDef<Provider>[] = [
    {
      id: 'name',
      header: 'Name',
      accessorKey: 'name',
      sortable: true,
      cell: (provider) => (
        <div className="flex items-center gap-3">
          {getStatusIcon(provider)}
          <div>
            <div className="font-medium">{provider.name}</div>
            {provider.description && (
              <div className="text-sm text-muted-foreground truncate max-w-[200px]">
                {provider.description}
              </div>
            )}
          </div>
        </div>
      ),
    },
    {
      id: 'type',
      header: 'Type',
      accessorKey: 'type',
      sortable: true,
      filterable: true,
      filterOptions: [
        { label: 'Spawn CLI', value: 'spawn-cli' },
        { label: 'HTTP SDK', value: 'http-sdk' },
        { label: 'Proxy', value: 'proxy' },
        { label: 'Local', value: 'local' },
      ],
      cell: (provider) => (
        <Badge variant="outline" className="capitalize">
          {provider.type.replace('-', ' ')}
        </Badge>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      sortable: true,
      filterable: true,
      filterOptions: [
        { label: 'Enabled', value: 'enabled' },
        { label: 'Disabled', value: 'disabled' },
        { label: 'Healthy', value: 'healthy' },
        { label: 'Unhealthy', value: 'unhealthy' },
      ],
      cell: (provider) => getStatusBadge(provider),
    },
    {
      id: 'models',
      header: 'Models',
      sortable: true,
      align: 'center',
      cell: (provider) => (
        <div className="text-center">
          <span className="font-medium">{provider.models?.length || 0}</span>
        </div>
      ),
    },
    {
      id: 'lastHealthCheck',
      header: 'Last Health Check',
      sortable: true,
      cell: (provider) => (
        <div className="text-sm">
          {formatLastChecked(provider)}
        </div>
      ),
    },
  ];

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Providers"
          description="Manage AI providers and their configurations"
          breadcrumbs={[
            { label: 'Home', href: '/' },
            { label: 'Providers', isCurrentPage: true },
          ]}
        />
        
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Failed to load providers. Please try refreshing the page.
            <Button 
              variant="outline" 
              size="sm" 
              className="ml-2"
              onClick={() => refetch()}
            >
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Providers"
        description="Manage AI providers and their configurations"
        breadcrumbs={[
          { label: 'Home', href: '/' },
          { label: 'Providers', isCurrentPage: true },
        ]}
        actions={
          <PageHeaderActions
            primaryAction={{
              label: 'Add Provider',
              onClick: handleCreate,
              icon: Plus,
            }}
            secondaryActions={[
              {
                label: 'Refresh',
                onClick: () => refetch(),
                icon: Activity,
                variant: 'outline',
              },
            ]}
          />
        }
      />

      {/* Provider Stats Cards */}
      {!isLoading && providers.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Providers</CardTitle>
              <Settings className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{providers.length}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Enabled</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {providers.filter(p => p.enabled).length}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Healthy</CardTitle>
              <Activity className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {providers.filter(p => p.healthStatus?.status === 'healthy').length}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Models</CardTitle>
              <Eye className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {providers.reduce((sum, p) => sum + (p.models?.length || 0), 0)}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <DataTable
        data={providers}
        columns={columns}
        loading={isLoading}
        searchPlaceholder="Search providers..."
        actions={[
          {
            label: 'View',
            onClick: handleView,
            icon: Eye,
            variant: 'ghost',
          },
          {
            label: 'Test',
            onClick: handleTest,
            icon: Play,
            variant: 'default',
            disabled: (provider) => !provider.enabled || testingProvider === provider.id,
          },
          {
            label: (provider) => provider.enabled ? 'Disable' : 'Enable',
            onClick: handleToggle,
            icon: (provider) => provider.enabled ? PowerOff : Power,
            variant: 'ghost',
          },
          {
            label: 'Edit',
            onClick: handleEdit,
            icon: Edit,
            variant: 'ghost',
          },
          {
            label: 'Delete',
            onClick: handleDelete,
            icon: Trash2,
            variant: 'destructive',
            disabled: (provider) => provider.enabled,
          },
        ]}
        pagination={{
          pageSize: 10,
          showSizeSelector: true,
          pageSizeOptions: [5, 10, 20, 50],
        }}
        emptyState={{
          title: 'No providers found',
          description: 'Get started by adding your first AI provider.',
          action: (
            <Button onClick={handleCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Add Provider
            </Button>
          ),
        }}
      />

      <DeleteDialog />
      <ToggleDialog />
    </div>
  );
};

export default Providers;