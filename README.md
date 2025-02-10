# Meeting Diary

A powerful CLI tool to transcribe and diarize audio/video files using AssemblyAI. Automatically identifies speakers and generates transcripts in multiple formats.

## Features

- 🎙️ Automatic speaker diarization
- 👥 Support for known speaker identification
- 📝 Multiple output formats (JSON, TXT, SRT)
- 🔑 Secure API key management
- 💻 Cross-platform support
- 🚀 Easy to use CLI interface

## Installation

```bash
# Using npm
npm install -g meeting-diary

# Using yarn
yarn global add meeting-diary

# Using bun
bun install -g meeting-diary
```

## Usage

### Basic Usage

```bash
meeting-diary input.mp4
```

This will process the file and output the transcript in diarized markdown format, with sections for each speaker.

### Specify Output Format

```bash
meeting-diary input.mp4 -f txt  # Simple text format
meeting-diary input.mp4 -f srt  # SubRip subtitle format
meeting-diary input.mp4 -f json # JSON format with detailed metadata
```

The default format (markdown) organizes the transcript by speaker, making it easy to read and analyze each participant's contributions.

### Known Speakers

You can identify speakers in two ways:

1. Interactive identification (default):

```bash
meeting-diary input.mp4
```

The tool will show you the most significant contributions from each speaker and ask you to identify them.

2. Specify speakers up front:

```bash
meeting-diary input.mp4 -s "John Smith" "Jane Doe"
```

The interactive mode helps you accurately identify speakers by showing their most substantial contributions in context. You can disable it with `--no-interactive` if needed.

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
