import { AssemblyAI } from "assemblyai";
import fs from "fs/promises";
import path from "path";
import { ProcessedTranscript, Speaker, TranscriptSegment } from "./types";

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

export async function processAudioFile(
  filePath: string,
  apiKey: string,
  options: {
    knownSpeakers?: Record<string, string>;
    skipDiarization?: boolean;
  } = {}
): Promise<ProcessedTranscript> {
  if (!(await checkFileExists(filePath))) {
    throw new ProcessingError("Input file does not exist", "FILE_NOT_FOUND");
  }

  const client = new AssemblyAI({
    apiKey,
  });

  try {
    // Upload the file
    const audioUrl = await client.files.upload(filePath);

    // Create the transcript
    const params = {
      audio_url: audioUrl,
      speaker_labels: !options.skipDiarization,
      speakers_expected: options.knownSpeakers
        ? Object.keys(options.knownSpeakers).length
        : undefined,
    };

    const transcript = await client.transcripts.create(params);
    const result = await client.transcripts.get(transcript.id);

    if (result.status === "error") {
      throw new ProcessingError(
        `Transcription failed: ${result.error}`,
        "TRANSCRIPTION_FAILED"
      );
    }

    // Wait for completion
    while (result.status !== "completed") {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const updatedResult = await client.transcripts.get(transcript.id);
      if (updatedResult.status === "error") {
        throw new ProcessingError(
          `Transcription failed: ${updatedResult.error}`,
          "TRANSCRIPTION_FAILED"
        );
      }
      if (updatedResult.status === "completed") {
        Object.assign(result, updatedResult);
        break;
      }
    }

    // Process speakers and segments
    const speakers = new Map<string, Speaker>();
    const segments: TranscriptSegment[] = [];

    if (result.utterances) {
      for (const utterance of result.utterances) {
        if (!utterance.speaker || !utterance.text) continue;

        const speakerId = utterance.speaker;
        if (!speakers.has(speakerId)) {
          speakers.set(speakerId, {
            id: speakerId,
            name: options.knownSpeakers?.[speakerId] || `Speaker ${speakerId}`,
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

    return {
      segments,
      speakers: Array.from(speakers.values()),
      metadata: {
        fileName: path.basename(filePath),
        duration: result.audio_duration || 0,
        processedAt: new Date().toISOString(),
      },
    };
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
