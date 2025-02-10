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

This will process the file and output the transcript in JSON format.

### Specify Output Format

```bash
meeting-diary input.mp4 -f txt
meeting-diary input.mp4 -f srt
```

### Known Speakers

```bash
meeting-diary input.mp4 -s "John Smith" "Jane Doe"
```

### All Options

```bash
Options:
  -o, --output <file>     Output file (defaults to input file name with new extension)
  -f, --format <format>   Output format (json, txt, srt) (default: "json")
  -s, --speakers <names>  Known speaker names
  --skip-diarization     Skip speaker diarization
  -v, --verbose          Show verbose output
  --api-key <key>        AssemblyAI API key (will prompt if not provided)
  -h, --help             display help for command
```

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
