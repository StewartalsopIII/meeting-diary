# Docker Environment Variable Setup for Meeting Diary

This guide explains how to securely handle environment variables in your Docker setup.

## Creating an Environment File for Docker

1. Create a `.env` file in the project root directory:

```bash
touch .env
chmod 600 .env  # Restrict permissions to owner read/write only
```

2. Add your environment variables to the `.env` file:

```
# AssemblyAI API Key
ASSEMBLYAI_API_KEY=your_assemblyai_api_key_here

# Supabase Configuration
SUPABASE_URL=your_supabase_url_here
SUPABASE_SERVICE_KEY=your_supabase_service_key_here
SUPABASE_ANON_KEY=your_supabase_anon_key_here

# Application Configuration
PORT=3000
MEETING_DIARY_PATH=meeting-diary
```

## Environment Variable Options

### Option 1: Using .env File (Recommended)

The docker-compose.yml is already configured to use your .env file:

```yaml
volumes:
  # Mount for environment variables
  - ./.env:/app/.env
```

### Option 2: Environment Variables in docker-compose.yml

Uncomment and set environment variables directly in docker-compose.yml:

```yaml
environment:
  - NODE_ENV=production
  - PORT=3000
  - ASSEMBLYAI_API_KEY=your_key_here
  - SUPABASE_URL=your_supabase_url
  - SUPABASE_SERVICE_KEY=your_supabase_key
  - SUPABASE_ANON_KEY=your_supabase_anon_key
  - MEETING_DIARY_PATH=meeting-diary
```

### Option 3: Pass Environment Variables at Runtime

For temporary or testing purposes:

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

## Environment Variable Security Best Practices

1. **Never commit .env files to version control**
   - Ensure .env is in your .gitignore file
   - If you've accidentally committed sensitive information, use the provided script:
     ```bash
     ./remove-env-from-git.sh
     ```

2. **Restrict file permissions**
   ```bash
   chmod 600 .env
   ```

3. **Use different environment files for different environments**
   ```
   .env.development
   .env.production
   ```

4. **Consider using Docker secrets for production**
   For more secure handling in production environments, consider using Docker secrets instead of environment variables.

5. **Regularly rotate API keys and credentials**
   Establish a process to regularly update API keys and credentials.

## For Multiple Users Setup

If multiple users need to manage the Docker containers:

1. Create a shared group:
   ```bash
   sudo groupadd meeting-diary
   ```

2. Add users to the group:
   ```bash
   sudo usermod -aG meeting-diary youruser
   sudo usermod -aG meeting-diary newuser
   ```

3. Set group ownership on project files:
   ```bash
   sudo chown -R :meeting-diary /path/to/meeting-diary
   sudo chmod -R g+rw /path/to/meeting-diary
   ```

4. Set secure permissions on .env file:
   ```bash
   sudo chown newuser:meeting-diary /path/to/meeting-diary/.env
   sudo chmod 640 /path/to/meeting-diary/.env
   ```