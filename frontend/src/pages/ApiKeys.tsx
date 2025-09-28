/**
 * API Keys Page
 * Main page for API key management
 */

import React from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { ApiKeysList } from '@/features/api-keys';
import { Key } from 'lucide-react';

const ApiKeys: React.FC = () => {
  return (
    <div className="space-y-6">
      <PageHeader
        title="API Keys"
        description="Manage API keys, permissions, and monitor usage"
        icon={Key}
        breadcrumbs={[
          { label: 'Dashboard', href: '/' },
          { label: 'API Keys', href: '/api-keys' },
        ]}
      />

      <ApiKeysList />
    </div>
  );
};

export default ApiKeys;