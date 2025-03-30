# Supabase Authentication Setup Guide

This guide provides detailed instructions for setting up email authentication in Supabase for the Meeting Diary application, reflecting the latest Supabase dashboard UI.

## 1. Create a Supabase Project

1. Go to [Supabase](https://supabase.com/) and sign in or create an account
2. Click "New Project" to create a new project
3. Enter a name for your project (e.g., "Meeting Diary")
4. Set a secure database password (save this in a password manager)
5. Choose the region closest to your users
6. Click "Create new project"

## 2. Configure Email Authentication

1. In your Supabase dashboard, navigate to **Authentication** in the left sidebar
2. Click on **Configuration** tab
3. In the Configuration section, you'll find multiple panels to configure various aspects of authentication

### Email Provider Settings

1. Under **Configuration**, find the **Email Provider** panel or section
2. Click "Edit" or the settings icon
3. Configure the following settings:
   - **Email Auth**: Ensure this is enabled
   - **Confirm email**: Choose whether users need to confirm their email before signing in
   - **Password settings**: Set minimum password strength requirements
   - **Custom SMTP Server**: If needed, configure your own SMTP server for better email deliverability

### URL Configuration

1. Find the **URL Configuration** panel in Authentication > Configuration
2. Set your Site URL to your production URL (e.g., `https://www.getcrazywisdom.com`)
3. Add any additional redirect URLs if needed (e.g., `http://localhost:3000` for local development)

### Email Templates

1. Look for the **Email Templates** panel in Authentication > Configuration
2. You can customize the templates for:
   - Confirmation email
   - Invitation email
   - Magic link email
   - Reset password email
3. For each template, you can modify:
   - The subject line
   - The template content (text and HTML versions)
   - The sender name and email address

### User Session Settings

1. Find the **User Sessions** panel in Authentication > Configuration
2. Configure settings like:
   - JWT expiry time
   - Refresh token settings
   - Session timeouts

### Advanced Security Settings

1. Look for panels related to security in Authentication > Configuration:
   - **Bot and Abuse Protection**: Configure rate limiting and captcha settings
   - **Max Request Duration**: Set timeouts for auth operations
   - **Multi-factor Authentication**: Enable and configure MFA if needed

## 3. Get Your API Keys

1. Go to **Project Settings** (gear icon) in the left sidebar
2. Click on **API** in the settings menu
3. Copy the following keys:
   - **Project URL**: The URL of your Supabase project
   - **anon public key**: Used for client-side authentication
   - **service_role key**: Used for server-side authentication verification (keep this secret!)

## 4. Add Keys to Environment Variables

Add these values to your `.env` file:

```
SUPABASE_URL=your_project_url
SUPABASE_ANON_KEY=your_anon_public_key
SUPABASE_SERVICE_KEY=your_service_role_key
```

## 5. Enable Additional Authentication Methods (Optional)

If you want to add social login options:

1. Go to **Authentication** > **Configuration**
2. Find the **Third Party Auth Providers** section
3. Enable and configure any additional providers:
   - Google
   - Facebook
   - GitHub
   - Twitter/X
   - Apple
   - And others...

For each provider, you'll need to:
- Create a developer account with the provider
- Register your application
- Get client ID and secret
- Configure redirect URLs

## 6. Testing Your Authentication

1. Start your Meeting Diary application locally
2. Navigate to the login page
3. Try to sign up with an email and password
4. Check your email for confirmation (if enabled)
5. Verify that you can log in after confirming your email
6. Test that authenticated users can access the transcription service
7. Verify that unauthenticated users are redirected to the login page

## 7. Monitoring Users

You can monitor and manage users in the Supabase dashboard:

1. Go to **Authentication** > **Users**
2. Here you can:
   - View all registered users
   - Search for specific users
   - Edit user details
   - Delete users
   - View authentication logs

## 8. Troubleshooting

### Common Issues:

1. **Email deliverability problems**:
   - Check your spam folder
   - Verify your email templates don't contain spam triggers
   - Consider setting up custom SMTP in the Email Provider settings

2. **CORS errors**:
   - Ensure your site URL is correctly configured in the URL Configuration
   - Check that all domains that will use the auth are in the allowed list

3. **Token validation failures**:
   - Check that you're using the correct SUPABASE_URL and keys
   - Verify the JWT token is being properly passed in the Authorization header
   - Check your User Session settings for token expiry times

4. **Rate limiting**:
   - Supabase has rate limits on auth requests; check the Bot and Abuse Protection settings

## 9. Database Connection Settings

1. Go to **Authentication** > **Configuration**
2. Find the **Database Connection Settings** panel
3. Configure the maximum number of direct database connections if needed

## 10. Deployment Considerations

When deploying to production:

1. Ensure all environment variables are set in your production environment
2. Update the Site URL in Supabase to match your production domain
3. Consider enabling stronger security settings for production
4. Implement proper error handling for auth failures in your frontend code
5. Consider enabling bot protection for production environments

For more information, refer to the [Supabase Auth documentation](https://supabase.com/docs/guides/auth).