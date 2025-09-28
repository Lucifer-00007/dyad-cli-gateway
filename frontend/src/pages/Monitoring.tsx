/**
 * Monitoring page component
 */

import React from 'react';
import { PageHeader, PageHeaderActions } from '@/components/layout';
import { MonitoringDashboard } from '@/components/monitoring-dashboard';
import { Button } from '@/components/ui/button';
import { Settings, RefreshCw } from 'lucide-react';

const Monitoring: React.FC = () => {
  return (
    <div className="space-y-6">
      <PageHeader
        title="System Monitoring"
        description="Real-time system health, performance metrics, and error tracking"
        breadcrumbs={[
          { label: 'Home', href: '/' },
          { label: 'Monitoring', isCurrentPage: true }
        ]}
        actions={
          <PageHeaderActions
            secondaryActions={[
              {
                label: 'Settings',
                onClick: () => console.log('Open monitoring settings'),
                icon: Settings,
                variant: 'outline',
              },
            ]}
          />
        }
      />
      
      <MonitoringDashboard />
    </div>
  );
};

export default Monitoring;