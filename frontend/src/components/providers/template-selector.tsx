/**
 * Template selector component for choosing provider configuration templates
 * Provides an intuitive interface for selecting and applying provider templates
 */

import React, { useState, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Search,
  Star,
  ExternalLink,
  Info,
  CheckCircle,
  Sparkles,
  Terminal,
  Globe,
  Server,
  Zap,
  Filter,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ProviderType } from '@/types/api';
import {
  ProviderTemplate,
  providerTemplates,
  getTemplatesByType,
  getTemplatesByCategory,
  getPopularTemplates,
  searchTemplates,
  templateCategories,
  TemplateCategory,
} from '@/lib/templates/provider-templates';

interface TemplateSelectorProps {
  providerType?: ProviderType;
  selectedTemplate?: ProviderTemplate;
  onTemplateSelect: (template: ProviderTemplate | null) => void;
  className?: string;
}

const getProviderTypeIcon = (type: ProviderType) => {
  const icons = {
    'spawn-cli': Terminal,
    'http-sdk': Globe,
    'proxy': Zap,
    'local': Server,
  };
  return icons[type];
};

const getCategoryIcon = (category: TemplateCategory) => {
  const icons = {
    popular: Star,
    cloud: Globe,
    local: Server,
    custom: Sparkles,
  };
  return icons[category];
};

export const TemplateSelector: React.FC<TemplateSelectorProps> = ({
  providerType,
  selectedTemplate,
  onTemplateSelect,
  className,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<TemplateCategory | 'all'>('all');
  const [selectedType, setSelectedType] = useState<ProviderType | 'all'>(providerType || 'all');

  // Filter templates based on current selections
  const filteredTemplates = useMemo(() => {
    let templates = providerTemplates;

    // Filter by provider type
    if (selectedType !== 'all') {
      templates = getTemplatesByType(selectedType);
    }

    // Filter by category
    if (selectedCategory !== 'all') {
      templates = templates.filter(t => t.category === selectedCategory);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      templates = searchTemplates(searchQuery);
      // Re-apply type and category filters after search
      if (selectedType !== 'all') {
        templates = templates.filter(t => t.type === selectedType);
      }
      if (selectedCategory !== 'all') {
        templates = templates.filter(t => t.category === selectedCategory);
      }
    }

    return templates;
  }, [selectedType, selectedCategory, searchQuery]);

  // Group templates by category for display
  const groupedTemplates = useMemo(() => {
    const groups: Record<TemplateCategory, ProviderTemplate[]> = {
      popular: [],
      cloud: [],
      local: [],
      custom: [],
    };

    filteredTemplates.forEach(template => {
      groups[template.category].push(template);
    });

    return groups;
  }, [filteredTemplates]);

  const handleTemplateSelect = useCallback((template: ProviderTemplate) => {
    onTemplateSelect(template);
    setIsOpen(false);
  }, [onTemplateSelect]);

  const clearTemplate = useCallback(() => {
    onTemplateSelect(null);
  }, [onTemplateSelect]);

  const clearFilters = useCallback(() => {
    setSearchQuery('');
    setSelectedCategory('all');
    setSelectedType(providerType || 'all');
  }, [providerType]);

  const renderTemplateCard = (template: ProviderTemplate) => {
    const TypeIcon = getProviderTypeIcon(template.type);
    const isSelected = selectedTemplate?.id === template.id;

    return (
      <Card
        key={template.id}
        className={cn(
          'cursor-pointer transition-all hover:shadow-md',
          isSelected && 'ring-2 ring-primary'
        )}
        onClick={() => handleTemplateSelect(template)}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="text-2xl">{template.icon}</div>
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  {template.name}
                  <Badge variant="outline" className="text-xs">
                    <TypeIcon className="h-3 w-3 mr-1" />
                    {template.type}
                  </Badge>
                </CardTitle>
                <CardDescription className="text-sm">
                  {template.description}
                </CardDescription>
              </div>
            </div>
            {isSelected && (
              <CheckCircle className="h-5 w-5 text-primary" />
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-3">
            {/* Model count */}
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span>{template.models.length} model{template.models.length > 1 ? 's' : ''}</span>
              {template.credentials && (
                <span>{template.credentials.length} credential{template.credentials.length > 1 ? 's' : ''}</span>
              )}
            </div>

            {/* Features */}
            <div className="flex flex-wrap gap-1">
              {template.models.some(m => m.supportsStreaming) && (
                <Badge variant="secondary" className="text-xs">Streaming</Badge>
              )}
              {template.models.some(m => m.supportsEmbeddings) && (
                <Badge variant="secondary" className="text-xs">Embeddings</Badge>
              )}
              {template.adapterConfig.dockerSandbox && (
                <Badge variant="secondary" className="text-xs">Docker</Badge>
              )}
            </div>

            {/* Documentation links */}
            {template.documentation && (
              <div className="flex gap-2">
                {template.documentation.setupUrl && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      window.open(template.documentation?.setupUrl, '_blank');
                    }}
                  >
                    Setup
                    <ExternalLink className="h-3 w-3 ml-1" />
                  </Button>
                )}
                {template.documentation.apiDocsUrl && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      window.open(template.documentation?.apiDocsUrl, '_blank');
                    }}
                  >
                    API Docs
                    <ExternalLink className="h-3 w-3 ml-1" />
                  </Button>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderTemplateGrid = (templates: ProviderTemplate[]) => {
    if (templates.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          <Info className="h-8 w-8 mx-auto mb-2" />
          <p>No templates found matching your criteria.</p>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {templates.map(renderTemplateCard)}
      </div>
    );
  };

  return (
    <div className={className}>
      {/* Current selection display */}
      <div className="space-y-2">
        <Label>Configuration Template</Label>
        {selectedTemplate ? (
          <Card className="p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="text-lg">{selectedTemplate.icon}</div>
                <div>
                  <div className="font-medium text-sm">{selectedTemplate.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {selectedTemplate.description}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  {selectedTemplate.type}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearTemplate}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </Card>
        ) : (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              No template selected. You can configure the provider manually or choose a template to get started quickly.
            </AlertDescription>
          </Alert>
        )}
      </div>

      {/* Template selector dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" className="w-full mt-2">
            <Sparkles className="h-4 w-4 mr-2" />
            {selectedTemplate ? 'Change Template' : 'Choose Template'}
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Choose Configuration Template</DialogTitle>
            <DialogDescription>
              Select a pre-configured template to quickly set up your provider with common settings.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-hidden flex flex-col">
            {/* Filters */}
            <div className="space-y-4 pb-4 border-b">
              <div className="flex gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search templates..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <Select value={selectedType} onValueChange={(value: ProviderType | 'all') => setSelectedType(value)}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="spawn-cli">Spawn CLI</SelectItem>
                    <SelectItem value="http-sdk">HTTP SDK</SelectItem>
                    <SelectItem value="proxy">Proxy</SelectItem>
                    <SelectItem value="local">Local</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={selectedCategory} onValueChange={(value: TemplateCategory | 'all') => setSelectedCategory(value)}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {templateCategories.map(category => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {(searchQuery || selectedCategory !== 'all' || selectedType !== (providerType || 'all')) && (
                  <Button variant="ghost" size="sm" onClick={clearFilters}>
                    <X className="h-4 w-4 mr-1" />
                    Clear
                  </Button>
                )}
              </div>

              <div className="text-sm text-muted-foreground">
                {filteredTemplates.length} template{filteredTemplates.length !== 1 ? 's' : ''} found
              </div>
            </div>

            {/* Templates */}
            <div className="flex-1 overflow-auto">
              <Tabs defaultValue="all" className="h-full">
                <TabsList className="grid w-full grid-cols-5">
                  <TabsTrigger value="all">All</TabsTrigger>
                  {templateCategories.map(category => {
                    const CategoryIcon = getCategoryIcon(category.id);
                    const count = groupedTemplates[category.id].length;
                    return (
                      <TabsTrigger key={category.id} value={category.id} disabled={count === 0}>
                        <CategoryIcon className="h-4 w-4 mr-1" />
                        {category.name}
                        {count > 0 && (
                          <Badge variant="secondary" className="ml-1 text-xs">
                            {count}
                          </Badge>
                        )}
                      </TabsTrigger>
                    );
                  })}
                </TabsList>

                <TabsContent value="all" className="mt-4">
                  {renderTemplateGrid(filteredTemplates)}
                </TabsContent>

                {templateCategories.map(category => (
                  <TabsContent key={category.id} value={category.id} className="mt-4">
                    <div className="mb-4">
                      <h3 className="font-medium">{category.name}</h3>
                      <p className="text-sm text-muted-foreground">{category.description}</p>
                    </div>
                    {renderTemplateGrid(groupedTemplates[category.id])}
                  </TabsContent>
                ))}
              </Tabs>
            </div>
          </div>

          <div className="flex justify-between items-center pt-4 border-t">
            <Button variant="ghost" onClick={() => onTemplateSelect(null)}>
              No Template
            </Button>
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TemplateSelector;