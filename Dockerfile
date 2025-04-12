FROM node:18

# Set working directory
WORKDIR /app

# Copy package.json and install dependencies
COPY package*.json ./
RUN npm install

# Install Bun for building
RUN npm install -g bun

# Copy frontend package.json and install dependencies
COPY frontend/package*.json ./frontend/
RUN cd frontend && npm install

# Copy source files
COPY src/ ./src/
COPY frontend/ ./frontend/

# Build the application
RUN bun build src/index.ts src/run.ts --outdir dist --target node

# Create directories for uploads and outputs
RUN mkdir -p frontend/uploads frontend/outputs
RUN chmod -R 755 frontend/uploads frontend/outputs

# Create startup script
RUN echo '#!/bin/bash\n\
# Add placeholder values for required variables if not provided\n\
export SUPABASE_URL=${SUPABASE_