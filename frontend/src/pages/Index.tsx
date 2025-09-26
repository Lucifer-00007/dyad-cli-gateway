import { APP_CONSTANTS } from '@/constants';
import { ThemeToggle } from '@/components/theme-toggle';

const Index = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">
          {APP_CONSTANTS.MESSAGES.WELCOME_TITLE}
        </h1>
        <p className="text-xl text-muted-foreground">
          {APP_CONSTANTS.MESSAGES.WELCOME_SUBTITLE}
        </p>
      </div>
    </div>
  );
};

export default Index;
