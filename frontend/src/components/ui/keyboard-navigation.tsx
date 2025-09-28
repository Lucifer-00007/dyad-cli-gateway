import React, { forwardRef } from 'react';
import { useKeyboardNavigation, useFocusTrap } from '@/hooks/use-accessibility';
import { cn } from '@/lib/utils';

// Accessible list component with keyboard navigation
export interface AccessibleListProps<T> {
  items: T[];
  onSelect: (item: T, index: number) => void;
  renderItem: (item: T, index: number, props: any) => React.ReactNode;
  orientation?: 'horizontal' | 'vertical';
  loop?: boolean;
  className?: string;
  itemClassName?: string;
  role?: string;
  ariaLabel?: string;
  ariaLabelledBy?: string;
}

export function AccessibleList<T>({
  items,
  onSelect,
  renderItem,
  orientation = 'vertical',
  loop = true,
  className,
  itemClassName,
  role = 'listbox',
  ariaLabel,
  ariaLabelledBy,
}: AccessibleListProps<T>) {
  const { listRef, getItemProps, focusedIndex } = useKeyboardNavigation(
    items,
    onSelect,
    { orientation, loop }
  );

  return (
    <div
      ref={listRef}
      role={role}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      aria-activedescendant={`item-${focusedIndex}`}
      className={cn('focus:outline-none', className)}
      tabIndex={0}
    >
      {items.map((item, index) => (
        <div
          key={index}
          id={`item-${index}`}
          role="option"
          aria-selected={index === focusedIndex}
          className={cn(
            'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded-md',
            itemClassName
          )}
          {...getItemProps(index)}
        >
          {renderItem(item, index, { focused: index === focusedIndex })}
        </div>
      ))}
    </div>
  );
}

// Accessible menu component
export interface AccessibleMenuProps {
  children: React.ReactNode;
  onClose?: () => void;
  className?: string;
  trapFocus?: boolean;
}

export const AccessibleMenu = forwardRef<HTMLDivElement, AccessibleMenuProps>(
  ({ children, onClose, className, trapFocus = true }, ref) => {
    const focusTrapRef = useFocusTrap(trapFocus);

    React.useEffect(() => {
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          onClose?.();
        }
      };

      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }, [onClose]);

    return (
      <div
        ref={ref || focusTrapRef}
        role="menu"
        className={cn('focus:outline-none', className)}
        tabIndex={-1}
      >
        {children}
      </div>
    );
  }
);

AccessibleMenu.displayName = 'AccessibleMenu';

// Accessible menu item
export interface AccessibleMenuItemProps {
  children: React.ReactNode;
  onSelect?: () => void;
  disabled?: boolean;
  className?: string;
  shortcut?: string;
}

export const AccessibleMenuItem = forwardRef<HTMLDivElement, AccessibleMenuItemProps>(
  ({ children, onSelect, disabled = false, className, shortcut }, ref) => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
        e.preventDefault();
        onSelect?.();
      }
    };

    const handleClick = () => {
      if (!disabled) {
        onSelect?.();
      }
    };

    return (
      <div
        ref={ref}
        role="menuitem"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        className={cn(
          'flex items-center justify-between px-2 py-1.5 text-sm cursor-pointer',
          'focus:outline-none focus:bg-accent focus:text-accent-foreground',
          'hover:bg-accent hover:text-accent-foreground',
          disabled && 'opacity-50 cursor-not-allowed',
          className
        )}
        onClick={handleClick}
        onKeyDown={handleKeyDown as any}
      >
        <span>{children}</span>
        {shortcut && (
          <span className="text-xs text-muted-foreground ml-4">{shortcut}</span>
        )}
      </div>
    );
  }
);

AccessibleMenuItem.displayName = 'AccessibleMenuItem';

// Accessible tabs component
export interface AccessibleTabsProps {
  tabs: Array<{
    id: string;
    label: string;
    content: React.ReactNode;
    disabled?: boolean;
  }>;
  activeTab: string;
  onTabChange: (tabId: string) => void;
  className?: string;
  tabListClassName?: string;
  tabClassName?: string;
  tabPanelClassName?: string;
}

export const AccessibleTabs: React.FC<AccessibleTabsProps> = ({
  tabs,
  activeTab,
  onTabChange,
  className,
  tabListClassName,
  tabClassName,
  tabPanelClassName,
}) => {
  const { listRef, getItemProps, focusedIndex } = useKeyboardNavigation(
    tabs,
    (tab) => {
      if (!tab.disabled) {
        onTabChange(tab.id);
      }
    },
    { orientation: 'horizontal' }
  );

  const activeTabContent = tabs.find(tab => tab.id === activeTab)?.content;

  return (
    <div className={className}>
      <div
        ref={listRef}
        role="tablist"
        className={cn('flex border-b', tabListClassName)}
        tabIndex={0}
      >
        {tabs.map((tab, index) => (
          <button
            key={tab.id}
            id={`tab-${tab.id}`}
            role="tab"
            aria-selected={tab.id === activeTab}
            aria-controls={`tabpanel-${tab.id}`}
            aria-disabled={tab.disabled}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 border-transparent',
              'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
              'hover:text-foreground hover:border-border',
              tab.id === activeTab && 'border-primary text-primary',
              tab.disabled && 'opacity-50 cursor-not-allowed',
              tabClassName
            )}
            {...getItemProps(index)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      
      <div
        id={`tabpanel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`tab-${activeTab}`}
        tabIndex={0}
        className={cn('mt-4 focus:outline-none', tabPanelClassName)}
      >
        {activeTabContent}
      </div>
    </div>
  );
};

// Accessible disclosure/collapsible component
export interface AccessibleDisclosureProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  onToggle?: (open: boolean) => void;
  className?: string;
  buttonClassName?: string;
  contentClassName?: string;
}

export const AccessibleDisclosure: React.FC<AccessibleDisclosureProps> = ({
  title,
  children,
  defaultOpen = false,
  onToggle,
  className,
  buttonClassName,
  contentClassName,
}) => {
  const [isOpen, setIsOpen] = React.useState(defaultOpen);
  const contentId = React.useId();

  const handleToggle = () => {
    const newOpen = !isOpen;
    setIsOpen(newOpen);
    onToggle?.(newOpen);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleToggle();
    }
  };

  return (
    <div className={className}>
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls={contentId}
        className={cn(
          'flex items-center justify-between w-full text-left',
          'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
          buttonClassName
        )}
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
      >
        <span>{title}</span>
        <span
          className={cn(
            'transform transition-transform duration-200',
            isOpen && 'rotate-180'
          )}
          aria-hidden="true"
        >
          ▼
        </span>
      </button>
      
      <div
        id={contentId}
        role="region"
        aria-labelledby={`${contentId}-button`}
        className={cn(
          'overflow-hidden transition-all duration-200',
          isOpen ? 'max-h-screen opacity-100' : 'max-h-0 opacity-0',
          contentClassName
        )}
      >
        {children}
      </div>
    </div>
  );
};

// Skip link component
export const SkipLink: React.FC<{
  href: string;
  children: React.ReactNode;
  className?: string;
}> = ({ href, children, className }) => {
  return (
    <a
      href={href}
      className={cn(
        'sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50',
        'focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground',
        'focus:rounded-md focus:outline-none focus:ring-2 focus:ring-ring',
        className
      )}
    >
      {children}
    </a>
  );
};