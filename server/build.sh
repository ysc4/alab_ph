#!/bin/bash

# Install Node dependencies and build TypeScript
npm install
npm run build

# Install Python dependencies
pip install --upgrade pip
pip install -r requirements.txt
