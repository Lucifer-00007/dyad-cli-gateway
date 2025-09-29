# Frontend Production Deployment Guide

This guide covers deploying the Dyad CLI Gateway Admin UI frontend to production.

## 🏗️ Build Optimizations

### Vite Configuration
- **Code Splitting**: Automatic chunking by route and vendor libraries
- **Bundle Analysis**: Use `npm run build:analyze` to inspect bundle sizes
- **Tree Shaking**: Unused code automatically removed
- **Minification**: CSS and JS minified with esbuild
- **Asset Optimization**: Images, fonts, and static assets optimized

### Performance Features
- **Progressive Web App (PWA)**: Offline support and installability
- **Service Worker**: Caching strategies for API calls and static assets
- **Lazy Loading**: Route-based code splitting
- **Web Vitals Monitoring**: Performance metrics collection

## 🐳 Docker Deployment

### Building the Container
```bash
# Build the Docker image
docker build -t dyad-frontend:latest .

# Run locally for testing
docker run -p 8080:8080 dyad-frontend:latest
```

### Production Docker Compose
```bash
# Start with production configuration
docker-compose -f docker-compose.prod.yml up -d

# View logs
docker-compose -f docker-compose.prod.yml logs -f frontend

# Stop services
docker-compose -f docker-compose.prod.yml down
```

### Security Features
- **Non-root user**: Container runs as unprivileged user
- **Read-only filesystem**: Application files are read-only
- **Security headers**: HTTPS, CSP, HSTS, and other security headers
- **Minimal attack surface**: Alpine-based images with minimal packages

## 🚀 CI/CD Pipeline

### GitHub Actions Workflow
The CI/CD pipeline includes:

1. **Security Scanning**
   - Dependency vulnerability scanning
   - Container security scanning with Trivy
   - SAST analysis with CodeQL

2. **Testing**
   - Unit tests with coverage reporting
   - Accessibility tests with axe-core
   - Performance tests
   - End-to-end tests with Playwright

3. **Build & Deploy**
   - Multi-platform Docker builds (AMD64, ARM64)
   - Automated deployment to staging/production
   - Blue-green deployment strategy
   - Rollback capabilities

### Environment Variables
```bash
# Production environment variables
NODE_ENV=production
VITE_API_BASE_URL=https://api.dyad-cli-gateway.com
VITE_SENTRY_DSN=your-sentry-dsn
VITE_ENVIRONMENT=production
```

## 🔧 Nginx Configuration

### Production Settings
- **Gzip Compression**: Enabled for all text-based assets
- **Caching Headers**: Optimized caching for static assets
- **Security Headers**: CSP, HSTS, X-Frame-Options, etc.
- **Rate Limiting**: API endpoint protection
- **Health Checks**: `/health` endpoint for monitoring

### SSL/TLS Configuration
```nginx
# SSL configuration (add to your nginx config)
ssl_certificate /path/to/certificate.crt;
ssl_certificate_key /path/to/private.key;
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;
```

## 📊 Monitoring & Analytics

### Performance Monitoring
- **Web Vitals**: CLS, LCP, FID/INP, FCP, TTFB
- **Custom Metrics**: Long tasks, navigation timing
- **Error Tracking**: Sentry integration for error reporting
- **User Analytics**: Optional user behavior tracking

### Health Checks
```bash
# Application health check
curl -f http://localhost:8080/health

# Container health check (built-in)
docker inspect --format='{{.State.Health.Status}}' dyad-frontend
```

## 🔒 Security Considerations

### Content Security Policy
```
default-src 'self';
script-src 'self' 'unsafe-inline' 'unsafe-eval';
style-src 'self' 'unsafe-inline';
img-src 'self' data: https:;
connect-src 'self' https: wss:;
```

### Security Headers
- **HSTS**: Force HTTPS connections
- **X-Frame-Options**: Prevent clickjacking
- **X-Content-Type-Options**: Prevent MIME sniffing
- **Referrer-Policy**: Control referrer information

## 🚨 Troubleshooting

### Common Issues

1. **Build Failures**
   ```bash
   # Clear node_modules and reinstall
   rm -rf node_modules package-lock.json
   npm install
   
   # Clear Vite cache
   rm -rf node_modules/.vite
   ```

2. **PWA Issues**
   ```bash
   # Clear service worker cache
   # In browser dev tools: Application > Storage > Clear storage
   
   # Disable PWA for debugging
   # Set devOptions.enabled: false in vite.config.ts
   ```

3. **Container Issues**
   ```bash
   # Check container logs
   docker logs dyad-frontend-prod
   
   # Debug container
   docker exec -it dyad-frontend-prod sh
   
   # Check nginx configuration
   docker exec dyad-frontend-prod nginx -t
   ```

### Performance Optimization

1. **Bundle Size Analysis**
   ```bash
   npm run build:analyze
   # Opens bundle-analysis.html in browser
   ```

2. **Lighthouse Audit**
   ```bash
   # Install Lighthouse CLI
   npm install -g lighthouse
   
   # Run audit
   lighthouse http://localhost:8080 --output html --output-path ./lighthouse-report.html
   ```

## 📈 Scaling Considerations

### CDN Integration
- Serve static assets from CDN
- Configure proper cache headers
- Use service worker for offline support

### Load Balancing
- Multiple container instances
- Health check endpoints
- Graceful shutdown handling

### Monitoring
- Application performance monitoring
- Error rate tracking
- User experience metrics
- Infrastructure monitoring

## 🔄 Deployment Checklist

- [ ] Environment variables configured
- [ ] SSL certificates installed
- [ ] Security headers configured
- [ ] Monitoring setup (Sentry, analytics)
- [ ] Health checks working
- [ ] Backup and rollback procedures tested
- [ ] Performance benchmarks established
- [ ] Security scan completed
- [ ] Load testing performed
- [ ] Documentation updated

## 📞 Support

For deployment issues or questions:
- Check the troubleshooting section above
- Review container logs and health checks
- Verify environment configuration
- Test with minimal configuration first