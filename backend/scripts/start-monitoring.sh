#!/bin/bash

# Start Monitoring Stack for Dyad CLI Gateway
# This script starts the complete monitoring infrastructure

set -e

echo "🚀 Starting Dyad CLI Gateway Monitoring Stack..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

# Navigate to monitoring directory
cd "$(dirname "$0")/../monitoring"

# Create necessary directories
mkdir -p logs
mkdir -p prometheus_data
mkdir -p grafana_data
mkdir -p alertmanager_data

# Start the monitoring stack
echo "📊 Starting Prometheus, Grafana, and Alertmanager..."
docker-compose -f docker-compose.monitoring.yml up -d

# Wait for services to be ready
echo "⏳ Waiting for services to start..."
sleep 10

# Check service health
echo "🔍 Checking service health..."

# Check Prometheus
if curl -s http://localhost:9090/-/healthy > /dev/null; then
    echo "✅ Prometheus is healthy (http://localhost:9090)"
else
    echo "⚠️  Prometheus may not be ready yet"
fi

# Check Grafana
if curl -s http://localhost:3000/api/health > /dev/null; then
    echo "✅ Grafana is healthy (http://localhost:3000)"
    echo "   Default login: admin/admin123"
else
    echo "⚠️  Grafana may not be ready yet"
fi

# Check Alertmanager
if curl -s http://localhost:9093/-/healthy > /dev/null; then
    echo "✅ Alertmanager is healthy (http://localhost:9093)"
else
    echo "⚠️  Alertmanager may not be ready yet"
fi

echo ""
echo "🎉 Monitoring stack is starting up!"
echo ""
echo "📊 Access URLs:"
echo "   Grafana:      http://localhost:3000 (admin/admin123)"
echo "   Prometheus:   http://localhost:9090"
echo "   Alertmanager: http://localhost:9093"
echo ""
echo "📈 Gateway Metrics:"
echo "   Metrics endpoint: http://localhost:3001/metrics"
echo "   JSON metrics:     http://localhost:3001/metrics/json"
echo ""
echo "🔧 Management Commands:"
echo "   View logs:    docker-compose -f docker-compose.monitoring.yml logs -f"
echo "   Stop stack:   docker-compose -f docker-compose.monitoring.yml down"
echo "   Restart:      docker-compose -f docker-compose.monitoring.yml restart"
echo ""
echo "📚 For more information, see: backend/monitoring/README.md"