import React from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/layout';
import { ProviderForm } from '@/components/providers/provider-form';
import { useCreateProvider } from '@/hooks/api/use-providers';
import { useToast } from '@/hooks/use-toast';
import { CreateProviderRequest } from '@/types';

const ProviderCreate: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const createProviderMutation = useCreateProvider();

  const handleSubmit = async (data: CreateProviderRequest) => {
    try {
      const newProvider = await createProviderMutation.mutateAsync(data);
      
      toast({
        title: 'Provider created',
        description: `${data.name} has been successfully created.`,
      });
      
      navigate(`/providers/${newProvider.id}`);
    } catch (error: unknown) {
      toast({
        title: 'Failed to create provider',
        description: error.message || 'An error occurred while creating the provider.',
        variant: 'destructive',
      });
      throw error; // Re-throw to let the form handle it
    }
  };

  const handleCancel = () => {
    navigate('/providers');
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Create Provider"
        description="Add a new AI provider to the gateway"
        breadcrumbs={[
          { label: 'Home', href: '/' },
          { label: 'Providers', href: '/providers' },
          { label: 'Create', isCurrentPage: true },
        ]}
      />

      <ProviderForm
        mode="create"
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        isLoading={createProviderMutation.isPending}
      />
    </div>
  );
};

export default ProviderCreate;