/**
 * API Key Permissions Editor Component
 * Allows selecting and configuring permissions for API keys
 */

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Search, Shield, Eye, Edit, Settings, Info, CheckCircle2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ApiKeyPermission } from '../types';

interface ApiKeyPermissionsEditorProps {
  permissions: ApiKeyPermission[];
  selectedPermissions: string[];
  onPermissionsChange: (permissions: string[]) => void;
  readOnly?: boolean;
}

const PERMISSION_CATEGORIES = {
  read: {
    name: 'Read Access',
    description: 'View and retrieve data',
    icon: Eye,
    color: 'bg-blue-100 text-blue-800 border-blue-200',
  },
  write: {
    name: 'Write Access', 
    description: 'Create and modify data',
    icon: Edit,
    color: 'bg-orange-100 text-orange-800 border-orange-200',
  },
  admin: {
    name: 'Administrative',
    description: 'System administration and configuration',
    icon: Settings,
    color: 'bg-red-100 text-red-800 border-red-200',
  },
} as const;

const PERMISSION_PRESETS = {
  basic: {
    name: 'Basic API Access',
    description: 'Essential permissions for API usage',
    permissions: ['chat.completions', 'models.list'],
  },
  standard: {
    name: 'Standard Access',
    description: 'Common permissions for most applications',
    permissions: ['chat.completions', 'models.list', 'embeddings'],
  },
  advanced: {
    name: 'Advanced Access',
    description: 'Extended permissions including monitoring',
    permissions: ['chat.completions', 'models.list', 'embeddings', 'admin.metrics.read'],
  },
  admin: {
    name: 'Full Administrative',
    description: 'Complete access to all features',
    permissions: ['chat.completions', 'models.list', 'embeddings', 'admin.providers.read', 'admin.providers.write', 'admin.metrics.read'],
  },
};

export const ApiKeyPermissionsEditor: React.FC<ApiKeyPermissionsEditorProps> = ({
  permissions,
  selectedPermissions,
  onPermissionsChange,
  readOnly = false,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'read' | 'write' | 'admin'>('all');

  const filteredPermissions = useMemo(() => {
    return permissions.filter(permission => {
      const matchesSearch = permission.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           permission.description.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || permission.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [permissions, searchTerm, selectedCategory]);

  const permissionsByCategory = useMemo(() => {
    const grouped = filteredPermissions.reduce((acc, permission) => {
      if (!acc[permission.category]) {
        acc[permission.category] = [];
      }
      acc[permission.category].push(permission);
      return acc;
    }, {} as Record<string, ApiKeyPermission[]>);

    return grouped;
  }, [filteredPermissions]);

  const handlePermissionToggle = (permissionId: string, checked: boolean) => {
    if (readOnly) return;

    const newPermissions = checked
      ? [...selectedPermissions, permissionId]
      : selectedPermissions.filter(id => id !== permissionId);
    
    onPermissionsChange(newPermissions);
  };

  const handleSelectAll = (category?: string) => {
    if (readOnly) return;

    const categoryPermissions = category 
      ? permissions.filter(p => p.category === category)
      : filteredPermissions;
    
    const categoryIds = categoryPermissions.map(p => p.id);
    const allSelected = categoryIds.every(id => selectedPermissions.includes(id));
    
    if (allSelected) {
      // Deselect all in category
      const newPermissions = selectedPermissions.filter(id => !categoryIds.includes(id));
      onPermissionsChange(newPermissions);
    } else {
      // Select all in category
      const newPermissions = [...new Set([...selectedPermissions, ...categoryIds])];
      onPermissionsChange(newPermissions);
    }
  };

  const applyPreset = (presetKey: keyof typeof PERMISSION_PRESETS) => {
    if (readOnly) return;
    onPermissionsChange(PERMISSION_PRESETS[presetKey].permissions);
  };

  const getPermissionStats = () => {
    const total = permissions.length;
    const selected = selectedPermissions.length;
    const byCategory = Object.keys(PERMISSION_CATEGORIES).reduce((acc, category) => {
      const categoryPerms = permissions.filter(p => p.category === category);
      const selectedInCategory = categoryPerms.filter(p => selectedPermissions.includes(p.id));
      acc[category] = {
        total: categoryPerms.length,
        selected: selectedInCategory.length,
      };
      return acc;
    }, {} as Record<string, { total: number; selected: number }>);

    return { total, selected, byCategory };
  };

  const stats = getPermissionStats();

  return (
    <div className="space-y-6">
      {/* Permission Presets */}
      {!readOnly && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center space-x-2">
              <Shield className="h-4 w-4" />
              <span>Quick Presets</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {Object.entries(PERMISSION_PRESETS).map(([key, preset]) => (
                <Button
                  key={key}
                  variant="outline"
                  className="h-auto p-3 flex flex-col items-start space-y-1"
                  onClick={() => applyPreset(key as keyof typeof PERMISSION_PRESETS)}
                >
                  <div className="font-medium text-sm">{preset.name}</div>
                  <div className="text-xs text-muted-foreground text-left">
                    {preset.description}
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {preset.permissions.length} permissions
                  </Badge>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats and Search */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">
              Permissions ({stats.selected}/{stats.total} selected)
            </CardTitle>
            <div className="flex items-center space-x-2">
              {Object.entries(stats.byCategory).map(([category, stat]) => {
                const categoryInfo = PERMISSION_CATEGORIES[category as keyof typeof PERMISSION_CATEGORIES];
                const Icon = categoryInfo.icon;
                return (
                  <Badge key={category} variant="outline" className="text-xs">
                    <Icon className="h-3 w-3 mr-1" />
                    {stat.selected}/{stat.total}
                  </Badge>
                );
              })}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search and Filter */}
          <div className="flex items-center space-x-4">
            <div className="flex-1 relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search permissions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
            <Tabs value={selectedCategory} onValueChange={(value: any) => setSelectedCategory(value)}>
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="read">Read</TabsTrigger>
                <TabsTrigger value="write">Write</TabsTrigger>
                <TabsTrigger value="admin">Admin</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Permissions List */}
          <div className="space-y-4">
            {Object.entries(permissionsByCategory).map(([category, categoryPermissions]) => {
              const categoryInfo = PERMISSION_CATEGORIES[category as keyof typeof PERMISSION_CATEGORIES];
              const Icon = categoryInfo.icon;
              const allSelected = categoryPermissions.every(p => selectedPermissions.includes(p.id));
              const someSelected = categoryPermissions.some(p => selectedPermissions.includes(p.id));

              return (
                <div key={category} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Icon className="h-4 w-4" />
                      <h4 className="font-medium">{categoryInfo.name}</h4>
                      <Badge variant="outline" className={cn("text-xs", categoryInfo.color)}>
                        {categoryPermissions.length} permissions
                      </Badge>
                    </div>
                    {!readOnly && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSelectAll(category)}
                        className="text-xs"
                      >
                        {allSelected ? 'Deselect All' : 'Select All'}
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-2">
                    {categoryPermissions.map((permission) => {
                      const isSelected = selectedPermissions.includes(permission.id);
                      return (
                        <Card
                          key={permission.id}
                          className={cn(
                            "transition-colors",
                            isSelected && "bg-blue-50 border-blue-200",
                            !readOnly && "cursor-pointer hover:bg-gray-50"
                          )}
                          onClick={() => !readOnly && handlePermissionToggle(permission.id, !isSelected)}
                        >
                          <CardContent className="p-3">
                            <div className="flex items-start space-x-3">
                              {!readOnly && (
                                <Checkbox
                                  checked={isSelected}
                                  onCheckedChange={(checked) => 
                                    handlePermissionToggle(permission.id, !!checked)
                                  }
                                  className="mt-0.5"
                                />
                              )}
                              {readOnly && (
                                <div className="mt-0.5">
                                  {isSelected ? (
                                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                                  ) : (
                                    <AlertCircle className="h-4 w-4 text-gray-400" />
                                  )}
                                </div>
                              )}
                              <div className="flex-1 space-y-1">
                                <div className="flex items-center space-x-2">
                                  <span className="font-medium text-sm">{permission.name}</span>
                                  <Badge 
                                    variant="outline" 
                                    className={cn("text-xs", categoryInfo.color)}
                                  >
                                    {permission.category}
                                  </Badge>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  {permission.description}
                                </p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {filteredPermissions.length === 0 && (
            <div className="text-center py-8">
              <Search className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                No permissions found matching your search.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Security Notice */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          <strong>Security Note:</strong> Only grant the minimum permissions necessary for your use case. 
          Administrative permissions should be used sparingly and only for trusted applications.
        </AlertDescription>
      </Alert>
    </div>
  );
};