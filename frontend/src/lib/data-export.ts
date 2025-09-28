/**
 * Data export functionality for CSV, JSON, and other formats
 */

export interface ExportOptions {
  filename?: string;
  includeHeaders?: boolean;
  dateFormat?: 'iso' | 'locale' | 'custom';
  customDateFormat?: string;
  excludeFields?: string[];
  includeFields?: string[];
  transformData?: (data: any[]) => any[];
}

export interface ExportColumn {
  key: string;
  label: string;
  transform?: (value: any, row: any) => any;
}

export class DataExporter {
  /**
   * Export data to CSV format
   */
  static exportToCSV<T extends Record<string, any>>(
    data: T[],
    options: ExportOptions & { columns?: ExportColumn[] } = {}
  ): void {
    if (data.length === 0) {
      throw new Error('No data to export');
    }

    const {
      filename = `export-${new Date().toISOString().split('T')[0]}.csv`,
      includeHeaders = true,
      columns,
      transformData,
      excludeFields = [],
      includeFields,
    } = options;

    let processedData = transformData ? transformData(data) : [...data];

    // Determine columns to include
    let columnsToUse: ExportColumn[];
    if (columns) {
      columnsToUse = columns;
    } else {
      const allKeys = new Set<string>();
      processedData.forEach(row => {
        Object.keys(row).forEach(key => allKeys.add(key));
      });

      let keysArray = Array.from(allKeys);
      
      if (includeFields && includeFields.length > 0) {
        keysArray = keysArray.filter(key => includeFields.includes(key));
      }
      
      if (excludeFields.length > 0) {
        keysArray = keysArray.filter(key => !excludeFields.includes(key));
      }

      columnsToUse = keysArray.map(key => ({ key, label: key }));
    }

    // Build CSV content
    const csvRows: string[] = [];

    // Add headers
    if (includeHeaders) {
      const headers = columnsToUse.map(col => this.escapeCSVValue(col.label));
      csvRows.push(headers.join(','));
    }

    // Add data rows
    processedData.forEach(row => {
      const values = columnsToUse.map(col => {
        let value = this.getNestedValue(row, col.key);
        
        // Apply column transformation
        if (col.transform) {
          value = col.transform(value, row);
        }
        
        // Format dates
        if (value instanceof Date) {
          value = this.formatDate(value, options);
        }
        
        return this.escapeCSVValue(value);
      });
      csvRows.push(values.join(','));
    });

    const csvContent = csvRows.join('\n');
    this.downloadFile(csvContent, filename, 'text/csv;charset=utf-8;');
  }

  /**
   * Export data to JSON format
   */
  static exportToJSON<T extends Record<string, any>>(
    data: T[],
    options: ExportOptions = {}
  ): void {
    const {
      filename = `export-${new Date().toISOString().split('T')[0]}.json`,
      transformData,
      excludeFields = [],
      includeFields,
    } = options;

    let processedData = transformData ? transformData(data) : [...data];

    // Filter fields if specified
    if (includeFields && includeFields.length > 0) {
      processedData = processedData.map(row => 
        this.filterObject(row, includeFields, 'include')
      );
    } else if (excludeFields.length > 0) {
      processedData = processedData.map(row => 
        this.filterObject(row, excludeFields, 'exclude')
      );
    }

    // Format dates in the data
    processedData = processedData.map(row => 
      this.formatDatesInObject(row, options)
    );

    const jsonContent = JSON.stringify(processedData, null, 2);
    this.downloadFile(jsonContent, filename, 'application/json;charset=utf-8;');
  }

  /**
   * Export data to Excel format (using CSV with Excel-specific formatting)
   */
  static exportToExcel<T extends Record<string, any>>(
    data: T[],
    options: ExportOptions & { columns?: ExportColumn[] } = {}
  ): void {
    const excelOptions = {
      ...options,
      filename: options.filename?.replace('.csv', '.xlsx') || 
                `export-${new Date().toISOString().split('T')[0]}.xlsx`,
    };

    // Add BOM for Excel UTF-8 support
    const csvContent = '\uFEFF' + this.generateCSVContent(data, excelOptions);
    this.downloadFile(csvContent, excelOptions.filename!, 'application/vnd.ms-excel;charset=utf-8;');
  }

  /**
   * Export data to XML format
   */
  static exportToXML<T extends Record<string, any>>(
    data: T[],
    options: ExportOptions & { rootElement?: string; itemElement?: string } = {}
  ): void {
    const {
      filename = `export-${new Date().toISOString().split('T')[0]}.xml`,
      rootElement = 'data',
      itemElement = 'item',
      transformData,
      excludeFields = [],
      includeFields,
    } = options;

    let processedData = transformData ? transformData(data) : [...data];

    // Filter fields if specified
    if (includeFields && includeFields.length > 0) {
      processedData = processedData.map(row => 
        this.filterObject(row, includeFields, 'include')
      );
    } else if (excludeFields.length > 0) {
      processedData = processedData.map(row => 
        this.filterObject(row, excludeFields, 'exclude')
      );
    }

    const xmlContent = this.generateXMLContent(processedData, rootElement, itemElement, options);
    this.downloadFile(xmlContent, filename, 'application/xml;charset=utf-8;');
  }

  /**
   * Generate report with multiple sheets/sections
   */
  static exportReport(
    sections: Array<{
      name: string;
      data: any[];
      options?: ExportOptions;
    }>,
    format: 'json' | 'csv' = 'json',
    filename?: string
  ): void {
    const timestamp = new Date().toISOString().split('T')[0];
    const reportFilename = filename || `report-${timestamp}.${format}`;

    if (format === 'json') {
      const report = {
        generatedAt: new Date().toISOString(),
        sections: sections.reduce((acc, section) => {
          let processedData = section.data;
          
          if (section.options?.transformData) {
            processedData = section.options.transformData(processedData);
          }
          
          acc[section.name] = processedData;
          return acc;
        }, {} as Record<string, any>),
      };

      const jsonContent = JSON.stringify(report, null, 2);
      this.downloadFile(jsonContent, reportFilename, 'application/json;charset=utf-8;');
    } else {
      // For CSV, create a zip file with multiple CSV files
      // This is a simplified version - in a real implementation, you'd use a zip library
      const csvContents = sections.map(section => {
        const csvContent = this.generateCSVContent(section.data, section.options || {});
        return `=== ${section.name} ===\n${csvContent}\n\n`;
      }).join('');

      this.downloadFile(csvContents, reportFilename, 'text/csv;charset=utf-8;');
    }
  }

  /**
   * Helper method to generate CSV content
   */
  private static generateCSVContent<T extends Record<string, any>>(
    data: T[],
    options: ExportOptions & { columns?: ExportColumn[] }
  ): string {
    if (data.length === 0) return '';

    const {
      includeHeaders = true,
      columns,
      transformData,
      excludeFields = [],
      includeFields,
    } = options;

    let processedData = transformData ? transformData(data) : [...data];

    // Determine columns
    let columnsToUse: ExportColumn[];
    if (columns) {
      columnsToUse = columns;
    } else {
      const allKeys = new Set<string>();
      processedData.forEach(row => {
        Object.keys(row).forEach(key => allKeys.add(key));
      });

      let keysArray = Array.from(allKeys);
      
      if (includeFields && includeFields.length > 0) {
        keysArray = keysArray.filter(key => includeFields.includes(key));
      }
      
      if (excludeFields.length > 0) {
        keysArray = keysArray.filter(key => !excludeFields.includes(key));
      }

      columnsToUse = keysArray.map(key => ({ key, label: key }));
    }

    const csvRows: string[] = [];

    // Add headers
    if (includeHeaders) {
      const headers = columnsToUse.map(col => this.escapeCSVValue(col.label));
      csvRows.push(headers.join(','));
    }

    // Add data rows
    processedData.forEach(row => {
      const values = columnsToUse.map(col => {
        let value = this.getNestedValue(row, col.key);
        
        if (col.transform) {
          value = col.transform(value, row);
        }
        
        if (value instanceof Date) {
          value = this.formatDate(value, options);
        }
        
        return this.escapeCSVValue(value);
      });
      csvRows.push(values.join(','));
    });

    return csvRows.join('\n');
  }

  /**
   * Generate XML content
   */
  private static generateXMLContent(
    data: any[],
    rootElement: string,
    itemElement: string,
    options: ExportOptions
  ): string {
    const xmlRows = [`<?xml version="1.0" encoding="UTF-8"?>`, `<${rootElement}>`];

    data.forEach(item => {
      xmlRows.push(`  <${itemElement}>`);
      
      Object.entries(item).forEach(([key, value]) => {
        const formattedValue = value instanceof Date 
          ? this.formatDate(value, options)
          : this.escapeXMLValue(value);
        
        xmlRows.push(`    <${key}>${formattedValue}</${key}>`);
      });
      
      xmlRows.push(`  </${itemElement}>`);
    });

    xmlRows.push(`</${rootElement}>`);
    return xmlRows.join('\n');
  }

  /**
   * Escape CSV values
   */
  private static escapeCSVValue(value: any): string {
    if (value === null || value === undefined) return '';
    
    const stringValue = String(value);
    
    // If the value contains comma, quote, or newline, wrap in quotes and escape quotes
    if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }
    
    return stringValue;
  }

  /**
   * Escape XML values
   */
  private static escapeXMLValue(value: any): string {
    if (value === null || value === undefined) return '';
    
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Get nested object value
   */
  private static getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  /**
   * Format date based on options
   */
  private static formatDate(date: Date, options: ExportOptions): string {
    switch (options.dateFormat) {
      case 'locale':
        return date.toLocaleDateString();
      case 'custom':
        // This would require a date formatting library like date-fns
        return options.customDateFormat ? date.toISOString() : date.toISOString();
      case 'iso':
      default:
        return date.toISOString();
    }
  }

  /**
   * Filter object properties
   */
  private static filterObject(
    obj: Record<string, any>,
    fields: string[],
    mode: 'include' | 'exclude'
  ): Record<string, any> {
    const result: Record<string, any> = {};
    
    Object.entries(obj).forEach(([key, value]) => {
      const shouldInclude = mode === 'include' 
        ? fields.includes(key)
        : !fields.includes(key);
      
      if (shouldInclude) {
        result[key] = value;
      }
    });
    
    return result;
  }

  /**
   * Format dates in object recursively
   */
  private static formatDatesInObject(obj: any, options: ExportOptions): any {
    if (obj instanceof Date) {
      return this.formatDate(obj, options);
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.formatDatesInObject(item, options));
    }
    
    if (obj && typeof obj === 'object') {
      const result: any = {};
      Object.entries(obj).forEach(([key, value]) => {
        result[key] = this.formatDatesInObject(value, options);
      });
      return result;
    }
    
    return obj;
  }

  /**
   * Download file to user's device
   */
  private static downloadFile(content: string, filename: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up the URL object
    setTimeout(() => URL.revokeObjectURL(url), 100);
  }
}