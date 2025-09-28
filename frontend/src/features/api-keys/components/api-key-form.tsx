/**
 * API Key Creation/Edit Form Component
 * Handles creating and editing API keys with permission configuration and rate limiting
 */

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Info, Shield, Zap, Settings, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useCreateApiKey, useUpdateApiKey } from '@/hooks/api/use-api-keys';
import { useProviders } from '@/hooks/api/use-providers';
import { useModels } from '@/hooks/api/use-models';
import { ApiKey, CreateApiKeyRequest } from '@/types';
import { ApiKeyFormData, ApiKeyPermission } from '../types';
import { ApiKeyPermissionsEditor } from './api-key-permissions-editor';
import { ApiKeySecureDisplay } from './api-key-secure-display';

const apiKeySchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be less than 100 characters'),
  description: z.string().optional(),
  permissions: z.array(z.string()).min(1, 'At least one permission is required'),
  rateLimits: z.object({
    requestsPerMinute: z.number().min(1, 'Must allow at least 1 request per minute').max(10000),
    tokensPerMinute: z.number().min(1, 'Must allow at least 1 token per minute').max(1000000),
  }),
  expiresAt: z.date().optional(),
  allowedProviders: z.array(z.string()).optional(),
  allowedModels: z.array(z.string()).optional(),
});

type ApiKeyFormValues = z.infer<typeof apiKeySchema>;

interface ApiKeyFormProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (key: ApiKey) => void;
  apiKey?: ApiKey; // For editing
  mode?: 'create' | 'edit';
}

const DEFAULT_PERMISSIONS: ApiKeyPermission[] = [
  {
    id: 'chat.completions',
    name: 'Chat Completions',
    description: 'Access to /v1/chat/completions endpoint',
    category: 'read',
    enabled: true,
  },
  {
    id: 'models.list',
    name: 'List Models',
    description: 'Access to /v1/models endpoint',
    category: 'read',
    enabled: true,
  },
  {
    id: 'embeddings',
    name: 'Embeddings',
    description: 'Access to /v1/embeddings endpoint',
    category: 'read',
    enabled: false,
  },
  {
    id: 'admin.providers.read',
    name: 'Read Providers',
    description: 'View provider configurations',
    category: 'admin',
    enabled: false,
  },
  {
    id: 'admin.providers.write',
    name: 'Manage Providers',
    description: 'Create, update, and delete providers',
    category: 'admin',
    enabled: false,
  },
  {
    id: 'admin.metrics.read',
    name: 'View Metrics',
    description: 'Access to system metrics and monitoring',
    category: 'admin',
    enabled: false,
  },
];

export const ApiKeyForm: React.FC<ApiKeyFormProps> = ({
  open,
  onClose,
  onSuccess,
  apiKey,
  mode = 'create',
}) => {
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [createdKey, setCreatedKey] = useState<{ key: string; apiKey: ApiKey } | null>(null);

  const { data: providers } = useProviders();
  const { data: models } = useModels();
  const createMutation = useCreateApiKey();
  const updateMutation = useUpdateApiKey();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
    watch,
    reset,
  } = useForm<ApiKeyFormValues>({
    resolver: zodResolver(apiKeySchema),
    defaultValues: {
      name: '',
      description: '',
      permissions: ['chat.completions', 'models.list'],
      rateLimits: {
        requestsPerMinute: 60,
        tokensPerMinute: 10000,
      },
    },
  });

  const watchedExpiresAt = watch('expiresAt');

  useEffect(() => {
    if (apiKey && mode === 'edit') {
      reset({
        name: apiKey.name,
        description: '',
        permissions: apiKey.permissions,
        rateLimits: apiKey.rateLimits,
      });
      setSelectedPermissions(apiKey.permissions);
    }
  }, [apiKey, mode, reset]);

  const onSubmit = async (data: ApiKeyFormValues) => {
    try {
      const requestData: CreateApiKeyRequest = {
        name: data.name,
        permissions: selectedPermissions,
        rateLimits: data.rateLimits,
      };

      if (mode === 'create') {
        const result = await createMutation.mutateAsync(requestData);
        setCreatedKey(result);
      } else if (apiKey) {
        const updatedKey = await updateMutation.mutateAsync({
          id: apiKey.id,
          data: requestData,
        });
        onSuccess(updatedKey);
      }
    } catch (error) {
      console.error('Failed to save API key:', error);
    }
  };

  const handlePermissionChange = (permissions: string[]) => {
    setSelectedPermissions(permissions);
    setValue('permissions', permissions);
  };

  const getRateLimitPreset = (preset: 'low' | 'medium' | 'high' | 'unlimited') => {
    const presets = {
      low: { requestsPerMinute: 10, tokensPerMinute: 1000 },
      medium: { requestsPerMinute: 60, tokensPerMinute: 10000 },
      high: { requestsPerMinute: 300, tokensPerMinute: 50000 },
      unlimited: { requestsPerMinute: 10000, tokensPerMinute: 1000000 },
    };
    
    const preset_values = presets[preset];
    setValue('rateLimits.requestsPerMinute', preset_values.requestsPerMinute);
    setValue('rateLimits.tokensPerMinute', preset_values.tokensPerMinute);
  };

  // If key was just created, show the secure display
  if (createdKey) {
    return (
      <ApiKeySecureDisplay
        open={open}
        onClose={() => {
          setCreatedKey(null);
          onClose();
          onSuccess(createdKey.apiKey);
        }}
        apiKey={createdKey.key}
        keyName={createdKey.apiKey.name}
      />
    );
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Shield className="h-5 w-5" />
            <span>{mode === 'create' ? 'Create API Key' : 'Edit API Key'}</span>
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="basic">Basic Info</TabsTrigger>
              <TabsTrigger value="permissions">Permissions</TabsTrigger>
              <TabsTrigger value="limits">Rate Limits</TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Basic Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name *</Label>
                    <Input
                      id="name"
                      {...register('name')}
                      placeholder="e.g., Production API Key"
                    />
                    {errors.name && (
                      <p className="text-sm text-destructive">{errors.name.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      {...register('description')}
                      placeholder="Optional description for this API key"
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Expiration (Optional)</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !watchedExpiresAt && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {watchedExpiresAt ? (
                            format(watchedExpiresAt, "PPP")
                          ) : (
                            <span>No expiration</span>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={watchedExpiresAt}
                          onSelect={(date) => setValue('expiresAt', date)}
                          disabled={(date) => date < new Date()}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  {showAdvanced && (
                    <>
                      <Separator />
                      <div className="space-y-4">
                        <h4 className="font-medium">Advanced Settings</h4>
                        
                        <div className="space-y-2">
                          <Label>Allowed Providers (Optional)</Label>
                          <Select>
                            <SelectTrigger>
                              <SelectValue placeholder="All providers allowed" />
                            </SelectTrigger>
                            <SelectContent>
                              {providers?.results.map((provider) => (
                                <SelectItem key={provider.id} value={provider.id}>
                                  {provider.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-muted-foreground">
                            Leave empty to allow access to all providers
                          </p>
                        </div>

                        <div className="space-y-2">
                          <Label>Allowed Models (Optional)</Label>
                          <Select>
                            <SelectTrigger>
                              <SelectValue placeholder="All models allowed" />
                            </SelectTrigger>
                            <SelectContent>
                              {models?.data.map((model) => (
                                <SelectItem key={model.id} value={model.id}>
                                  {model.id}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-muted-foreground">
                            Leave empty to allow access to all models
                          </p>
                        </div>
                      </div>
                    </>
                  )}

                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="w-full"
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    {showAdvanced ? 'Hide' : 'Show'} Advanced Settings
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="permissions" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Permissions</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Select which endpoints and features this API key can access
                  </p>
                </CardHeader>
                <CardContent>
                  <ApiKeyPermissionsEditor
                    permissions={DEFAULT_PERMISSIONS}
                    selectedPermissions={selectedPermissions}
                    onPermissionsChange={handlePermissionChange}
                  />
                  {errors.permissions && (
                    <Alert className="mt-4">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>{errors.permissions.message}</AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="limits" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Rate Limits</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Configure usage limits to prevent abuse and manage costs
                  </p>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => getRateLimitPreset('low')}
                    >
                      Low Usage
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => getRateLimitPreset('medium')}
                    >
                      Medium Usage
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => getRateLimitPreset('high')}
                    >
                      High Usage
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => getRateLimitPreset('unlimited')}
                    >
                      Unlimited
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="requestsPerMinute">
                        Requests per Minute *
                      </Label>
                      <Input
                        id="requestsPerMinute"
                        type="number"
                        {...register('rateLimits.requestsPerMinute', { valueAsNumber: true })}
                        min={1}
                        max={10000}
                      />
                      {errors.rateLimits?.requestsPerMinute && (
                        <p className="text-sm text-destructive">
                          {errors.rateLimits.requestsPerMinute.message}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="tokensPerMinute">
                        Tokens per Minute *
                      </Label>
                      <Input
                        id="tokensPerMinute"
                        type="number"
                        {...register('rateLimits.tokensPerMinute', { valueAsNumber: true })}
                        min={1}
                        max={1000000}
                      />
                      {errors.rateLimits?.tokensPerMinute && (
                        <p className="text-sm text-destructive">
                          {errors.rateLimits.tokensPerMinute.message}
                        </p>
                      )}
                    </div>
                  </div>

                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      Rate limits are enforced per API key. Exceeding these limits will result in 
                      HTTP 429 (Too Many Requests) responses.
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Zap className="h-4 w-4 mr-2 animate-spin" />
                  {mode === 'create' ? 'Creating...' : 'Updating...'}
                </>
              ) : (
                <>
                  <Shield className="h-4 w-4 mr-2" />
                  {mode === 'create' ? 'Create API Key' : 'Update API Key'}
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};