import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PageHeader } from '@/components/layout';
import { ProviderDetail } from '@/components/providers/provider-detail';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertCircle, ArrowLeft } from 'lucide-react';
import { useProvider } from '@/hooks/api/use-providers';

const ProviderDetailPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  
  const { data: provider, isLoading, error, refetch } = useProvider(id!);

  const handleEdit = () => {
    navigate(`/providers/${id}/edit`);
  };

  const handleDelete = () => {
    navigate('/providers');
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Provider Details"
          description="Loading provider information..."
          breadcrumbs={[
            { label: 'Home', href: '/' },
            { label: 'Providers', href: '/providers' },
            { label: 'Details', isCurrentPage: true },
          ]}
        />
        
        <div className="space-y-4">
          {/* Loading skeleton */}
          <div className="h-32 bg-muted animate-pulse rounded-lg" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="h-24 bg-muted animate-pulse rounded-lg" />
            <div className="h-24 bg-muted animate-pulse rounded-lg" />
            <div className="h-24 bg-muted animate-pulse rounded-lg" />
          </div>
          <div className="h-64 bg-muted animate-pulse rounded-lg" />
        </div>
      </div>
    );
  }

  if (error || !provider) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Provider Details"
          description="Provider not found"
          breadcrumbs={[
            { label: 'Home', href: '/' },
            { label: 'Providers', href: '/providers' },
            { label: 'Details', isCurrentPage: true },
          ]}
        />
        
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>
              {error ? 'Failed to load provider information.' : 'Provider not found.'}
            </span>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => refetch()}
              >
                Retry
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => navigate('/providers')}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Providers
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: 'Home', href: '/' },
          { label: 'Providers', href: '/providers' },
          { label: provider.name, isCurrentPage: true },
        ]}
      />

      <ProviderDetail
        provider={provider}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />
    </div>
  );
};

export default ProviderDetailPage;