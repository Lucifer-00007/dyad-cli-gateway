import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProviderForm } from '../provider-form';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock the hooks
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

vi.mock('@/components/ui/confirmation-dialog', () => ({
  useUnsavedChangesConfirmation: () => ({
    showUnsavedChangesConfirmation: vi.fn(),
    ConfirmationDialog: () => null,
  }),
}));

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });

const renderWithQueryClient = (component: React.ReactElement) => {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      {component}
    </QueryClientProvider>
  );
};

describe('ProviderForm', () => {
  const mockOnSubmit = vi.fn();
  const mockOnCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders create form correctly', () => {
    renderWithQueryClient(
      <ProviderForm
        mode="create"
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByText('Basic Information')).toBeInTheDocument();
    expect(screen.getByText('Adapter Configuration')).toBeInTheDocument();
    expect(screen.getByText('Model Mappings')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create provider/i })).toBeInTheDocument();
  });

  it('validates required fields', async () => {
    const user = userEvent.setup();
    
    renderWithQueryClient(
      <ProviderForm
        mode="create"
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    const submitButton = screen.getByRole('button', { name: /create provider/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Name is required')).toBeInTheDocument();
      expect(screen.getByText('Slug is required')).toBeInTheDocument();
    });

    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it('auto-generates slug from name', async () => {
    const user = userEvent.setup();
    
    renderWithQueryClient(
      <ProviderForm
        mode="create"
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    const nameInput = screen.getByLabelText(/name/i);
    await user.type(nameInput, 'My Test Provider');

    const slugInput = screen.getByLabelText(/slug/i);
    expect(slugInput).toHaveValue('my-test-provider');
  });

  it('shows different adapter config based on type', async () => {
    const user = userEvent.setup();
    
    renderWithQueryClient(
      <ProviderForm
        mode="create"
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    // Default should be spawn-cli
    expect(screen.getByLabelText(/command/i)).toBeInTheDocument();

    // Change to http-sdk
    const typeSelect = screen.getByRole('combobox');
    await user.click(typeSelect);
    
    const httpSdkOption = screen.getByText('HTTP SDK');
    await user.click(httpSdkOption);

    expect(screen.getByLabelText(/base url/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/command/i)).not.toBeInTheDocument();
  });

  it('allows adding and removing model mappings', async () => {
    const user = userEvent.setup();
    
    renderWithQueryClient(
      <ProviderForm
        mode="create"
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    // Should start with one model mapping
    expect(screen.getByText('Model 1')).toBeInTheDocument();

    // Add another model mapping
    const addButton = screen.getByRole('button', { name: /add model mapping/i });
    await user.click(addButton);

    expect(screen.getByText('Model 2')).toBeInTheDocument();

    // Remove the second model mapping
    const removeButtons = screen.getAllByRole('button', { name: '' }); // Trash icon buttons
    const trashButton = removeButtons.find(button => 
      button.querySelector('svg')?.getAttribute('data-lucide') === 'trash-2'
    );
    
    if (trashButton) {
      await user.click(trashButton);
    }

    expect(screen.queryByText('Model 2')).not.toBeInTheDocument();
  });

  it('calls onCancel when cancel button is clicked', async () => {
    const user = userEvent.setup();
    
    renderWithQueryClient(
      <ProviderForm
        mode="create"
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    await user.click(cancelButton);

    expect(mockOnCancel).toHaveBeenCalled();
  });

  it('submits form with valid data', async () => {
    const user = userEvent.setup();
    
    renderWithQueryClient(
      <ProviderForm
        mode="create"
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    // Fill in required fields
    await user.type(screen.getByLabelText(/name/i), 'Test Provider');
    await user.type(screen.getByLabelText(/command/i), '/usr/bin/test');
    await user.type(screen.getByLabelText(/dyad model id/i), 'test-model');
    await user.type(screen.getByLabelText(/provider model id/i), 'provider-test-model');

    const submitButton = screen.getByRole('button', { name: /create provider/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Test Provider',
          slug: 'test-provider',
          type: 'spawn-cli',
          adapterConfig: expect.objectContaining({
            command: '/usr/bin/test',
          }),
          models: expect.arrayContaining([
            expect.objectContaining({
              dyadModelId: 'test-model',
              adapterModelId: 'provider-test-model',
            }),
          ]),
        })
      );
    });
  });
});