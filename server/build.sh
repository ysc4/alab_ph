#!/bin/bash

# Install Node dependencies and build TypeScript
npm install
npm run build

# Install Python dependencies
pip3 install --upgrade pip
pip3 install -r requirements.txt

# Copy Python scripts to dist if building to dist
if [ -d "dist" ]; then
	mkdir -p dist/services
	cp src/services/forecast.py dist/services/
fi
