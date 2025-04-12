# Docker Setup for Meeting Diary

This guide explains how to containerize and run the Meeting Diary application using Docker.

## Prerequisites

- Docker installed on your system
- Docker Compose installed on your system
- AssemblyAI API key
- Supabase credentials (if using Supabase features)

## Environment Setup

1. Create a `.env` file in the project root with your environment variables:

```
ASSEMBLYAI_API_KEY=your_assemblyai_api_key
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_supabase_service_key
SUPABASE_ANON_KEY=your_supabase_anon_key
MEETING_DIARY_PATH=meeting-diary
PORT=3000
```

## Setup for New User

If you're running this application as a different user (not the root user):

1. Create and switch to the new user account if needed:

```bash
# Create new user if it doesn't exist
sudo adduser newuser
# Add to docker group to allow docker commands
sudo usermod -aG docker newuser
# Switch to the new user
su - newuser
```

2. Clone the repository and navigate to the project directory:

```bash
git clone https://github.com/southbridgeai/meeting-diary.git
cd meeting-diary
```

## Building and Running with Docker Compose

1. Build and start the container:

```bash
docker-compose up -d
```

2. Access the application at http://localhost:3002

3. To stop the container:

```bash
docker-compose down
```

Note: The application runs on port 3002 to avoid conflicts with other services running on port 3000.

## Building and Running with Docker Directly

If you prefer using Docker commands directly:

1. Build the Docker image:

```bash
docker build -t meeting-diary .
```

2. Run the container:

```bash
docker run -d \
  --name meeting-diary \
  -p 3002:3000 \
  -v $(pwd)/.env:/app/.env \
  -v meeting_diary_data:/app/frontend/outputs \
  --network meeting_diary_network \
  meeting-diary
```

## Environment Variables

You can provide environment variables in three ways:

1. In the `.env` file (recommended for development)
2. In the `docker-compose.yml` file (uncomment and set values)
3. Via command line when running the container:

```bash
docker run -d \
  --name meeting-diary \
  -p 3002:3000 \
  -e ASSEMBLYAI_API_KEY=your_key \
  -e SUPABASE_URL=your_supabase_url \
  -e SUPABASE_SERVICE_KEY=your_supabase_key \
  -e SUPABASE_ANON_KEY=your_supabase_anon_key \
  --network meeting_diary_network \
  meeting-diary
```

## Persistent Data

The Docker setup uses a named volume `meeting_diary_data` to persist transcripts across container restarts.

## Migrating from PM2

If you're currently using PM2:

1. Stop your PM2 process:

```bash
pm2 stop meeting-diary
```

2. Start using Docker as described above.

3. To completely remove from PM2 (optional):

```bash
pm2 delete meeting-diary
pm2 save
```

## Architecture-Specific Notes

This Docker configuration is compatible with both:
- x86_64/AMD64 (Mac, most PCs, typical cloud servers)
- ARM64 (Apple Silicon Macs, some cloud instances)

No special configuration is needed as the Node.js base image provides architecture-specific variants automatically.

## Security Best Practices

1. Never commit `.env` files to version control
2. Consider using Docker secrets or a secure environment variable manager in production
3. The service runs as the default Node.js user in the container (not root)
4. All sensitive environment variables should be provided at runtime