export * from "./lib";
export * from "./types";

// Re-export specific types for better DX
export type {
  Speaker,
  TranscriptSegment,
  ProcessedTranscript,
  Config,
} from "./types";
