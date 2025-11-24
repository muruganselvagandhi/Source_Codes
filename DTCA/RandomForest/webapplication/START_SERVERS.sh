#!/bin/bash

# Wind Farm Monitor - Quick Start Script
# This script starts both backend and frontend servers

echo "🌬️  Wind Farm Monitor - Starting Servers"
echo "========================================"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [ ! -d "backend" ] || [ ! -d "frontend" ]; then
    echo -e "${YELLOW}⚠️  Error: Please run this script from the webapplication directory${NC}"
    exit 1
fi

# Start Backend Server
echo -e "\n${BLUE}📡 Starting Backend Server (Port 5001)...${NC}"
cd backend
npm start &
BACKEND_PID=$!
cd ..

# Wait for backend to start
sleep 3

# Start Frontend Server
echo -e "\n${BLUE}🌐 Starting Frontend Server (Port 5173)...${NC}"
cd frontend
npm run dev &
FRONTEND_PID=$!
cd ..

echo -e "\n${GREEN}✅ Servers Started Successfully!${NC}"
echo ""
echo "Backend:  http://localhost:5001"
echo "Frontend: http://localhost:5173"
echo ""
echo "Demo Credentials:"
echo "  👨‍💼 Admin: admin / password"
echo "  👤 User:  user / user123"
echo ""
echo "Press Ctrl+C to stop both servers"
echo ""

# Wait for user interrupt
trap "kill $BACKEND_PID $FRONTEND_PID; exit" INT
wait
