import { AssemblyAI } from "assemblyai";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import os from "os";
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
  const speakerSections = new Map<string, string[]>();

  // Group segments by speaker
  transcript.segments.forEach((segment) => {
    const speakerId = segment.speaker.id;
    if (!speakerSections.has(speakerId)) {
      speakerSections.set(speakerId, []);
    }
    speakerSections.get(speakerId)!.push(segment.text);
  });

  // Build markdown with speaker sections
  const parts: string[] = [
    `# Meeting Transcript\n`,
    `*Processed on ${new Date(
      transcript.metadata.processedAt
    ).toLocaleString()}*\n`,
    `*Duration: ${Math.round(
      transcript.metadata.duration / 60000
    )} minutes*\n\n`,
  ];

  transcript.speakers.forEach((speaker) => {
    const speakerTexts = speakerSections.get(speaker.id);
    if (speakerTexts && speakerTexts.length > 0) {
      parts.push(`## ${speaker.name}\n\n${speakerTexts.join("\n\n")}\n\n`);
    }
  });

  return parts.join("");
}
