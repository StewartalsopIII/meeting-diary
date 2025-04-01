# Meeting Diary

A powerful CLI tool to transcribe and diarize audio/video files using AssemblyAI. Automatically identifies speakers and generates transcripts in multiple formats.

## Features

- 🎙️ Automatic speaker diarization
- 👥 Interactive speaker identification with context
- 📝 Multiple output formats (Markdown, SRT, TXT, JSON)
- 🕒 Timestamps for each segment
- 🔑 Secure API key management
- 💾 Smart caching for faster processing
- 💻 Cross-platform support

## Installation & Usage

### Quick Start (Recommended)

You can use `meeting-diary` directly without installation using `npx` or `bunx`:

```bash
# Using npx (Node.js)
npx meeting-diary input.mp4

# Using bunx (Bun)
bunx meeting-diary input.mp4
```

### Global Installation (Alternative)

If you prefer to install the tool globally:

```bash
# Using npm
npm install -g meeting-diary

# Using yarn
yarn global add meeting-diary

# Using bun
bun install -g meeting-diary
```

Then use it as:

```bash
meeting-diary input.mp4
```

## Usage

### Basic Usage

```bash
meeting-diary input.mp4
```

This will:

1. Transcribe and diarize your audio/video file
2. Help you identify each speaker by showing their most significant contributions
3. Generate a timestamped transcript in markdown format

### Output Formats

```bash
meeting-diary input.mp4 -f txt  # Simple text format
meeting-diary input.mp4 -f srt  # SubRip subtitle format
meeting-diary input.mp4 -f json # JSON format with detailed metadata
meeting-diary input.mp4 -f md   # Markdown format (default)
```

#### Markdown Format (Default)

The markdown format includes:

- Timestamp for each segment
- Speaker list
- Chronological transcript with speaker attribution
- Processing metadata

Example:

```markdown
# Meeting Transcript

_Processed on 2/10/2024, 3:43:26 PM_
_Duration: 5 minutes_

## Speakers

- **Hrishi**
- **Alok**

## Transcript

[0:00] **Hrishi**: Yeah, didn't have a chance yet...
[0:15] **Alok**: No engagement in terms of my Mushroom photos.
[0:18] **Hrishi**: Basically Samsung phones have the ability...
```

### Speaker Identification

You can identify speakers in two ways:

1. Interactive identification (default):

```bash
meeting-diary input.mp4
```

The tool will:

- Show you the most significant contributions from each speaker
- Display context (what was said before and after)
- Show previously identified speakers for context
- Ask you to identify each speaker in turn

2. Specify speakers up front:

```bash
meeting-diary input.mp4 -s "John Smith" "Jane Doe"
```

### All Options

```bash
Options:
  -o, --output <file>     Output file (defaults to input file name with new extension)
  -f, --format <format>   Output format (json, txt, srt, md) (default: "md")
  -s, --speakers <names>  Known speaker names (skip interactive identification)
  --skip-diarization     Skip speaker diarization
  -v, --verbose          Show verbose output
  --api-key <key>        AssemblyAI API key (will prompt if not provided)
  --no-cache            Disable caching of uploads and transcripts
  --cache-dir <dir>     Directory to store cache files
  --no-interactive      Skip interactive speaker identification
  -h, --help             display help for command
```

### Caching

The tool automatically caches uploaded audio files and transcripts to avoid unnecessary re-processing. This is especially useful when:

- Experimenting with different output formats
- Re-running transcription with different speaker names
- Processing the same file multiple times

Cache files are stored in your system's temporary directory by default. You can:

- Disable caching with `--no-cache`
- Change cache location with `--cache-dir`
- Cache is enabled by default for faster processing
- Cache files are automatically cleaned up by your OS's temp file management

## API Key

You'll need an AssemblyAI API key to use this tool. You can:

1. Set it as an environment variable: `ASSEMBLYAI_API_KEY=your-key`
2. Pass it via the command line: `--api-key your-key`
3. Let the tool prompt you for it (it can be saved for future use)

## Web Interface & Transcript Storage

Meeting Diary includes a web interface for transcribing audio/video files and storing transcripts. Features include:

- 🔒 User authentication via Supabase
- 💾 Secure transcript storage with row-level security
- 📝 List, search, and manage your transcripts
- 🔍 Support for future semantic search via embeddings

### Setup with Existing Supabase Project

Follow these steps to add transcript storage to your existing Supabase project:

1. Clone the repository and install dependencies:
```bash
git clone https://github.com/southbridgeai/meeting-diary.git
cd meeting-diary
npm install  # or bun install
```

2. Create `.env` file in the frontend directory:
```bash
cp frontend/.env.example frontend/.env
```

3. Edit `.env` to add your AssemblyAI API key and existing Supabase credentials:
```
ASSEMBLYAI_API_KEY=your_assemblyai_key
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_KEY=your_supabase_service_role_key
```

4. Set up the database schema in Supabase:
   - Log in to your Supabase dashboard
   - Go to the SQL Editor and create a new query
   - Copy the contents of `frontend/supabase-schema.sql`
   - Run the SQL to create the transcripts table with RLS policies

5. Start the server:
```bash
cd frontend
node server.js
```

6. Access the application at http://localhost:3000

See [frontend/README.md](frontend/README.md) for more detailed setup instructions and [TRANSCRIPT_STORAGE.md](frontend/TRANSCRIPT_STORAGE.md) for details on using the transcript storage API.

## Development

```bash
# Clone the repository
git clone https://github.com/southbridgeai/meeting-diary.git
cd meeting-diary

# Install dependencies
bun install

# Build
bun run build

# Run tests
bun test

# Development mode
bun run dev
```

## License

Apache-2.0 - see [LICENSE](LICENSE) for details.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
