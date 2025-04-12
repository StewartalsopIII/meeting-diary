# NGINX Configuration for Meeting Diary

This guide explains how to configure NGINX as a reverse proxy for your containerized Meeting Diary application when running under a new user.

## Prerequisites

- NGINX installed on your server
- Docker and Docker Compose with Meeting Diary containers running under the newuser account
- Domain name (optional, but recommended)
- Root or sudo access to configure NGINX

## Basic NGINX Configuration

Create a new configuration file for Meeting Diary:

```bash
sudo nano /etc/nginx/sites-available/meeting-diary
```

### For a Subdirectory Setup

If you want to access the application at `https://yourcrazywisdom.com/meeting-diary`:

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name yourcrazywisdom.com;

    # Existing server configuration...

    # Meeting Diary application
    location /meeting-diary/ {
        proxy_pass http://localhost:3002/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Handle redirects properly with subpath
        proxy_redirect / /meeting-diary/;
    }
}
```

### For a Subdomain Setup

If you want to access the application at `https://meeting.yourcrazywisdom.com`:

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name meeting.yourcrazywisdom.com;

    location / {
        proxy_pass http://localhost:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## SSL Configuration with Let's Encrypt

If you're using Let's Encrypt for SSL:

```bash
sudo certbot --nginx -d meeting.yourcrazywisdom.com
```

Or for a subdirectory, include your main domain:

```bash
sudo certbot --nginx -d yourcrazywisdom.com
```

## Enable the Configuration

```bash
sudo ln -s /etc/nginx/sites-available/meeting-diary /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## Environment Variables for Reverse Proxy

If you're using a reverse proxy with a custom path, you may need to update the application's environment variables to handle URL paths correctly. Add this to your `.env` file or docker-compose.yml:

```
BASE_URL=/meeting-diary
```

## Troubleshooting

### Check NGINX Logs

```bash
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log
```

### Test NGINX Configuration

```bash
sudo nginx -t
```

### Check Container Logs

```bash
docker logs meeting-diary
```