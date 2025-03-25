# Environment Variable Setup

## Main CLI Tool

The meeting-diary CLI tool requires an AssemblyAI API key. You can provide it in several ways:

1. **Environment Variable**: Set `ASSEMBLYAI_API_KEY` in your environment
2. **CLI Parameter**: Pass it with `--api-key your-key-here`
3. **Interactive Prompt**: The tool will prompt you for the key if not provided and can save it for future use

## Frontend Setup

The web frontend also requires an AssemblyAI API key to function properly:

1. Copy the `.env.example` file to create a `.env` file in the frontend directory:
   ```bash
   cp frontend/.env.example frontend/.env
   ```

2. Edit the `.env` file to add your AssemblyAI API key:
   ```
   ASSEMBLYAI_API_KEY=your_api_key_here
   ```

## Security Notes

- **Never commit .env files to version control**
- The `.gitignore` file is set up to exclude all `.env` files except for `.env.example` files
- If you've previously committed an `.env` file, run the provided script to remove it from tracking:
  ```bash
  ./remove-env-from-git.sh
  ```

- Always use `.env.example` files as templates with dummy/placeholder values
- Each developer should maintain their own local `.env` file with real credentials
