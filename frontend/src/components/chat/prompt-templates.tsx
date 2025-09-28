import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  FileText, 
  Plus, 
  Play, 
  Eye, 
  Zap, 
  Brain, 
  Target, 
  Wrench,
  MessageSquare,
  Settings
} from 'lucide-react';
import { testTemplates, getTemplatesByCategory, createCustomTemplate } from '@/lib/test-templates';
import { TestTemplate, ChatMessage } from '@/types';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface PromptTemplatesProps {
  onApplyTemplate: (messages: ChatMessage[], parameters?: Record<string, unknown>) => void;
  selectedModel: string;
}

interface CustomTemplateForm {
  name: string;
  description: string;
  messages: string;
  maxTokens: number;
  temperature: number;
  topP: number;
  stream: boolean;
}

const categoryIcons = {
  basic: Target,
  advanced: Brain,
  performance: Zap,
  custom: Wrench,
};

const categoryColors = {
  basic: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  advanced: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  performance: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  custom: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
};

export const PromptTemplates: React.FC<PromptTemplatesProps> = ({
  onApplyTemplate,
  selectedModel,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedTemplate, setSelectedTemplate] = useState<TestTemplate | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [customTemplateForm, setCustomTemplateForm] = useState<CustomTemplateForm>({
    name: '',
    description: '',
    messages: '',
    maxTokens: 150,
    temperature: 0.7,
    topP: 1.0,
    stream: false,
  });

  const categories = ['all', 'basic', 'advanced', 'performance', 'custom'];
  
  const filteredTemplates = selectedCategory === 'all' 
    ? testTemplates 
    : getTemplatesByCategory(selectedCategory as TestTemplate['category']);

  const handleApplyTemplate = (template: TestTemplate) => {
    if (!selectedModel) {
      toast.error('Please select a model first');
      return;
    }

    const messages = template.request.messages.map(msg => ({
      role: msg.role,
      content: msg.content,
    }));

    onApplyTemplate(messages, {
      ...template.request.parameters,
      model: selectedModel,
    });

    toast.success(`Applied template: ${template.name}`);
  };

  const handleCreateCustomTemplate = () => {
    try {
      // Parse messages from JSON string
      const messages = JSON.parse(customTemplateForm.messages);
      
      if (!Array.isArray(messages)) {
        throw new Error('Messages must be an array');
      }

      // Validate message format
      messages.forEach((msg, index) => {
        if (!msg.role || !msg.content) {
          throw new Error(`Message ${index + 1} must have role and content`);
        }
        if (!['system', 'user', 'assistant'].includes(msg.role)) {
          throw new Error(`Message ${index + 1} has invalid role: ${msg.role}`);
        }
      });

      const template = createCustomTemplate(
        customTemplateForm.name,
        customTemplateForm.description,
        messages,
        {
          maxTokens: customTemplateForm.maxTokens,
          temperature: customTemplateForm.temperature,
          topP: customTemplateForm.topP,
          stream: customTemplateForm.stream,
        }
      );

      // In a real implementation, you would save this to a backend or local storage
      toast.success('Custom template created successfully');
      setShowCreateDialog(false);
      setCustomTemplateForm({
        name: '',
        description: '',
        messages: '',
        maxTokens: 150,
        temperature: 0.7,
        topP: 1.0,
        stream: false,
      });

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      toast.error('Failed to create template', {
        description: errorMessage,
      });
    }
  };

  const getExampleMessages = () => {
    return JSON.stringify([
      {
        role: 'user',
        content: 'Your prompt here...'
      }
    ], null, 2);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Prompt Templates
          </CardTitle>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Plus className="w-4 h-4 mr-1" />
                Create
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create Custom Template</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="template-name">Name</Label>
                    <Input
                      id="template-name"
                      value={customTemplateForm.name}
                      onChange={(e) => setCustomTemplateForm(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Template name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="template-description">Description</Label>
                    <Input
                      id="template-description"
                      value={customTemplateForm.description}
                      onChange={(e) => setCustomTemplateForm(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Brief description"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="template-messages">Messages (JSON format)</Label>
                  <Textarea
                    id="template-messages"
                    value={customTemplateForm.messages}
                    onChange={(e) => setCustomTemplateForm(prev => ({ ...prev, messages: e.target.value }))}
                    placeholder={getExampleMessages()}
                    className="min-h-[120px] font-mono text-sm"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="template-max-tokens">Max Tokens</Label>
                    <Input
                      id="template-max-tokens"
                      type="number"
                      value={customTemplateForm.maxTokens}
                      onChange={(e) => setCustomTemplateForm(prev => ({ ...prev, maxTokens: parseInt(e.target.value) || 150 }))}
                      min="1"
                      max="4096"
                    />
                  </div>
                  <div>
                    <Label htmlFor="template-temperature">Temperature</Label>
                    <Input
                      id="template-temperature"
                      type="number"
                      step="0.1"
                      value={customTemplateForm.temperature}
                      onChange={(e) => setCustomTemplateForm(prev => ({ ...prev, temperature: parseFloat(e.target.value) || 0.7 }))}
                      min="0"
                      max="2"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleCreateCustomTemplate}
                    disabled={!customTemplateForm.name || !customTemplateForm.messages}
                  >
                    Create Template
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Category Filter */}
        <div className="flex flex-wrap gap-2">
          {categories.map((category) => {
            const Icon = category === 'all' ? MessageSquare : categoryIcons[category as keyof typeof categoryIcons];
            return (
              <Button
                key={category}
                variant={selectedCategory === category ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedCategory(category)}
                className="capitalize"
              >
                {Icon && <Icon className="w-3 h-3 mr-1" />}
                {category}
              </Button>
            );
          })}
        </div>

        <Separator />

        {/* Templates List */}
        <ScrollArea className="h-64">
          <div className="space-y-3">
            {filteredTemplates.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No templates found in this category</p>
              </div>
            ) : (
              filteredTemplates.map((template) => {
                const CategoryIcon = categoryIcons[template.category];
                return (
                  <div
                    key={template.id}
                    className="p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium text-sm">{template.name}</h4>
                          <Badge 
                            variant="secondary" 
                            className={cn("text-xs", categoryColors[template.category])}
                          >
                            <CategoryIcon className="w-3 h-3 mr-1" />
                            {template.category}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mb-2">
                          {template.description}
                        </p>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span>{template.request.messages.length} messages</span>
                          <span>Max tokens: {template.request.parameters.maxTokens || 'default'}</span>
                          {template.request.parameters.stream && (
                            <Badge variant="outline" className="text-xs">
                              <Zap className="w-3 h-3 mr-1" />
                              Streaming
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1 ml-2">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="w-8 h-8 p-0"
                              onClick={() => setSelectedTemplate(template)}
                            >
                              <Eye className="w-3 h-3" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl">
                            <DialogHeader>
                              <DialogTitle>{template.name}</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4">
                              <p className="text-sm text-muted-foreground">
                                {template.description}
                              </p>
                              
                              <div>
                                <h4 className="font-medium mb-2">Messages</h4>
                                <div className="space-y-2">
                                  {template.request.messages.map((message, index) => (
                                    <div key={index} className="p-2 bg-muted rounded text-sm">
                                      <div className="font-medium text-xs text-muted-foreground uppercase mb-1">
                                        {message.role}
                                      </div>
                                      <div className="whitespace-pre-wrap">
                                        {message.content}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              <div>
                                <h4 className="font-medium mb-2">Parameters</h4>
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                  <div>Max Tokens: {template.request.parameters.maxTokens || 'default'}</div>
                                  <div>Temperature: {template.request.parameters.temperature || 'default'}</div>
                                  <div>Top P: {template.request.parameters.topP || 'default'}</div>
                                  <div>Streaming: {template.request.parameters.stream ? 'Yes' : 'No'}</div>
                                </div>
                              </div>

                              {template.expectedBehavior && (
                                <div>
                                  <h4 className="font-medium mb-2">Expected Behavior</h4>
                                  <p className="text-sm text-muted-foreground">
                                    {template.expectedBehavior}
                                  </p>
                                </div>
                              )}
                            </div>
                          </DialogContent>
                        </Dialog>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-8 h-8 p-0"
                          onClick={() => handleApplyTemplate(template)}
                          disabled={!selectedModel}
                        >
                          <Play className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>

        {!selectedModel && (
          <div className="text-center text-sm text-muted-foreground py-2 bg-muted/50 rounded">
            Select a model to use templates
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PromptTemplates;