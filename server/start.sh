#!/bin/bash
echo "Starting Perchance Bridge Server..."
if [ ! -d "node_modules" ]; then
    echo "node_modules not found, installing dependencies..."
    npm install
fi
npm start
