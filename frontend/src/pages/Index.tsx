import { PageHeader, PageHeaderActions } from '@/components/layout';
import { TestSetup } from "@/components/test-setup";
import { Plus, Settings } from 'lucide-react';

const Index = () => {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Welcome to the Dyad CLI Gateway Admin Console"
        breadcrumbs={[
          { label: 'Home', isCurrentPage: true }
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
                onClick: () => console.log('Settings'),
                icon: Settings,
                variant: 'outline',
              },
            ]}
          />
        }
      />
      <TestSetup />
    </div>
  );
};

export default Index;
