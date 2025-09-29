@echo off
setlocal enabledelayedexpansion

REM Dyad CLI Gateway - Complete Setup Script (Windows)
REM This script sets up both frontend and backend with safety checks
REM Usage: setup.bat [options]
REM Options:
REM   --skip-deps     Skip dependency installation
REM   --skip-db       Skip database setup
REM   --skip-tests    Skip running tests
REM   --production    Setup for production environment
REM   --help          Show this help message

REM Configuration
set "SCRIPT_DIR=%~dp0"
set "PROJECT_ROOT=%SCRIPT_DIR%..\..\"
set "BACKEND_DIR=%PROJECT_ROOT%backend"
set "FRONTEND_DIR=%PROJECT_ROOT%frontend"
set "LOG_FILE=%PROJECT_ROOT%setup.log"
set "MIN_NODE_VERSION=18.0.0"

REM Default options
set "SKIP_DEPS=false"
set "SKIP_DB=false"
set "SKIP_TESTS=false"
set "PRODUCTION=false"
set "PACKAGE_MANAGER="

REM Colors (Windows doesn't support colors in batch easily, so we'll use plain text)
set "RED=[ERROR]"
set "GREEN=[SUCCESS]"
set "YELLOW=[WARNING]"
set "BLUE=[INFO]"
set "PURPLE=[SETUP]"
set "CYAN=[INFO]"

REM Initialize log file
echo Dyad CLI Gateway Setup - %date% %time% > "%LOG_FILE%"

REM Parse command line arguments
:parse_args
if "%~1"=="" goto :check_requirements
if "%~1"=="--skip-deps" (
    set "SKIP_DEPS=true"
    shift
    goto :parse_args
)
if "%~1"=="--skip-db" (
    set "SKIP_DB=true"
    shift
    goto :parse_args
)
if "%~1"=="--skip-tests" (
    set "SKIP_TESTS=true"
    shift
    goto :parse_args
)
if "%~1"=="--production" (
    set "PRODUCTION=true"
    shift
    goto :parse_args
)
if "%~1"=="--help" (
    goto :show_help
)
echo %RED% Unknown option: %~1
goto :show_help

:show_help
echo.
echo Dyad CLI Gateway - Complete Setup Script (Windows)
echo.
echo USAGE:
echo     setup.bat [OPTIONS]
echo.
echo OPTIONS:
echo     --skip-deps     Skip dependency installation
echo     --skip-db       Skip database setup
echo     --skip-tests    Skip running tests
echo     --production    Setup for production environment
echo     --help          Show this help message
echo.
echo EXAMPLES:
echo     setup.bat                    # Full development setup
echo     setup.bat --skip-tests       # Setup without running tests
echo     setup.bat --production       # Production setup
echo     setup.bat --skip-db          # Setup without database configuration
echo.
echo REQUIREMENTS:
echo     - Node.js ^>= 18.0.0
echo     - npm ^>= 8.0.0 (or pnpm/bun)
echo     - MongoDB ^>= 5.0
echo     - Git
echo.
echo For more information, see:
echo     - backend\docs\SETUP.md
echo     - frontend\docs\SETUP.md
goto :eof

:log_message
echo %GREEN% [%date% %time%] %~1
echo [%date% %time%] %~1 >> "%LOG_FILE%"
goto :eof

:warn_message
echo %YELLOW% [%date% %time%] WARNING: %~1
echo [%date% %time%] WARNING: %~1 >> "%LOG_FILE%"
goto :eof

:error_message
echo %RED% [%date% %time%] ERROR: %~1
echo [%date% %time%] ERROR: %~1 >> "%LOG_FILE%"
goto :eof

:info_message
echo %BLUE% [%date% %time%] INFO: %~1
echo [%date% %time%] INFO: %~1 >> "%LOG_FILE%"
goto :eof

:success_message
echo %GREEN% [%date% %time%] SUCCESS: %~1
echo [%date% %time%] SUCCESS: %~1 >> "%LOG_FILE%"
goto :eof

:check_requirements
call :log_message "Checking system requirements..."

REM Check Node.js
node --version >nul 2>&1
if errorlevel 1 (
    call :error_message "Node.js is not installed. Please install Node.js >= %MIN_NODE_VERSION%"
    call :error_message "Visit: https://nodejs.org/"
    exit /b 1
)

for /f "tokens=*" %%i in ('node --version') do set "NODE_VERSION=%%i"
set "NODE_VERSION=%NODE_VERSION:v=%"
call :success_message "Node.js version %NODE_VERSION% is available"

REM Check npm
npm --version >nul 2>&1
if errorlevel 1 (
    call :error_message "npm is not installed. Please install npm"
    exit /b 1
)

for /f "tokens=*" %%i in ('npm --version') do set "NPM_VERSION=%%i"
call :success_message "npm version %NPM_VERSION% is available"

REM Check Git
git --version >nul 2>&1
if errorlevel 1 (
    call :error_message "Git is not installed. Please install Git"
    call :error_message "Visit: https://git-scm.com/"
    exit /b 1
)
call :success_message "Git is available"

REM Check directories exist
if not exist "%BACKEND_DIR%" (
    call :error_message "Backend directory not found: %BACKEND_DIR%"
    exit /b 1
)

if not exist "%FRONTEND_DIR%" (
    call :error_message "Frontend directory not found: %FRONTEND_DIR%"
    exit /b 1
)

call :success_message "All system requirements met"

:detect_package_manager
REM Detect package manager
if exist "%FRONTEND_DIR%\bun.lockb" (
    bun --version >nul 2>&1
    if not errorlevel 1 (
        set "PACKAGE_MANAGER=bun"
        goto :package_manager_detected
    )
)

if exist "%FRONTEND_DIR%\pnpm-lock.yaml" (
    pnpm --version >nul 2>&1
    if not errorlevel 1 (
        set "PACKAGE_MANAGER=pnpm"
        goto :package_manager_detected
    )
)

if exist "%FRONTEND_DIR%\yarn.lock" (
    yarn --version >nul 2>&1
    if not errorlevel 1 (
        set "PACKAGE_MANAGER=yarn"
        goto :package_manager_detected
    )
)

npm --version >nul 2>&1
if not errorlevel 1 (
    set "PACKAGE_MANAGER=npm"
    goto :package_manager_detected
)

call :error_message "No package manager found. Please install npm, pnpm, yarn, or bun."
exit /b 1

:package_manager_detected
call :info_message "Detected package manager: %PACKAGE_MANAGER%"

:check_mongodb
if "%SKIP_DB%"=="true" (
    call :warn_message "Skipping MongoDB check (--skip-db flag)"
    goto :setup_backend_env
)

call :log_message "Checking MongoDB..."

REM Check if MongoDB is installed
mongod --version >nul 2>&1
if not errorlevel 1 (
    call :success_message "MongoDB is installed"
    
    REM Try to connect to MongoDB
    mongosh --eval "db.adminCommand('ping')" --quiet >nul 2>&1
    if not errorlevel 1 (
        call :success_message "MongoDB is running and accessible"
    ) else (
        call :warn_message "MongoDB is installed but not running"
        call :info_message "You may need to start MongoDB manually"
    )
) else (
    call :warn_message "MongoDB not found locally"
    call :info_message "You can:"
    call :info_message "  1. Install MongoDB locally"
    call :info_message "  2. Use Docker: docker run -d -p 27017:27017 mongo:5.0"
    call :info_message "  3. Use MongoDB Atlas (cloud)"
    call :info_message "  4. Skip database setup with --skip-db flag"
)

:setup_backend_env
call :log_message "Setting up backend environment..."

cd /d "%BACKEND_DIR%"

if not exist ".env" (
    if exist ".env.example" (
        copy ".env.example" ".env" >nul
        call :success_message "Created .env from .env.example"
        
        REM Set production environment if needed
        if "%PRODUCTION%"=="true" (
            powershell -Command "(Get-Content .env) -replace 'NODE_ENV=.*', 'NODE_ENV=production' | Set-Content .env"
            call :info_message "Set NODE_ENV to production"
        )
    ) else (
        call :error_message ".env.example not found in backend directory"
        exit /b 1
    )
) else (
    call :info_message "Backend .env file already exists"
)

cd /d "%PROJECT_ROOT%"

:setup_frontend_env
call :log_message "Setting up frontend environment..."

cd /d "%FRONTEND_DIR%"

REM Determine environment file name
set "ENV_FILE=.env.development"
if "%PRODUCTION%"=="true" (
    set "ENV_FILE=.env.production"
)

if not exist "%ENV_FILE%" (
    if exist ".env.example" (
        copy ".env.example" "%ENV_FILE%" >nul
        call :success_message "Created %ENV_FILE% from .env.example"
    ) else (
        REM Create basic environment file
        (
            echo # API Configuration
            echo VITE_API_BASE_URL=http://localhost:3000
            echo VITE_WS_BASE_URL=ws://localhost:3000
            echo.
            echo # Environment
            if "%PRODUCTION%"=="true" (
                echo VITE_ENVIRONMENT=production
            ) else (
                echo VITE_ENVIRONMENT=development
            )
            echo VITE_APP_NAME="Dyad CLI Gateway Admin"
            echo VITE_APP_VERSION=1.0.0
            echo.
            echo # Feature Flags
            echo VITE_FEATURE_FLAGS_ENABLED=true
            echo VITE_FEATURE_ADVANCED_MONITORING=true
            echo VITE_FEATURE_BULK_OPERATIONS=true
            echo VITE_FEATURE_CHAT_PLAYGROUND=true
            echo VITE_FEATURE_API_KEY_MANAGEMENT=true
            echo.
            echo # Debug Settings
            if "%PRODUCTION%"=="true" (
                echo VITE_DEBUG_MODE=false
                echo VITE_LOG_LEVEL=error
                echo VITE_SHOW_DEV_TOOLS=false
            ) else (
                echo VITE_DEBUG_MODE=true
                echo VITE_LOG_LEVEL=debug
                echo VITE_SHOW_DEV_TOOLS=true
            )
            echo.
            echo # Security
            if "%PRODUCTION%"=="true" (
                echo VITE_CSRF_ENABLED=true
                echo VITE_SECURE_COOKIES=true
                echo VITE_STRICT_CSP=true
            ) else (
                echo VITE_CSRF_ENABLED=false
                echo VITE_SECURE_COOKIES=false
                echo VITE_STRICT_CSP=false
            )
            echo.
            echo # Performance
            echo VITE_ENABLE_VIRTUAL_SCROLLING=true
            echo VITE_CACHE_ENABLED=true
            if "%PRODUCTION%"=="true" (
                echo VITE_CACHE_TTL=600000
            ) else (
                echo VITE_CACHE_TTL=300000
            )
        ) > "%ENV_FILE%"
        call :success_message "Created %ENV_FILE% with default configuration"
    )
) else (
    call :info_message "Frontend %ENV_FILE% file already exists"
)

cd /d "%PROJECT_ROOT%"

:install_dependencies
if "%SKIP_DEPS%"=="true" (
    call :warn_message "Skipping dependency installation (--skip-deps flag)"
    goto :run_quality_checks
)

call :log_message "Installing dependencies..."

REM Install backend dependencies
call :log_message "Installing backend dependencies..."
cd /d "%BACKEND_DIR%"

if "%PACKAGE_MANAGER%"=="npm" (
    npm ci --prefer-offline --no-audit
) else if "%PACKAGE_MANAGER%"=="pnpm" (
    pnpm install --frozen-lockfile
) else if "%PACKAGE_MANAGER%"=="yarn" (
    yarn install --frozen-lockfile
) else if "%PACKAGE_MANAGER%"=="bun" (
    bun install --frozen-lockfile
)

if errorlevel 1 (
    call :error_message "Backend dependency installation failed"
    exit /b 1
)
call :success_message "Backend dependencies installed"

REM Install frontend dependencies
call :log_message "Installing frontend dependencies..."
cd /d "%FRONTEND_DIR%"

if "%PACKAGE_MANAGER%"=="npm" (
    npm ci --prefer-offline --no-audit
) else if "%PACKAGE_MANAGER%"=="pnpm" (
    pnpm install --frozen-lockfile
) else if "%PACKAGE_MANAGER%"=="yarn" (
    yarn install --frozen-lockfile
) else if "%PACKAGE_MANAGER%"=="bun" (
    bun install --frozen-lockfile
)

if errorlevel 1 (
    call :error_message "Frontend dependency installation failed"
    exit /b 1
)
call :success_message "Frontend dependencies installed"

cd /d "%PROJECT_ROOT%"

:run_quality_checks
call :log_message "Running code quality checks..."

REM Backend quality checks
call :log_message "Running backend quality checks..."
cd /d "%BACKEND_DIR%"

if "%PACKAGE_MANAGER%"=="npm" (
    npm run lint
) else if "%PACKAGE_MANAGER%"=="pnpm" (
    pnpm lint
) else if "%PACKAGE_MANAGER%"=="yarn" (
    yarn lint
) else if "%PACKAGE_MANAGER%"=="bun" (
    bun run lint
)

if errorlevel 1 (
    call :warn_message "Backend linting issues found"
) else (
    call :success_message "Backend linting passed"
)

REM Frontend quality checks
call :log_message "Running frontend quality checks..."
cd /d "%FRONTEND_DIR%"

if "%PACKAGE_MANAGER%"=="npm" (
    npm run lint
    npm run type-check
) else if "%PACKAGE_MANAGER%"=="pnpm" (
    pnpm lint
    pnpm type-check
) else if "%PACKAGE_MANAGER%"=="yarn" (
    yarn lint
    yarn type-check
) else if "%PACKAGE_MANAGER%"=="bun" (
    bun run lint
    bun run type-check
)

if errorlevel 1 (
    call :warn_message "Frontend quality check issues found"
) else (
    call :success_message "Frontend quality checks passed"
)

cd /d "%PROJECT_ROOT%"

:run_tests
if "%SKIP_TESTS%"=="true" (
    call :warn_message "Skipping tests (--skip-tests flag)"
    goto :create_startup_scripts
)

call :log_message "Running tests..."

REM Backend tests
call :log_message "Running backend tests..."
cd /d "%BACKEND_DIR%"

if "%PACKAGE_MANAGER%"=="npm" (
    npm run test 2>nul || npm test
) else if "%PACKAGE_MANAGER%"=="pnpm" (
    pnpm test 2>nul || pnpm test
) else if "%PACKAGE_MANAGER%"=="yarn" (
    yarn test 2>nul || yarn test
) else if "%PACKAGE_MANAGER%"=="bun" (
    bun run test 2>nul || bun test
)

if errorlevel 1 (
    call :warn_message "Some backend tests failed"
) else (
    call :success_message "Backend tests passed"
)

REM Frontend tests
call :log_message "Running frontend tests..."
cd /d "%FRONTEND_DIR%"

if "%PACKAGE_MANAGER%"=="npm" (
    npm run test:run 2>nul || npm test
) else if "%PACKAGE_MANAGER%"=="pnpm" (
    pnpm test:run 2>nul || pnpm test
) else if "%PACKAGE_MANAGER%"=="yarn" (
    yarn test:run 2>nul || yarn test
) else if "%PACKAGE_MANAGER%"=="bun" (
    bun run test:run 2>nul || bun test
)

if errorlevel 1 (
    call :warn_message "Some frontend tests failed"
) else (
    call :success_message "Frontend tests passed"
)

cd /d "%PROJECT_ROOT%"

:create_startup_scripts
call :log_message "Creating startup scripts..."

cd /d "%PROJECT_ROOT%"

REM Development startup script
(
    echo @echo off
    echo echo Starting Dyad CLI Gateway in development mode...
    echo.
    echo start "Backend" cmd /k "cd backend && %PACKAGE_MANAGER% run dev"
    echo timeout /t 5 /nobreak ^> nul
    echo start "Frontend" cmd /k "cd frontend && %PACKAGE_MANAGER% run dev"
    echo.
    echo echo.
    echo echo 🚀 Dyad CLI Gateway is starting up...
    echo echo.
    echo echo 📊 Admin UI: http://localhost:8080
    echo echo 🔌 Backend API: http://localhost:3000
    echo echo 📚 API Docs: http://localhost:3000/docs
    echo echo.
    echo echo Press any key to open Admin UI in browser...
    echo pause ^> nul
    echo start http://localhost:8080
) > start-dev.bat

call :success_message "Created start-dev.bat"

REM Production startup script
if "%PRODUCTION%"=="true" (
    (
        echo @echo off
        echo echo Starting Dyad CLI Gateway in production mode...
        echo.
        echo echo Starting backend with PM2...
        echo cd backend
        echo %PACKAGE_MANAGER% start
        echo.
        echo echo Building and serving frontend...
        echo cd ..\frontend
        echo %PACKAGE_MANAGER% run build
        echo start "Frontend" cmd /k "%PACKAGE_MANAGER% run preview"
        echo.
        echo echo.
        echo echo 🚀 Dyad CLI Gateway is running in production mode
        echo echo.
        echo echo 📊 Admin UI: http://localhost:4173
        echo echo 🔌 Backend API: http://localhost:3000
        echo echo.
    ) > start-prod.bat
    
    call :success_message "Created start-prod.bat"
)

:print_instructions
echo.
echo ╔══════════════════════════════════════════════════════════════╗
echo ║                    🎉 Setup Complete! 🎉                     ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.

if "%PRODUCTION%"=="true" (
    echo %GREEN% Production setup completed successfully!
    echo.
    echo %CYAN% To start the application:
    echo   start-prod.bat
    echo.
    echo %CYAN% Manual startup:
    echo   cd backend ^&^& %PACKAGE_MANAGER% start
    echo   cd frontend ^&^& %PACKAGE_MANAGER% run build ^&^& %PACKAGE_MANAGER% run preview
) else (
    echo %GREEN% Development setup completed successfully!
    echo.
    echo %CYAN% To start the application:
    echo   start-dev.bat
    echo.
    echo %CYAN% Manual startup:
    echo   cd backend ^&^& %PACKAGE_MANAGER% run dev
    echo   cd frontend ^&^& %PACKAGE_MANAGER% run dev
)

echo.
echo %CYAN% Application URLs:
if "%PRODUCTION%"=="true" (
    echo   📊 Admin UI: http://localhost:4173
) else (
    echo   📊 Admin UI: http://localhost:8080
)
echo   🔌 Backend API: http://localhost:3000
echo   📚 API Documentation: http://localhost:3000/docs
echo   ❤️  Health Check: http://localhost:3000/health

echo.
echo %CYAN% Next Steps:
echo   1. Review configuration files:
echo      - backend\.env
if "%PRODUCTION%"=="true" (
    echo      - frontend\.env.production
) else (
    echo      - frontend\.env.development
)
echo   2. Configure AI providers through the admin UI
echo   3. Create API keys for client applications
echo   4. Test the chat playground functionality

if "%SKIP_DB%"=="true" (
    echo.
    echo %YELLOW% ⚠️  Database setup was skipped. Make sure to:
    echo   - Install and start MongoDB
    echo   - Update MONGODB_URL in backend\.env
)

echo.
echo %CYAN% Documentation:
echo   - Backend Setup: backend\docs\SETUP.md
echo   - Frontend Setup: frontend\docs\SETUP.md
echo   - API Documentation: backend\docs\API.md

echo.
echo %GREEN% Happy coding! 🚀
echo.

call :success_message "Setup completed successfully!"

goto :eof