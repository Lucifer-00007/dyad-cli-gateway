import React, { useState, useEffect } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { 
  Form, 
  FormControl, 
  FormDescription, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from '@/components/ui/form';
import { 
  Plus, 
  Trash2, 
  AlertCircle, 
  Info, 
  Eye, 
  EyeOff,
  Save,
  X
} from 'lucide-react';
import { Provider, ProviderType, CreateProviderRequest, UpdateProviderRequest } from '@/types';
import { useUnsavedChangesConfirmation } from '@/components/ui/confirmation-dialog';

// Validation schemas
const modelMappingSchema = z.object({
  dyadModelId: z.string().min(1, 'Dyad model ID is required'),
  adapterModelId: z.string().min(1, 'Adapter model ID is required'),
  maxTokens: z.number().positive().optional(),
  contextWindow: z.number().positive().optional(),
  supportsStreaming: z.boolean().default(false),
  supportsEmbeddings: z.boolean().default(false),
});

const baseProviderSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be less than 100 characters'),
  slug: z.string()
    .min(1, 'Slug is required')
    .regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens')
    .max(50, 'Slug must be less than 50 characters'),
  type: z.enum(['spawn-cli', 'http-sdk', 'proxy', 'local'] as const),
  description: z.string().max(500, 'Description must be less than 500 characters').optional(),
  enabled: z.boolean().default(true),
  models: z.array(modelMappingSchema).min(1, 'At least one model mapping is required'),
});

// Adapter-specific config schemas
const spawnCliConfigSchema = z.object({
  command: z.string().min(1, 'Command is required'),
  args: z.array(z.string()).default([]),
  dockerSandbox: z.boolean().default(false),
  sandboxImage: z.string().optional(),
  memoryLimit: z.string().optional(),
  cpuLimit: z.string().optional(),
  timeoutSeconds: z.number().min(1).max(300).default(30),
});

const httpSdkConfigSchema = z.object({
  baseUrl: z.string().url('Must be a valid URL'),
  headers: z.record(z.string()).optional(),
  timeoutSeconds: z.number().min(1).max(300).default(30),
});

const proxyConfigSchema = z.object({
  proxyUrl: z.string().url('Must be a valid URL'),
  timeoutSeconds: z.number().min(1).max(300).default(30),
});

const localConfigSchema = z.object({
  localUrl: z.string().url('Must be a valid URL'),
  healthCheckPath: z.string().default('/health'),
  timeoutSeconds: z.number().min(1).max(300).default(30),
});

const createProviderSchema = (type: ProviderType) => {
  const configSchema = {
    'spawn-cli': spawnCliConfigSchema,
    'http-sdk': httpSdkConfigSchema,
    'proxy': proxyConfigSchema,
    'local': localConfigSchema,
  }[type];

  return baseProviderSchema.extend({
    adapterConfig: configSchema,
    credentials: z.record(z.string()).optional(),
  });
};

export interface ProviderFormProps {
  provider?: Provider;
  onSubmit: (data: CreateProviderRequest | UpdateProviderRequest) => Promise<void>;
  onCancel: () => void;
  mode: 'create' | 'edit';
  isLoading?: boolean;
}

export const ProviderForm: React.FC<ProviderFormProps> = ({
  provider,
  onSubmit,
  onCancel,
  mode,
  isLoading = false,
}) => {
  const [showCredentials, setShowCredentials] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const { showUnsavedChangesConfirmation, ConfirmationDialog } = useUnsavedChangesConfirmation();

  const form = useForm({
    resolver: zodResolver(createProviderSchema(provider?.type || 'spawn-cli')),
    defaultValues: {
      name: provider?.name || '',
      slug: provider?.slug || '',
      type: provider?.type || 'spawn-cli',
      description: provider?.description || '',
      enabled: provider?.enabled ?? true,
      models: provider?.models || [{ 
        dyadModelId: '', 
        adapterModelId: '', 
        supportsStreaming: false, 
        supportsEmbeddings: false 
      }],
      adapterConfig: provider?.adapterConfig || {},
      credentials: {},
    },
  });

  const { fields: modelFields, append: appendModel, remove: removeModel } = useFieldArray({
    control: form.control,
    name: 'models',
  });

  const watchedType = form.watch('type');
  const watchedSlug = form.watch('slug');
  const watchedName = form.watch('name');

  // Auto-generate slug from name
  useEffect(() => {
    if (mode === 'create' && watchedName && !form.formState.dirtyFields.slug) {
      const slug = watchedName
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim();
      form.setValue('slug', slug);
    }
  }, [watchedName, mode, form]);

  // Track unsaved changes
  useEffect(() => {
    const subscription = form.watch(() => {
      setHasUnsavedChanges(form.formState.isDirty);
    });
    return () => subscription.unsubscribe();
  }, [form]);

  // Handle navigation with unsaved changes
  const handleCancel = () => {
    if (hasUnsavedChanges) {
      showUnsavedChangesConfirmation(onCancel);
    } else {
      onCancel();
    }
  };

  const handleSubmit = async (data: any) => {
    try {
      await onSubmit(data);
      setHasUnsavedChanges(false);
    } catch (error) {
      // Error handling is done by parent component
    }
  };

  const renderAdapterConfig = () => {
    switch (watchedType) {
      case 'spawn-cli':
        return (
          <div className="space-y-4">
            <FormField
              control={form.control}
              name="adapterConfig.command"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Command</FormLabel>
                  <FormControl>
                    <Input placeholder="/usr/local/bin/my-cli" {...field} />
                  </FormControl>
                  <FormDescription>
                    Full path to the CLI executable
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="adapterConfig.args"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Arguments</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="--json --verbose"
                      value={Array.isArray(field.value) ? field.value.join(' ') : ''}
                      onChange={(e) => field.onChange(e.target.value.split(' ').filter(Boolean))}
                    />
                  </FormControl>
                  <FormDescription>
                    Space-separated command line arguments
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="adapterConfig.dockerSandbox"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Docker Sandbox</FormLabel>
                    <FormDescription>
                      Run the CLI in a Docker container for security
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            {form.watch('adapterConfig.dockerSandbox') && (
              <>
                <FormField
                  control={form.control}
                  name="adapterConfig.sandboxImage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sandbox Image</FormLabel>
                      <FormControl>
                        <Input placeholder="my-cli:latest" {...field} />
                      </FormControl>
                      <FormDescription>
                        Docker image to use for sandboxed execution
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="adapterConfig.memoryLimit"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Memory Limit</FormLabel>
                        <FormControl>
                          <Input placeholder="512m" {...field} />
                        </FormControl>
                        <FormDescription>
                          Memory limit for container
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="adapterConfig.cpuLimit"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>CPU Limit</FormLabel>
                        <FormControl>
                          <Input placeholder="0.5" {...field} />
                        </FormControl>
                        <FormDescription>
                          CPU limit for container
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </>
            )}
          </div>
        );

      case 'http-sdk':
        return (
          <div className="space-y-4">
            <FormField
              control={form.control}
              name="adapterConfig.baseUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Base URL</FormLabel>
                  <FormControl>
                    <Input placeholder="https://api.example.com/v1" {...field} />
                  </FormControl>
                  <FormDescription>
                    Base URL for the HTTP API
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="adapterConfig.headers"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Custom Headers</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder='{"User-Agent": "Dyad-Gateway/1.0", "Accept": "application/json"}'
                      value={field.value ? JSON.stringify(field.value, null, 2) : ''}
                      onChange={(e) => {
                        try {
                          const parsed = JSON.parse(e.target.value || '{}');
                          field.onChange(parsed);
                        } catch {
                          // Invalid JSON, keep the string value for now
                        }
                      }}
                      rows={4}
                    />
                  </FormControl>
                  <FormDescription>
                    Custom headers as JSON object
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        );

      case 'proxy':
        return (
          <div className="space-y-4">
            <FormField
              control={form.control}
              name="adapterConfig.proxyUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Proxy URL</FormLabel>
                  <FormControl>
                    <Input placeholder="https://proxy.example.com/v1" {...field} />
                  </FormControl>
                  <FormDescription>
                    URL of the proxy server
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        );

      case 'local':
        return (
          <div className="space-y-4">
            <FormField
              control={form.control}
              name="adapterConfig.localUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Local URL</FormLabel>
                  <FormControl>
                    <Input placeholder="http://localhost:11434" {...field} />
                  </FormControl>
                  <FormDescription>
                    URL of the local model server
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="adapterConfig.healthCheckPath"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Health Check Path</FormLabel>
                  <FormControl>
                    <Input placeholder="/health" {...field} />
                  </FormControl>
                  <FormDescription>
                    Path for health check endpoint
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
            <CardDescription>
              Configure the basic settings for your provider
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="My AI Provider" {...field} />
                    </FormControl>
                    <FormDescription>
                      Display name for the provider
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="slug"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Slug</FormLabel>
                    <FormControl>
                      <Input placeholder="my-ai-provider" {...field} />
                    </FormControl>
                    <FormDescription>
                      Unique identifier (lowercase, hyphens only)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Provider Type</FormLabel>
                  <Select 
                    onValueChange={field.onChange} 
                    defaultValue={field.value}
                    disabled={mode === 'edit'}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select provider type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="spawn-cli">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">CLI</Badge>
                          Spawn CLI
                        </div>
                      </SelectItem>
                      <SelectItem value="http-sdk">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">HTTP</Badge>
                          HTTP SDK
                        </div>
                      </SelectItem>
                      <SelectItem value="proxy">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">PROXY</Badge>
                          Proxy
                        </div>
                      </SelectItem>
                      <SelectItem value="local">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">LOCAL</Badge>
                          Local Server
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Type of adapter to use for this provider
                    {mode === 'edit' && ' (cannot be changed after creation)'}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Description of this provider..."
                      {...field}
                      rows={3}
                    />
                  </FormControl>
                  <FormDescription>
                    Optional description for this provider
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="enabled"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Enabled</FormLabel>
                    <FormDescription>
                      Whether this provider is active and can receive requests
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Adapter Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>Adapter Configuration</CardTitle>
            <CardDescription>
              Configure the adapter-specific settings for {watchedType.replace('-', ' ')} provider
            </CardDescription>
          </CardHeader>
          <CardContent>
            {renderAdapterConfig()}
            
            <FormField
              control={form.control}
              name="adapterConfig.timeoutSeconds"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Timeout (seconds)</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      min="1" 
                      max="300" 
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value) || 30)}
                    />
                  </FormControl>
                  <FormDescription>
                    Request timeout in seconds (1-300)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Credentials */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Credentials
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowCredentials(!showCredentials)}
              >
                {showCredentials ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </CardTitle>
            <CardDescription>
              API keys and other credentials for this provider
            </CardDescription>
          </CardHeader>
          <CardContent>
            {showCredentials ? (
              <FormField
                control={form.control}
                name="credentials"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Credentials (JSON)</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder='{"api_key": "your-api-key", "secret": "your-secret"}'
                        value={field.value ? JSON.stringify(field.value, null, 2) : ''}
                        onChange={(e) => {
                          try {
                            const parsed = JSON.parse(e.target.value || '{}');
                            field.onChange(parsed);
                          } catch {
                            // Invalid JSON, keep the string value for now
                          }
                        }}
                        rows={4}
                      />
                    </FormControl>
                    <FormDescription>
                      Credentials as JSON object (will be encrypted)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Credentials are hidden for security. Click the eye icon to show/edit.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Model Mappings */}
        <Card>
          <CardHeader>
            <CardTitle>Model Mappings</CardTitle>
            <CardDescription>
              Map Dyad model IDs to provider-specific model IDs
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {modelFields.map((field, index) => (
              <div key={field.id} className="border rounded-lg p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">Model {index + 1}</h4>
                  {modelFields.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeModel(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name={`models.${index}.dyadModelId`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Dyad Model ID</FormLabel>
                        <FormControl>
                          <Input placeholder="gpt-4" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name={`models.${index}.adapterModelId`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Provider Model ID</FormLabel>
                        <FormControl>
                          <Input placeholder="gpt-4-turbo" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name={`models.${index}.maxTokens`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Max Tokens</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            placeholder="4096"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || undefined)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name={`models.${index}.contextWindow`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Context Window</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            placeholder="8192"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || undefined)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex gap-4">
                  <FormField
                    control={form.control}
                    name={`models.${index}.supportsStreaming`}
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <FormLabel>Supports Streaming</FormLabel>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name={`models.${index}.supportsEmbeddings`}
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <FormLabel>Supports Embeddings</FormLabel>
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            ))}

            <Button
              type="button"
              variant="outline"
              onClick={() => appendModel({ 
                dyadModelId: '', 
                adapterModelId: '', 
                supportsStreaming: false, 
                supportsEmbeddings: false 
              })}
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Model Mapping
            </Button>
          </CardContent>
        </Card>

        {/* Form Actions */}
        <div className="flex items-center justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            disabled={isLoading}
          >
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent mr-2" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {mode === 'create' ? 'Create Provider' : 'Update Provider'}
          </Button>
        </div>

        <ConfirmationDialog />
      </form>
    </Form>
  );
};