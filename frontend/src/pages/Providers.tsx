import React from 'react';
import { PageHeader, PageHeaderActions } from '@/components/layout';
import { DataTable, ColumnDef } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Plus, Edit, Trash2, Play, Settings } from 'lucide-react';
import { useDeleteConfirmation } from '@/components/ui/confirmation-dialog';

// Mock data for demonstration
interface Provider {
  id: string;
  name: string;
  type: 'spawn-cli' | 'http-sdk' | 'proxy' | 'local';
  status: 'active' | 'inactive' | 'error';
  models: number;
  lastHealthCheck: string;
}

const mockProviders: Provider[] = [
  {
    id: '1',
    name: 'OpenAI GPT',
    type: 'http-sdk',
    status: 'active',
    models: 3,
    lastHealthCheck: '2 minutes ago',
  },
  {
    id: '2',
    name: 'Local Llama',
    type: 'spawn-cli',
    status: 'active',
    models: 1,
    lastHealthCheck: '5 minutes ago',
  },
  {
    id: '3',
    name: 'Claude Proxy',
    type: 'proxy',
    status: 'error',
    models: 2,
    lastHealthCheck: '1 hour ago',
  },
  {
    id: '4',
    name: 'Local Model Server',
    type: 'local',
    status: 'inactive',
    models: 1,
    lastHealthCheck: 'Never',
  },
];

const Providers: React.FC = () => {
  const { showDeleteConfirmation, ConfirmationDialog } = useDeleteConfirmation();

  const handleEdit = (provider: Provider) => {
    console.log('Edit provider:', provider);
  };

  const handleDelete = (provider: Provider) => {
    showDeleteConfirmation(
      `provider "${provider.name}"`,
      () => {
        console.log('Delete provider:', provider);
        // Here you would call your delete API
      },
      {
        description: `This will permanently delete the provider "${provider.name}" and all its configurations. This action cannot be undone.`,
      }
    );
  };

  const handleTest = (provider: Provider) => {
    console.log('Test provider:', provider);
  };

  const columns: ColumnDef<Provider>[] = [
    {
      id: 'name',
      header: 'Name',
      accessorKey: 'name',
      sortable: true,
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
        <Badge variant="outline">
          {provider.type}
        </Badge>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      accessorKey: 'status',
      sortable: true,
      filterable: true,
      filterOptions: [
        { label: 'Active', value: 'active' },
        { label: 'Inactive', value: 'inactive' },
        { label: 'Error', value: 'error' },
      ],
      cell: (provider) => (
        <Badge
          variant={
            provider.status === 'active'
              ? 'default'
              : provider.status === 'error'
              ? 'destructive'
              : 'secondary'
          }
        >
          {provider.status}
        </Badge>
      ),
    },
    {
      id: 'models',
      header: 'Models',
      accessorKey: 'models',
      sortable: true,
      align: 'center',
    },
    {
      id: 'lastHealthCheck',
      header: 'Last Health Check',
      accessorKey: 'lastHealthCheck',
      sortable: true,
    },
  ];

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
              onClick: () => console.log('Add provider'),
              icon: Plus,
            }}
            secondaryActions={[
              {
                label: 'Settings',
                onClick: () => console.log('Provider settings'),
                icon: Settings,
                variant: 'outline',
              },
            ]}
          />
        }
      />

      <DataTable
        data={mockProviders}
        columns={columns}
        searchPlaceholder="Search providers..."
        actions={[
          {
            label: 'Test',
            onClick: handleTest,
            icon: Play,
            variant: 'default',
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
            disabled: (provider) => provider.status === 'active',
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
            <Button onClick={() => console.log('Add first provider')}>
              <Plus className="mr-2 h-4 w-4" />
              Add Provider
            </Button>
          ),
        }}
      />

      <ConfirmationDialog />
    </div>
  );
};

export default Providers;