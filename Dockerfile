FROM node:18

# Set working directory
WORKDIR /app

# Copy package.json and install dependencies
COPY package*.json ./
RUN npm install

# Install Bun for building
RUN npm install -g bun

# Install meeting-diary CLI globally
RUN npm install -g meeting-diary

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

# Create startup script line by line
RUN echo '#!/bin/bash' > /app/startup.sh
RUN echo '# Load environment variables passed to the container from .env file' >> /app/startup.sh
RUN echo 'if [ -f /app/.env ]; then' >> /app/startup.sh
RUN echo '  echo "Loading environment variables from .env file"' >> /app/startup.sh
RUN echo '  export $(grep -v "^#" /app/.env | xargs -0)' >> /app/startup.sh
RUN echo 'else' >> /app/startup.sh
RUN echo '  echo "Warning: No .env file found"' >> /app/startup.sh
RUN echo '  # Use fallback values if .env is missing' >> /app/startup.sh
RUN echo '  export SUPABASE_URL=${SUPABASE_URL:-"https://placeholder-url.com"}' >> /app/startup.sh
RUN echo '  export SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY:-"placeholder-anon-key"}' >> /app/startup.sh
RUN echo '  export SUPABASE_SERVICE_KEY=${SUPABASE_SERVICE_KEY:-"placeholder-service-key"}' >> /app/startup.sh
RUN echo '  export ASSEMBLYAI_API_KEY=${ASSEMBLYAI_API_KEY:-"placeholder-assemblyai-key"}' >> /app/startup.sh
RUN echo '  export PORT=${PORT:-3000}' >> /app/startup.sh
RUN echo '  export MEETING_DIARY_PATH=${MEETING_DIARY_PATH:-"meeting-diary"}' >> /app/startup.sh
RUN echo 'fi' >> /app/startup.sh
RUN echo '' >> /app/startup.sh
RUN echo '# Print environment variables for debugging (redacted for security)' >> /app/startup.sh
RUN echo 'echo "SUPABASE_URL is set: ${SUPABASE_URL:0:15}..."' >> /app/startup.sh
RUN echo 'echo "SUPABASE_ANON_KEY is set: ${SUPABASE_ANON_KEY:0:5}..."' >> /app/startup.sh
RUN echo 'echo "SUPABASE_SERVICE_KEY is set: ${SUPABASE_SERVICE_KEY:0:5}..."' >> /app/startup.sh
RUN echo '' >> /app/startup.sh
RUN echo '# Start the server' >> /app/startup.sh
RUN echo 'cd /app && node frontend/server.js' >> /app/startup.sh

# Make the startup script executable
RUN chmod +x /app/startup.sh

# Run the startup script when the container launches
ENTRYPOINT ["/app/startup.sh"]
