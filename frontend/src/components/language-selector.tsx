import React from 'react';
import { Languages, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useI18n, SUPPORTED_LOCALES, SupportedLocale, getLocaleDisplayName } from '@/lib/i18n';

interface LanguageSelectorProps {
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  showLabel?: boolean;
  className?: string;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  variant = 'outline',
  size = 'default',
  showLabel = false,
  className,
}) => {
  const { locale, setLocale, t } = useI18n();

  const handleLocaleChange = (newLocale: SupportedLocale) => {
    setLocale(newLocale);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant={variant} 
          size={size}
          className={className}
          aria-label={t('accessibility.openMenu')}
        >
          <Languages className="h-4 w-4" />
          {showLabel && (
            <span className="ml-2">
              {getLocaleDisplayName(locale)}
            </span>
          )}
          <span className="sr-only">
            {t('common.settings')} - {t('navigation.language', { fallback: 'Language' })}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>
          {t('navigation.language', { fallback: 'Language' })}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {Object.entries(SUPPORTED_LOCALES).map(([localeCode, displayName]) => (
          <DropdownMenuItem
            key={localeCode}
            onClick={() => handleLocaleChange(localeCode as SupportedLocale)}
            className="flex items-center justify-between"
          >
            <span>{displayName}</span>
            {locale === localeCode && (
              <Check className="h-4 w-4" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

// Compact language selector for mobile or space-constrained areas
export const CompactLanguageSelector: React.FC<{
  className?: string;
}> = ({ className }) => {
  const { locale, setLocale } = useI18n();

  return (
    <select
      value={locale}
      onChange={(e) => setLocale(e.target.value as SupportedLocale)}
      className={`
        bg-background border border-input rounded-md px-2 py-1 text-sm
        focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2
        ${className}
      `}
      aria-label="Select language"
    >
      {Object.entries(SUPPORTED_LOCALES).map(([localeCode, displayName]) => (
        <option key={localeCode} value={localeCode}>
          {displayName}
        </option>
      ))}
    </select>
  );
};

export default LanguageSelector;