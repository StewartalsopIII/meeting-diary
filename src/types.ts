import { z } from "zod";

export const ConfigSchema = z.object({
  assemblyAiKey: z.string().optional(),
  defaultOutputDir: z.string().optional(),
  knownSpeakers: z.record(z.string(), z.string()).optional(),
});

export type Config = z.infer<typeof ConfigSchema>;

export interface Speaker {
  id: string;
  name: string;
  confidence: number;
}

export interface TranscriptSegment {
  text: string;
  start: number;
  end: number;
  speaker: Speaker;
  confidence: number;
}

export interface ProcessedTranscript {
  segments: TranscriptSegment[];
  speakers: Speaker[];
  metadata: {
    fileName: string;
    duration: number;
    processedAt: string;
  };
}

export interface SelectorOptions {
  numExamples: number;
  sampleSize?: number;
  prioritizeComplete?: boolean;
  completenessWeight?: number;
}

export interface CliOptions {
  input: string;
  output?: string;
  speakers?: string[];
  format?: "json" | "txt" | "srt" | "md";
  verbose?: boolean;
  skipDiarization?: boolean;
  assemblyAiKey?: string;
}
