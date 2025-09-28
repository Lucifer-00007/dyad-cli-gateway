/**
 * Provider components test suite
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { ProviderForm } from '@/components/providers/provider-form';
import { ProviderList } from '@/components/providers/enhanced-provider-list';
import { ProviderDetail } from '@/components/providers/provider-detail';
import { AdapterConfigEditor } from '@/components/providers/adapter-config-editor';
import { ModelMappingEditor } from '@/components/providers/model-mapping-editor';
import { ProviderTestDialog } from '@/components/providers/provider-test-dialog';
import { CredentialManager } from '@/components/providers/credential-manager';

// Mock data
const mockProvider = {
  _id: 'provider-1',
  name: 'Test Provider',
  slug: 'test-provider',
  type: 'http-sdk' as const,
  description: 'A test provider',
  enabled: true,
  adapterConfig: {
    baseUrl: 'https://api.example.com',
    authType: 'api-key' as const,
    region: 'us-east-1',
  },
  credentials: {
    apiKey: 'test-key-123',
  },
  models: [
    {
      dyadModelId: 'gpt-4',
      adapterModelId: 'gpt-4-turbo',
      maxTokens: 4096,
      contextWindow: 8192,
    },
  ],
  healthStatus: {
    status: 'healthy' as const,
    lastChecked: '2023-01-01T00:00:00Z',
    responseTime: 150,
  },
  createdAt: '2023-01-01T00:00:00Z',
  updatedAt: '2023-01-01T00:00:00Z',
};

const mockProviders = [
  mockProvider,
  {
    ...mockProvider,
    _id: 'provider-2',
    name: 'Another Provider',
    slug: 'another-provider',
    type: 'spawn-cli' as const,
    enabled: false,
    healthStatus: {
      status: 'unhealthy' as const,
      lastChecked: '2023-01-01T00:00:00Z',
      responseTime: 5000,
      error: 'Connection timeout',
    },
  },
];

// Test wrapper
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {children}
      </BrowserRouter>
    </QueryClientProvider>
  );
};

describe('ProviderForm', () => {
  const mockOnSubmit = vi.fn();
  const mockOnCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render create form', () => {
    render(
      <TestWrapper>
        <ProviderForm
          mode="create"
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      </TestWrapper>
    );

    expect(screen.getByText('Create Provider')).toBeInTheDocument();
    expect(screen.getByLabelText(/Provider Name/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Provider Slug/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Provider Type/)).toBeInTheDocument();
    expect(screen.getByText('Create')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('should render edit form with existing data', () => {
    render(
      <TestWrapper>
        <ProviderForm
          mode="edit"
          provider={mockProvider}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      </TestWrapper>
    );

    expect(screen.getByText('Edit Provider')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Test Provider')).toBeInTheDocument();
    expect(screen.getByDisplayValue('test-provider')).toBeInTheDocument();
    expect(screen.getByText('Update')).toBeInTheDocument();
  });

  it('should validate required fields', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <ProviderForm
          mode="create"
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      </TestWrapper>
    );

    // Try to submit without filling required fields
    await user.click(screen.getByText('Create'));

    await waitFor(() => {
      expect(screen.getByText('Provider name is required')).toBeInTheDocument();
      expect(screen.getByText('Provider slug is required')).toBeInTheDocument();
    });

    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it('should submit form with valid data', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <ProviderForm
          mode="create"
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      </TestWrapper>
    );

    // Fill out form
    await user.type(screen.getByLabelText(/Provider Name/), 'New Provider');
    await user.type(screen.getByLabelText(/Provider Slug/), 'new-provider');
    await user.selectOptions(screen.getByLabelText(/Provider Type/), 'http-sdk');

    // Submit form
    await user.click(screen.getByText('Create'));

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'New Provider',
          slug: 'new-provider',
          type: 'http-sdk',
        })
      );
    });
  });

  it('should handle cancel action', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <ProviderForm
          mode="create"
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      </TestWrapper>
    );

    await user.click(screen.getByText('Cancel'));
    expect(mockOnCancel).toHaveBeenCalled();
  });

  it('should show unsaved changes warning', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <ProviderForm
          mode="edit"
          provider={mockProvider}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      </TestWrapper>
    );

    // Make changes
    const nameInput = screen.getByDisplayValue('Test Provider');
    await user.clear(nameInput);
    await user.type(nameInput, 'Modified Provider');

    // Try to cancel
    await user.click(screen.getByText('Cancel'));

    // Should show confirmation dialog
    await waitFor(() => {
      expect(screen.getByText('Unsaved Changes')).toBeInTheDocument();
      expect(screen.getByText('You have unsaved changes')).toBeInTheDocument();
    });
  });
});

describe('ProviderList', () => {
  const mockOnEdit = vi.fn();
  const mockOnDelete = vi.fn();
  const mockOnTest = vi.fn();
  const mockOnToggleEnabled = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render provider list', () => {
    render(
      <TestWrapper>
        <ProviderList
          providers={mockProviders}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onTest={mockOnTest}
          onToggleEnabled={mockOnToggleEnabled}
        />
      </TestWrapper>
    );

    expect(screen.getByText('Test Provider')).toBeInTheDocument();
    expect(screen.getByText('Another Provider')).toBeInTheDocument();
    expect(screen.getByText('http-sdk')).toBeInTheDocument();
    expect(screen.getByText('spawn-cli')).toBeInTheDocument();
  });

  it('should show provider status indicators', () => {
    render(
      <TestWrapper>
        <ProviderList
          providers={mockProviders}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onTest={mockOnTest}
          onToggleEnabled={mockOnToggleEnabled}
        />
      </TestWrapper>
    );

    expect(screen.getByText('Healthy')).toBeInTheDocument();
    expect(screen.getByText('Unhealthy')).toBeInTheDocument();
    expect(screen.getByText('Enabled')).toBeInTheDocument();
    expect(screen.getByText('Disabled')).toBeInTheDocument();
  });

  it('should handle provider actions', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <ProviderList
          providers={mockProviders}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onTest={mockOnTest}
          onToggleEnabled={mockOnToggleEnabled}
        />
      </TestWrapper>
    );

    // Test edit action
    const editButtons = screen.getAllByText('Edit');
    await user.click(editButtons[0]);
    expect(mockOnEdit).toHaveBeenCalledWith('provider-1');

    // Test delete action
    const deleteButtons = screen.getAllByText('Delete');
    await user.click(deleteButtons[0]);
    expect(mockOnDelete).toHaveBeenCalledWith('provider-1');

    // Test toggle enabled
    const toggleButtons = screen.getAllByRole('switch');
    await user.click(toggleButtons[0]);
    expect(mockOnToggleEnabled).toHaveBeenCalledWith('provider-1', false);
  });

  it('should support search and filtering', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <ProviderList
          providers={mockProviders}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onTest={mockOnTest}
          onToggleEnabled={mockOnToggleEnabled}
          searchable={true}
          filterable={true}
        />
      </TestWrapper>
    );

    // Search for specific provider
    const searchInput = screen.getByPlaceholderText(/Search providers/);
    await user.type(searchInput, 'Test');

    await waitFor(() => {
      expect(screen.getByText('Test Provider')).toBeInTheDocument();
      expect(screen.queryByText('Another Provider')).not.toBeInTheDocument();
    });
  });

  it('should show empty state when no providers', () => {
    render(
      <TestWrapper>
        <ProviderList
          providers={[]}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onTest={mockOnTest}
          onToggleEnabled={mockOnToggleEnabled}
        />
      </TestWrapper>
    );

    expect(screen.getByText('No providers found')).toBeInTheDocument();
    expect(screen.getByText('Create your first provider')).toBeInTheDocument();
  });
});

describe('ProviderDetail', () => {
  it('should render provider details', () => {
    render(
      <TestWrapper>
        <ProviderDetail provider={mockProvider} />
      </TestWrapper>
    );

    expect(screen.getByText('Test Provider')).toBeInTheDocument();
    expect(screen.getByText('A test provider')).toBeInTheDocument();
    expect(screen.getByText('http-sdk')).toBeInTheDocument();
    expect(screen.getByText('Enabled')).toBeInTheDocument();
    expect(screen.getByText('Healthy')).toBeInTheDocument();
  });

  it('should show adapter configuration', () => {
    render(
      <TestWrapper>
        <ProviderDetail provider={mockProvider} />
      </TestWrapper>
    );

    expect(screen.getByText('Adapter Configuration')).toBeInTheDocument();
    expect(screen.getByText('https://api.example.com')).toBeInTheDocument();
    expect(screen.getByText('api-key')).toBeInTheDocument();
    expect(screen.getByText('us-east-1')).toBeInTheDocument();
  });

  it('should show model mappings', () => {
    render(
      <TestWrapper>
        <ProviderDetail provider={mockProvider} />
      </TestWrapper>
    );

    expect(screen.getByText('Model Mappings')).toBeInTheDocument();
    expect(screen.getByText('gpt-4')).toBeInTheDocument();
    expect(screen.getByText('gpt-4-turbo')).toBeInTheDocument();
    expect(screen.getByText('4096')).toBeInTheDocument();
  });

  it('should show health status with metrics', () => {
    render(
      <TestWrapper>
        <ProviderDetail provider={mockProvider} />
      </TestWrapper>
    );

    expect(screen.getByText('Health Status')).toBeInTheDocument();
    expect(screen.getByText('150ms')).toBeInTheDocument();
  });

  it('should handle provider actions', async () => {
    const user = userEvent.setup();
    const mockOnEdit = vi.fn();
    const mockOnTest = vi.fn();
    const mockOnDelete = vi.fn();

    render(
      <TestWrapper>
        <ProviderDetail 
          provider={mockProvider}
          onEdit={mockOnEdit}
          onTest={mockOnTest}
          onDelete={mockOnDelete}
        />
      </TestWrapper>
    );

    await user.click(screen.getByText('Edit'));
    expect(mockOnEdit).toHaveBeenCalled();

    await user.click(screen.getByText('Test'));
    expect(mockOnTest).toHaveBeenCalled();

    await user.click(screen.getByText('Delete'));
    expect(mockOnDelete).toHaveBeenCalled();
  });
});

describe('AdapterConfigEditor', () => {
  const mockOnChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render HTTP SDK config fields', () => {
    render(
      <AdapterConfigEditor
        type="http-sdk"
        config={{
          baseUrl: 'https://api.example.com',
          authType: 'api-key',
          region: 'us-east-1',
        }}
        onChange={mockOnChange}
      />
    );

    expect(screen.getByLabelText(/Base URL/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Auth Type/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Region/)).toBeInTheDocument();
  });

  it('should render spawn-cli config fields', () => {
    render(
      <AdapterConfigEditor
        type="spawn-cli"
        config={{
          command: 'python',
          args: ['script.py'],
          dockerSandbox: true,
        }}
        onChange={mockOnChange}
      />
    );

    expect(screen.getByLabelText(/Command/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Arguments/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Docker Sandbox/)).toBeInTheDocument();
  });

  it('should handle config changes', async () => {
    const user = userEvent.setup();

    render(
      <AdapterConfigEditor
        type="http-sdk"
        config={{ baseUrl: '', authType: 'api-key' }}
        onChange={mockOnChange}
      />
    );

    const baseUrlInput = screen.getByLabelText(/Base URL/);
    await user.type(baseUrlInput, 'https://new-api.example.com');

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        baseUrl: 'https://new-api.example.com',
      })
    );
  });

  it('should validate configuration', async () => {
    const user = userEvent.setup();

    render(
      <AdapterConfigEditor
        type="http-sdk"
        config={{ baseUrl: '', authType: 'api-key' }}
        onChange={mockOnChange}
        errors={{ baseUrl: 'Base URL is required' }}
      />
    );

    expect(screen.getByText('Base URL is required')).toBeInTheDocument();
  });
});

describe('ModelMappingEditor', () => {
  const mockOnChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render model mappings', () => {
    const mappings = [
      {
        dyadModelId: 'gpt-4',
        adapterModelId: 'gpt-4-turbo',
        maxTokens: 4096,
      },
    ];

    render(
      <ModelMappingEditor
        mappings={mappings}
        onChange={mockOnChange}
      />
    );

    expect(screen.getByDisplayValue('gpt-4')).toBeInTheDocument();
    expect(screen.getByDisplayValue('gpt-4-turbo')).toBeInTheDocument();
    expect(screen.getByDisplayValue('4096')).toBeInTheDocument();
  });

  it('should add new mapping', async () => {
    const user = userEvent.setup();

    render(
      <ModelMappingEditor
        mappings={[]}
        onChange={mockOnChange}
      />
    );

    await user.click(screen.getByText('Add Mapping'));

    expect(mockOnChange).toHaveBeenCalledWith([
      {
        dyadModelId: '',
        adapterModelId: '',
        maxTokens: undefined,
        contextWindow: undefined,
      },
    ]);
  });

  it('should remove mapping', async () => {
    const user = userEvent.setup();
    const mappings = [
      {
        dyadModelId: 'gpt-4',
        adapterModelId: 'gpt-4-turbo',
      },
    ];

    render(
      <ModelMappingEditor
        mappings={mappings}
        onChange={mockOnChange}
      />
    );

    await user.click(screen.getByText('Remove'));

    expect(mockOnChange).toHaveBeenCalledWith([]);
  });

  it('should update mapping values', async () => {
    const user = userEvent.setup();
    const mappings = [
      {
        dyadModelId: 'gpt-4',
        adapterModelId: 'gpt-4-turbo',
      },
    ];

    render(
      <ModelMappingEditor
        mappings={mappings}
        onChange={mockOnChange}
      />
    );

    const dyadModelInput = screen.getByDisplayValue('gpt-4');
    await user.clear(dyadModelInput);
    await user.type(dyadModelInput, 'gpt-3.5-turbo');

    expect(mockOnChange).toHaveBeenCalledWith([
      {
        dyadModelId: 'gpt-3.5-turbo',
        adapterModelId: 'gpt-4-turbo',
      },
    ]);
  });
});

describe('ProviderTestDialog', () => {
  const mockOnClose = vi.fn();
  const mockOnTest = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render test dialog', () => {
    render(
      <TestWrapper>
        <ProviderTestDialog
          open={true}
          provider={mockProvider}
          onClose={mockOnClose}
          onTest={mockOnTest}
        />
      </TestWrapper>
    );

    expect(screen.getByText('Test Provider')).toBeInTheDocument();
    expect(screen.getByText('Test Provider: Test Provider')).toBeInTheDocument();
    expect(screen.getByLabelText(/Model/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Message/)).toBeInTheDocument();
    expect(screen.getByText('Run Test')).toBeInTheDocument();
  });

  it('should handle test execution', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <ProviderTestDialog
          open={true}
          provider={mockProvider}
          onClose={mockOnClose}
          onTest={mockOnTest}
        />
      </TestWrapper>
    );

    // Fill test parameters
    await user.selectOptions(screen.getByLabelText(/Model/), 'gpt-4');
    await user.type(screen.getByLabelText(/Message/), 'Hello, world!');

    // Run test
    await user.click(screen.getByText('Run Test'));

    expect(mockOnTest).toHaveBeenCalledWith({
      model: 'gpt-4',
      messages: [{ role: 'user', content: 'Hello, world!' }],
    });
  });

  it('should show test results', () => {
    const testResult = {
      success: true,
      latency: 250,
      response: {
        choices: [
          {
            message: {
              role: 'assistant',
              content: 'Hello! How can I help you?',
            },
          },
        ],
      },
    };

    render(
      <TestWrapper>
        <ProviderTestDialog
          open={true}
          provider={mockProvider}
          onClose={mockOnClose}
          onTest={mockOnTest}
          testResult={testResult}
        />
      </TestWrapper>
    );

    expect(screen.getByText('Test Results')).toBeInTheDocument();
    expect(screen.getByText('Success')).toBeInTheDocument();
    expect(screen.getByText('250ms')).toBeInTheDocument();
    expect(screen.getByText('Hello! How can I help you?')).toBeInTheDocument();
  });

  it('should show test errors', () => {
    const testResult = {
      success: false,
      error: 'Connection timeout',
      latency: 5000,
    };

    render(
      <TestWrapper>
        <ProviderTestDialog
          open={true}
          provider={mockProvider}
          onClose={mockOnClose}
          onTest={mockOnTest}
          testResult={testResult}
        />
      </TestWrapper>
    );

    expect(screen.getByText('Test Results')).toBeInTheDocument();
    expect(screen.getByText('Failed')).toBeInTheDocument();
    expect(screen.getByText('Connection timeout')).toBeInTheDocument();
  });
});

describe('CredentialManager', () => {
  const mockOnChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render credential fields', () => {
    const credentials = {
      apiKey: 'test-key-123',
      secretKey: 'secret-456',
    };

    render(
      <CredentialManager
        credentials={credentials}
        onChange={mockOnChange}
        fields={[
          { key: 'apiKey', label: 'API Key', type: 'password', required: true },
          { key: 'secretKey', label: 'Secret Key', type: 'password', required: false },
        ]}
      />
    );

    expect(screen.getByLabelText(/API Key/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Secret Key/)).toBeInTheDocument();
  });

  it('should mask sensitive values', () => {
    const credentials = {
      apiKey: 'test-key-123',
    };

    render(
      <CredentialManager
        credentials={credentials}
        onChange={mockOnChange}
        fields={[
          { key: 'apiKey', label: 'API Key', type: 'password', required: true },
        ]}
      />
    );

    const input = screen.getByLabelText(/API Key/) as HTMLInputElement;
    expect(input.type).toBe('password');
  });

  it('should handle credential changes', async () => {
    const user = userEvent.setup();
    const credentials = {
      apiKey: '',
    };

    render(
      <CredentialManager
        credentials={credentials}
        onChange={mockOnChange}
        fields={[
          { key: 'apiKey', label: 'API Key', type: 'password', required: true },
        ]}
      />
    );

    const input = screen.getByLabelText(/API Key/);
    await user.type(input, 'new-api-key');

    expect(mockOnChange).toHaveBeenCalledWith({
      apiKey: 'new-api-key',
    });
  });

  it('should validate required fields', () => {
    const credentials = {
      apiKey: '',
    };

    render(
      <CredentialManager
        credentials={credentials}
        onChange={mockOnChange}
        fields={[
          { key: 'apiKey', label: 'API Key', type: 'password', required: true },
        ]}
        errors={{ apiKey: 'API Key is required' }}
      />
    );

    expect(screen.getByText('API Key is required')).toBeInTheDocument();
  });

  it('should show/hide password fields', async () => {
    const user = userEvent.setup();
    const credentials = {
      apiKey: 'test-key-123',
    };

    render(
      <CredentialManager
        credentials={credentials}
        onChange={mockOnChange}
        fields={[
          { key: 'apiKey', label: 'API Key', type: 'password', required: true },
        ]}
      />
    );

    const input = screen.getByLabelText(/API Key/) as HTMLInputElement;
    const toggleButton = screen.getByRole('button', { name: /show/i });

    expect(input.type).toBe('password');

    await user.click(toggleButton);
    expect(input.type).toBe('text');

    await user.click(toggleButton);
    expect(input.type).toBe('password');
  });
});