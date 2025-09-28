import React, { useState, useEffect } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
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
  Save,
  X,
  Info,
  Sparkles,
} from 'lucide-react';
import { Provider, ProviderType, CreateProviderRequest, UpdateProviderRequest } from '@/types';
import { useUnsavedChangesConfirmation } from '@/components/ui/confirmation-dialog';

// Import enhanced validation schemas
import { createProviderSchema } from '@/lib/validation/adapter-schemas';

// Import new components
import TemplateSelector from './template-selector';
import AdapterConfigEditor from './adapter-config-editor';
import CredentialManager from './credential-manager';
import ModelMappingEditor from './model-mapping-editor';

// Import template types
import { ProviderTemplate } from '@/lib/templates/provider-templates';

// Enhanced validation schemas are now imported from separate file

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
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<ProviderTemplate | null>(null);
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
      credentials: provider?.credentials || {},
      rateLimits: provider?.rateLimits,
    },
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

  // Handle template selection
  const handleTemplateSelect = (template: ProviderTemplate | null) => {
    setSelectedTemplate(template);
    
    if (template) {
      // Apply template values to form
      form.setValue('name', template.name);
      form.setValue('type', template.type);
      form.setValue('description', template.description);
      form.setValue('adapterConfig', template.adapterConfig);
      form.setValue('models', template.models);
      
      // Auto-generate slug from template name
      const slug = template.name
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim();
      form.setValue('slug', slug);
    }
  };

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

  const handleSubmit = async (data: unknown) => {
    try {
      await onSubmit(data);
      setHasUnsavedChanges(false);
    } catch (error) {
      // Error handling is done by parent component
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        {/* Template Selection */}
        {mode === 'create' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                Quick Start
              </CardTitle>
              <CardDescription>
                Choose a template to quickly configure your provider with common settings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TemplateSelector
                providerType={watchedType}
                selectedTemplate={selectedTemplate}
                onTemplateSelect={handleTemplateSelect}
              />
            </CardContent>
          </Card>
        )}

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
        <AdapterConfigEditor
          control={form.control}
          providerType={watchedType}
          template={selectedTemplate}
        />

        {/* Credentials */}
        <CredentialManager
          control={form.control}
          template={selectedTemplate}
        />

        {/* Model Mappings */}
        <ModelMappingEditor
          control={form.control}
          providerType={watchedType}
          template={selectedTemplate}
        />

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