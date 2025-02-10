import { AssemblyAI } from "assemblyai";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import os from "os";
import chalk from "chalk";
import inquirer from "inquirer";
import {
  ProcessedTranscript,
  Speaker,
  TranscriptSegment,
  CacheEntry,
  CacheOptions,
} from "./types";

export class ProcessingError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = "ProcessingError";
  }
}

export async function checkFileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function validateApiKey(apiKey: string): Promise<boolean> {
  const client = new AssemblyAI({
    apiKey,
  });

  try {
    await client.transcripts.list({ limit: 1 });
    return true;
  } catch (error) {
    return false;
  }
}

async function calculateFileHash(filePath: string): Promise<string> {
  const fileBuffer = await fs.readFile(filePath);
  return crypto.createHash("sha256").update(fileBuffer).digest("hex");
}

async function getCacheDir(options?: CacheOptions): Promise<string> {
  const cacheDir =
    options?.cacheDir || path.join(os.tmpdir(), "meeting-diary-cache");
  await fs.mkdir(cacheDir, { recursive: true });
  return cacheDir;
}

async function getCacheEntry(
  filePath: string,
  options?: CacheOptions
): Promise<CacheEntry | null> {
  if (!options?.enabled) return null;

  try {
    const cacheDir = await getCacheDir(options);
    const hash = await calculateFileHash(filePath);
    const cacheFile = path.join(cacheDir, `${hash}.json`);

    const cacheData = await fs.readFile(cacheFile, "utf-8");
    const entry: CacheEntry = JSON.parse(cacheData);

    // Validate cache entry
    if (entry.hash !== hash) return null;

    return entry;
  } catch (error) {
    return null;
  }
}

async function setCacheEntry(
  filePath: string,
  entry: CacheEntry,
  options?: CacheOptions
): Promise<void> {
  if (!options?.enabled) return;

  try {
    const cacheDir = await getCacheDir(options);
    const cacheFile = path.join(cacheDir, `${entry.hash}.json`);
    await fs.writeFile(cacheFile, JSON.stringify(entry, null, 2));
  } catch (error) {
    console.warn("Failed to write cache entry:", error);
  }
}

export async function processAudioFile(
  filePath: string,
  apiKey: string,
  options: {
    knownSpeakers?: Record<string, string>;
    skipDiarization?: boolean;
    cache?: CacheOptions;
  } = {}
): Promise<ProcessedTranscript> {
  if (!(await checkFileExists(filePath))) {
    throw new ProcessingError("Input file does not exist", "FILE_NOT_FOUND");
  }

  // Check cache first
  const fileHash = await calculateFileHash(filePath);
  const cacheEntry = await getCacheEntry(filePath, options.cache);

  if (cacheEntry?.data.transcript) {
    return cacheEntry.data.transcript;
  }

  const client = new AssemblyAI({
    apiKey,
  });

  try {
    // Try to use cached audio URL
    let audioUrl = cacheEntry?.data.audioUrl;

    if (!audioUrl) {
      audioUrl = await client.files.upload(filePath);
      // Cache the audio URL
      await setCacheEntry(
        filePath,
        {
          timestamp: new Date().toISOString(),
          hash: fileHash,
          data: { audioUrl },
        },
        options.cache
      );
    }

    // Try to use cached transcript ID
    let transcriptId = cacheEntry?.data.transcriptId;
    let result;

    if (transcriptId) {
      result = await client.transcripts.get(transcriptId);
      if (result.status === "error") {
        transcriptId = undefined; // Reset if there was an error
      }
    }

    if (!transcriptId) {
      // Create new transcript
      const params = {
        audio_url: audioUrl,
        speaker_labels: !options.skipDiarization,
        speakers_expected:
          options.knownSpeakers && Object.keys(options.knownSpeakers).length > 0
            ? Object.keys(options.knownSpeakers).length
            : undefined,
      };

      const transcript = await client.transcripts.create(params);
      transcriptId = transcript.id;
      result = await client.transcripts.get(transcriptId);

      // Cache the transcript ID
      await setCacheEntry(
        filePath,
        {
          timestamp: new Date().toISOString(),
          hash: fileHash,
          data: { audioUrl, transcriptId },
        },
        options.cache
      );
    }

    if (result.status === "error") {
      throw new ProcessingError(
        `Transcription failed: ${result.error}`,
        "TRANSCRIPTION_FAILED"
      );
    }

    // Wait for completion if needed
    while (result.status !== "completed") {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      result = await client.transcripts.get(transcriptId);
      if (result.status === "error") {
        throw new ProcessingError(
          `Transcription failed: ${result.error}`,
          "TRANSCRIPTION_FAILED"
        );
      }
    }

    // Process speakers and segments from utterances
    const speakers = new Map<string, Speaker>();
    const segments: TranscriptSegment[] = [];

    if (result.utterances) {
      for (const utterance of result.utterances) {
        if (!utterance.speaker || !utterance.text) continue;

        const speakerId = `speaker_${utterance.speaker.charCodeAt(0) - 64}`;

        if (!speakers.has(speakerId)) {
          speakers.set(speakerId, {
            id: speakerId,
            name:
              options.knownSpeakers?.[speakerId] ||
              `Speaker ${utterance.speaker}`,
            confidence: utterance.confidence || 0,
          });
        }

        segments.push({
          text: utterance.text,
          start: utterance.start || 0,
          end: utterance.end || 0,
          speaker: speakers.get(speakerId)!,
          confidence: utterance.confidence || 0,
        });
      }
    }

    const processedTranscript: ProcessedTranscript = {
      segments,
      speakers: Array.from(speakers.values()),
      metadata: {
        fileName: path.basename(filePath),
        duration: result.audio_duration || 0,
        processedAt: new Date().toISOString(),
      },
    };

    // Cache the final transcript
    await setCacheEntry(
      filePath,
      {
        timestamp: new Date().toISOString(),
        hash: fileHash,
        data: { audioUrl, transcriptId, transcript: processedTranscript },
      },
      options.cache
    );

    return processedTranscript;
  } catch (error) {
    if (error instanceof ProcessingError) throw error;
    throw new ProcessingError(
      `Processing failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
      "PROCESSING_FAILED"
    );
  }
}

export function formatTranscriptAsSRT(transcript: ProcessedTranscript): string {
  return transcript.segments
    .map((segment, index) => {
      const formatTime = (ms: number) => {
        const date = new Date(ms);
        const hours = Math.floor(ms / 3600000);
        const minutes = date.getUTCMinutes();
        const seconds = date.getUTCSeconds();
        const milliseconds = date.getUTCMilliseconds();
        return `${hours.toString().padStart(2, "0")}:${minutes
          .toString()
          .padStart(2, "0")}:${seconds
          .toString()
          .padStart(2, "0")},${milliseconds.toString().padStart(3, "0")}`;
      };

      return `${index + 1}
${formatTime(segment.start)} --> ${formatTime(segment.end)}
${segment.speaker.name}: ${segment.text}
`;
    })
    .join("\n");
}

export function formatTranscriptAsText(
  transcript: ProcessedTranscript
): string {
  return transcript.segments
    .map((segment) => `[${segment.speaker.name}] ${segment.text}`)
    .join("\n");
}

export function formatTranscriptAsMarkdown(
  transcript: ProcessedTranscript
): string {
  // Helper to format time
  const formatTime = (ms: number): string => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  // Header with metadata
  const parts: string[] = [
    `# Meeting Transcript\n`,
    `*Processed on ${new Date(
      transcript.metadata.processedAt
    ).toLocaleString()}*\n`,
    `*Duration: ${Math.round(
      transcript.metadata.duration / 60000
    )} minutes*\n\n`,
  ];

  // Add speaker list
  parts.push("## Speakers\n");
  transcript.speakers.forEach((speaker) => {
    parts.push(`- **${speaker.name}**\n`);
  });
  parts.push("\n## Transcript\n\n");

  // Process segments in chronological order
  transcript.segments.forEach((segment) => {
    parts.push(
      `[${formatTime(segment.start)}] **${segment.speaker.name}**: ${
        segment.text
      }\n\n`
    );
  });

  return parts.join("");
}

interface SpeakerExample {
  speaker: Speaker;
  segment: TranscriptSegment;
  context: {
    before?: TranscriptSegment;
    after?: TranscriptSegment;
  };
}

function findBestExamplesForSpeaker(
  transcript: ProcessedTranscript,
  speakerId: string,
  numExamples: number = 3
): SpeakerExample[] {
  // Get all segments for this speaker
  const speakerSegments = transcript.segments.filter(
    (s) => s.speaker.id === speakerId
  );

  // Sort by length to get the most substantial contributions
  const sortedSegments = [...speakerSegments].sort(
    (a, b) => b.text.length - a.text.length
  );

  // Take top N segments and find their context
  return sortedSegments.slice(0, numExamples).map((segment) => {
    const segmentIndex = transcript.segments.findIndex((s) => s === segment);
    return {
      speaker: segment.speaker,
      segment,
      context: {
        before:
          segmentIndex > 0 ? transcript.segments[segmentIndex - 1] : undefined,
        after:
          segmentIndex < transcript.segments.length - 1
            ? transcript.segments[segmentIndex + 1]
            : undefined,
      },
    };
  });
}

export async function identifySpeakers(
  transcript: ProcessedTranscript
): Promise<Record<string, string>> {
  const speakerMap: Record<string, string> = {};

  // Process each speaker
  for (const speaker of transcript.speakers) {
    console.log(chalk.cyan("\n----------------------------------------"));
    console.log(chalk.bold(`Identifying ${speaker.name}...\n`));

    // Show identified speakers so far
    if (Object.keys(speakerMap).length > 0) {
      console.log(chalk.dim("Speakers identified so far:"));
      Object.entries(speakerMap).forEach(([id, name]) => {
        const originalName =
          transcript.speakers.find((s) => s.id === id)?.name || "Unknown";
        console.log(chalk.dim(`- ${originalName} → ${name}`));
      });
      console.log();
    }

    // Get best examples
    const examples = findBestExamplesForSpeaker(transcript, speaker.id);

    // Show examples with context
    examples.forEach((example, index) => {
      console.log(chalk.yellow(`Example ${index + 1}:`));
      if (example.context.before) {
        const beforeSpeaker = example.context.before.speaker;
        const knownName = speakerMap[beforeSpeaker.id];
        console.log(
          chalk.dim(
            `${beforeSpeaker.name}${knownName ? ` (${knownName})` : ""}: ${
              example.context.before.text
            }`
          )
        );
      }
      console.log(
        chalk.green(`${example.speaker.name}: ${example.segment.text}`)
      );
      if (example.context.after) {
        const afterSpeaker = example.context.after.speaker;
        const knownName = speakerMap[afterSpeaker.id];
        console.log(
          chalk.dim(
            `${afterSpeaker.name}${knownName ? ` (${knownName})` : ""}: ${
              example.context.after.text
            }`
          )
        );
      }
      console.log();
    });

    // Ask for speaker identification
    const { name } = await inquirer.prompt<{ name: string }>([
      {
        type: "input",
        name: "name",
        message: "Who is this speaker?",
        validate: (input: string) => {
          if (!input.trim()) return "Speaker name cannot be empty";
          return true;
        },
      },
    ]);

    speakerMap[speaker.id] = name.trim();
  }

  return speakerMap;
}

export function updateTranscriptSpeakers(
  transcript: ProcessedTranscript,
  speakerMap: Record<string, string>
): ProcessedTranscript {
  // Update speaker names
  const updatedSpeakers = transcript.speakers.map((speaker) => ({
    ...speaker,
    name: speakerMap[speaker.id] || speaker.name,
  }));

  // Update segment speaker names
  const updatedSegments = transcript.segments.map((segment) => ({
    ...segment,
    speaker: {
      ...segment.speaker,
      name: speakerMap[segment.speaker.id] || segment.speaker.name,
    },
  }));

  return {
    ...transcript,
    speakers: updatedSpeakers,
    segments: updatedSegments,
  };
}
