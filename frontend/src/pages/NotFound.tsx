import { useLocation, Link } from 'react-router-dom';
import { useEffect } from 'react';
import { APP_CONSTANTS } from '@/constants';
import { Button } from '@/components/ui/button';

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(APP_CONSTANTS.MESSAGES.ERROR_404_LOG, location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">
          {APP_CONSTANTS.MESSAGES.NOT_FOUND_TITLE}
        </h1>
        <p className="text-xl text-muted-foreground mb-4">
          {APP_CONSTANTS.MESSAGES.NOT_FOUND_MESSAGE}
        </p>
        <Button asChild>
          <Link to={APP_CONSTANTS.ROUTES.HOME}>
            {APP_CONSTANTS.MESSAGES.RETURN_HOME}
          </Link>
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
