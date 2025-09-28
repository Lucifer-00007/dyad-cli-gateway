import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PageHeader } from '@/components/layout';
import { ProviderForm } from '@/components/providers/provider-form';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertCircle, ArrowLeft } from 'lucide-react';
import { useProvider, useUpdateProvider } from '@/hooks/api/use-providers';
import { useToast } from '@/hooks/use-toast';
import { UpdateProviderRequest } from '@/types';

const ProviderEdit: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  
  const { data: provider, isLoading, error, refetch } = useProvider(id!);
  const updateProviderMutation = useUpdateProvider();

  const handleSubmit = async (data: UpdateProviderRequest) => {
    if (!id) return;
    
    try {
      const updatedProvider = await updateProviderMutation.mutateAsync({ id, data });
      
      toast({
        title: 'Provider updated',
        description: `${data.name || provider?.name} has been successfully updated.`,
      });
      
      navigate(`/providers/${updatedProvider.id}`);
    } catch (error: unknown) {
      toast({
        title: 'Failed to update provider',
        description: error.message || 'An error occurred while updating the provider.',
        variant: 'destructive',
      });
      throw error; // Re-throw to let the form handle it
    }
  };

  const handleCancel = () => {
    navigate(`/providers/${id}`);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Edit Provider"
          description="Loading provider information..."
          breadcrumbs={[
            { label: 'Home', href: '/' },
            { label: 'Providers', href: '/providers' },
            { label: 'Edit', isCurrentPage: true },
          ]}
        />
        
        <div className="space-y-4">
          {/* Loading skeleton */}
          <div className="h-32 bg-muted animate-pulse rounded-lg" />
          <div className="h-48 bg-muted animate-pulse rounded-lg" />
          <div className="h-64 bg-muted animate-pulse rounded-lg" />
        </div>
      </div>
    );
  }

  if (error || !provider) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Edit Provider"
          description="Provider not found"
          breadcrumbs={[
            { label: 'Home', href: '/' },
            { label: 'Providers', href: '/providers' },
            { label: 'Edit', isCurrentPage: true },
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
        title={`Edit ${provider.name}`}
        description="Update provider configuration and settings"
        breadcrumbs={[
          { label: 'Home', href: '/' },
          { label: 'Providers', href: '/providers' },
          { label: provider.name, href: `/providers/${provider.id}` },
          { label: 'Edit', isCurrentPage: true },
        ]}
      />

      <ProviderForm
        mode="edit"
        provider={provider}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        isLoading={updateProviderMutation.isPending}
      />
    </div>
  );
};

export default ProviderEdit;