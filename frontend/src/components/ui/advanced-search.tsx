/**
 * Advanced search and filtering UI components
 */

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import { Separator } from '@/components/ui/separator';
import {
  Search,
  Filter,
  X,
  Plus,
  Download,
  SortAsc,
  SortDesc,
  Calendar as CalendarIcon,
} from 'lucide-react';
import { SearchFilter, SearchConfig, SortConfig } from '@/hooks/use-advanced-search';
import { format } from 'date-fns';

export interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  suggestions?: string[];
  onSuggestionSelect?: (suggestion: string) => void;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onChange,
  placeholder = 'Search...',
  suggestions = [],
  onSuggestionSelect,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="pl-10"
          onFocus={() => setIsOpen(true)}
          onBlur={() => setTimeout(() => setIsOpen(false), 200)}
        />
      </div>
      
      {isOpen && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-background border rounded-md shadow-lg">
          <div className="max-h-60 overflow-auto">
            {suggestions.map((suggestion, index) => (
              <button
                key={index}
                className="w-full px-3 py-2 text-left hover:bg-muted text-sm"
                onClick={() => {
                  onSuggestionSelect?.(suggestion);
                  setIsOpen(false);
                }}
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export interface FilterBuilderProps {
  config: SearchConfig;
  filters: SearchFilter[];
  onAddFilter: (filter: SearchFilter) => void;
  onRemoveFilter: (field: string) => void;
  onClearFilters: () => void;
}

export const FilterBuilder: React.FC<FilterBuilderProps> = ({
  config,
  filters,
  onAddFilter,
  onRemoveFilter,
  onClearFilters,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [newFilter, setNewFilter] = useState<Partial<SearchFilter>>({});

  const handleAddFilter = () => {
    if (newFilter.field && newFilter.operator && newFilter.value !== undefined) {
      const fieldConfig = config.filterableFields.find(f => f.field === newFilter.field);
      onAddFilter({
        field: newFilter.field,
        operator: newFilter.operator,
        value: newFilter.value,
        type: fieldConfig?.type || 'string',
      } as SearchFilter);
      setNewFilter({});
      setIsOpen(false);
    }
  };

  const getOperatorOptions = (fieldType: string) => {
    switch (fieldType) {
      case 'string':
        return [
          { value: 'equals', label: 'Equals' },
          { value: 'contains', label: 'Contains' },
          { value: 'startsWith', label: 'Starts with' },
          { value: 'endsWith', label: 'Ends with' },
        ];
      case 'number':
      case 'date':
        return [
          { value: 'equals', label: 'Equals' },
          { value: 'gt', label: 'Greater than' },
          { value: 'lt', label: 'Less than' },
          { value: 'gte', label: 'Greater than or equal' },
          { value: 'lte', label: 'Less than or equal' },
          { value: 'between', label: 'Between' },
        ];
      case 'boolean':
        return [
          { value: 'equals', label: 'Equals' },
        ];
      case 'select':
      case 'multiselect':
        return [
          { value: 'equals', label: 'Equals' },
          { value: 'in', label: 'In' },
          { value: 'notIn', label: 'Not in' },
        ];
      default:
        return [
          { value: 'equals', label: 'Equals' },
          { value: 'contains', label: 'Contains' },
        ];
    }
  };

  const renderValueInput = () => {
    const fieldConfig = config.filterableFields.find(f => f.field === newFilter.field);
    if (!fieldConfig) return null;

    switch (fieldConfig.type) {
      case 'string':
        return (
          <Input
            placeholder="Enter value"
            value={newFilter.value || ''}
            onChange={(e) => setNewFilter(prev => ({ ...prev, value: e.target.value }))}
          />
        );
      
      case 'number':
        return (
          <Input
            type="number"
            placeholder="Enter number"
            value={newFilter.value || ''}
            onChange={(e) => setNewFilter(prev => ({ ...prev, value: Number(e.target.value) }))}
          />
        );
      
      case 'date':
        return (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-start text-left font-normal">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {newFilter.value ? format(new Date(newFilter.value), 'PPP') : 'Pick a date'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={newFilter.value ? new Date(newFilter.value) : undefined}
                onSelect={(date) => setNewFilter(prev => ({ ...prev, value: date?.toISOString() }))}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        );
      
      case 'boolean':
        return (
          <Select
            value={newFilter.value?.toString()}
            onValueChange={(value) => setNewFilter(prev => ({ ...prev, value: value === 'true' }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select value" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="true">True</SelectItem>
              <SelectItem value="false">False</SelectItem>
            </SelectContent>
          </Select>
        );
      
      case 'select':
      case 'multiselect':
        return (
          <Select
            value={newFilter.value}
            onValueChange={(value) => setNewFilter(prev => ({ ...prev, value }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select value" />
            </SelectTrigger>
            <SelectContent>
              {fieldConfig.options?.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      
      default:
        return (
          <Input
            placeholder="Enter value"
            value={newFilter.value || ''}
            onChange={(e) => setNewFilter(prev => ({ ...prev, value: e.target.value }))}
          />
        );
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Filter className="h-4 w-4" />
          <span className="text-sm font-medium">Filters</span>
          {filters.length > 0 && (
            <Badge variant="secondary">{filters.length}</Badge>
          )}
        </div>
        <div className="flex items-center space-x-2">
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Plus className="h-3 w-3 mr-1" />
                Add Filter
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Filter</DialogTitle>
                <DialogDescription>
                  Create a new filter to narrow down your search results.
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4">
                <div>
                  <Label>Field</Label>
                  <Select
                    value={newFilter.field}
                    onValueChange={(value) => setNewFilter(prev => ({ ...prev, field: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select field" />
                    </SelectTrigger>
                    <SelectContent>
                      {config.filterableFields.map(field => (
                        <SelectItem key={field.field} value={field.field}>
                          {field.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {newFilter.field && (
                  <div>
                    <Label>Operator</Label>
                    <Select
                      value={newFilter.operator}
                      onValueChange={(value) => setNewFilter(prev => ({ ...prev, operator: value as SearchFilter['operator'] }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select operator" />
                      </SelectTrigger>
                      <SelectContent>
                        {getOperatorOptions(
                          config.filterableFields.find(f => f.field === newFilter.field)?.type || 'string'
                        ).map(op => (
                          <SelectItem key={op.value} value={op.value}>
                            {op.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {newFilter.field && newFilter.operator && (
                  <div>
                    <Label>Value</Label>
                    {renderValueInput()}
                  </div>
                )}

                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={() => setIsOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleAddFilter}>
                    Add Filter
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          
          {filters.length > 0 && (
            <Button variant="ghost" size="sm" onClick={onClearFilters}>
              Clear All
            </Button>
          )}
        </div>
      </div>

      {filters.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {filters.map((filter, index) => {
            const fieldConfig = config.filterableFields.find(f => f.field === filter.field);
            return (
              <Badge key={index} variant="secondary" className="flex items-center space-x-1">
                <span>
                  {fieldConfig?.label || filter.field} {filter.operator} {filter.value}
                </span>
                <button
                  onClick={() => onRemoveFilter(filter.field)}
                  className="ml-1 hover:bg-muted rounded-full p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            );
          })}
        </div>
      )}
    </div>
  );
};

export interface SortControlProps {
  config: SearchConfig;
  sort: SortConfig | null;
  onSortChange: (sort: SortConfig | null) => void;
}

export const SortControl: React.FC<SortControlProps> = ({
  config,
  sort,
  onSortChange,
}) => {
  return (
    <Select
      value={sort ? `${sort.field}-${sort.direction}` : ''}
      onValueChange={(value) => {
        if (!value) {
          onSortChange(null);
          return;
        }
        const [field, direction] = value.split('-');
        onSortChange({ field, direction: direction as 'asc' | 'desc' });
      }}
    >
      <SelectTrigger className="w-[200px]">
        <SelectValue placeholder="Sort by..." />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="">No sorting</SelectItem>
        {config.sortableFields.map(field => (
          <React.Fragment key={field.field}>
            <SelectItem value={`${field.field}-asc`}>
              <div className="flex items-center">
                <SortAsc className="h-4 w-4 mr-2" />
                {field.label} (A-Z)
              </div>
            </SelectItem>
            <SelectItem value={`${field.field}-desc`}>
              <div className="flex items-center">
                <SortDesc className="h-4 w-4 mr-2" />
                {field.label} (Z-A)
              </div>
            </SelectItem>
          </React.Fragment>
        ))}
      </SelectContent>
    </Select>
  );
};

export interface ExportControlProps {
  onExport: (format: 'csv' | 'json') => void;
  disabled?: boolean;
  itemCount: number;
}

export const ExportControl: React.FC<ExportControlProps> = ({
  onExport,
  disabled = false,
  itemCount,
}) => {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" disabled={disabled || itemCount === 0}>
          <Download className="h-4 w-4 mr-2" />
          Export ({itemCount})
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-48">
        <div className="space-y-2">
          <Button
            variant="ghost"
            className="w-full justify-start"
            onClick={() => onExport('csv')}
          >
            Export as CSV
          </Button>
          <Button
            variant="ghost"
            className="w-full justify-start"
            onClick={() => onExport('json')}
          >
            Export as JSON
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};