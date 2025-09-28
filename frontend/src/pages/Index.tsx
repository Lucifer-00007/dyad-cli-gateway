import { ThemeToggle } from '@/components/theme-toggle';
import { TestSetup } from "@/components/test-setup";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <TestSetup />
    </div>
  );
};

export default Index;
