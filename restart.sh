#!/bin/bash

# Kill all Node.js and Python processes
pkill -f "node" || true
pkill -f "next" || true
pkill -f "python" || true

# Wait for processes to terminate
sleep 2

# Set environment variables to use a specific port
export PORT=5555

# Start the development server
npm run dev 