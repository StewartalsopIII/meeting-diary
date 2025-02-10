import { describe, it, expect, beforeEach, mock, spyOn } from "bun:test";
import {
  checkFileExists,
  validateApiKey,
  formatTranscriptAsSRT,
  formatTranscriptAsText,
  processAudioFile,
  ProcessingError,
} from "../lib";
import type { ProcessedTranscript } from "../types";
import fs from "fs/promises";

// Mock fs.access
const mockAccess = spyOn(fs, "access");

// Create mock responses
const mockTranscriptResponse = {
  id: "mock-transcript-id",
  status: "completed",
  audio_duration: 60000,
  utterances: [
    {
      text: "Hello world",
      start: 0,
      end: 1000,
      speaker: "speaker_1",
      confidence: 0.95,
    },
  ],
};

// Create a mock for AssemblyAI's list method
const mockList = mock(({ apiKey }: { apiKey: string }) => {
  if (apiKey === "valid-key") {
    return Promise.resolve({ items: [] });
  }
  return Promise.reject(new Error("Invalid API key"));
});

// Create a mock for file upload
const mockUpload = mock(() => Promise.resolve("mock-audio-url"));

// Create a mock for transcript creation and retrieval
const mockCreate = mock(() => Promise.resolve({ id: "mock-transcript-id" }));
const mockGet = mock(() => Promise.resolve(mockTranscriptResponse));

// Mock AssemblyAI
mock.module("assemblyai", () => ({
  AssemblyAI: mock((config: { apiKey: string }) => ({
    transcripts: {
      list: () => mockList(config),
      create: mockCreate,
      get: mockGet,
    },
    files: {
      upload: mockUpload,
    },
    lemur: {},
    realtime: {},
  })),
}));

describe("Core functionality", () => {
  beforeEach(() => {
    mockAccess.mockClear();
    mockList.mockClear();
    mockUpload.mockClear();
    mockCreate.mockClear();
    mockGet.mockClear();

    // Reset default implementations
    mockUpload.mockImplementation(() => Promise.resolve("mock-audio-url"));
    mockCreate.mockImplementation(() =>
      Promise.resolve({ id: "mock-transcript-id" })
    );
    mockGet.mockImplementation(() => Promise.resolve(mockTranscriptResponse));
  });

  describe("checkFileExists", () => {
    it("should return true when file exists", async () => {
      mockAccess.mockImplementation(() => Promise.resolve());

      const result = await checkFileExists("/path/to/file");
      expect(result).toBe(true);
      expect(mockAccess).toHaveBeenCalledWith("/path/to/file");
    });

    it("should return false when file does not exist", async () => {
      mockAccess.mockImplementation(() => Promise.reject(new Error()));

      const result = await checkFileExists("/path/to/file");
      expect(result).toBe(false);
      expect(mockAccess).toHaveBeenCalledWith("/path/to/file");
    });
  });

  describe("validateApiKey", () => {
    it("should return true for valid API key", async () => {
      const result = await validateApiKey("valid-key");
      expect(result).toBe(true);
    });

    it("should return false for invalid API key", async () => {
      const result = await validateApiKey("invalid-key");
      expect(result).toBe(false);
    });
  });

  describe("processAudioFile", () => {
    it("should process audio file successfully", async () => {
      mockAccess.mockImplementation(() => Promise.resolve());

      const result = await processAudioFile("/path/to/file", "valid-key");

      expect(mockUpload).toHaveBeenCalledTimes(1);
      expect(mockCreate).toHaveBeenCalledTimes(1);
      expect(mockGet).toHaveBeenCalledTimes(1);

      expect(result.segments).toHaveLength(1);
      expect(result.speakers).toHaveLength(1);
      expect(result.metadata.duration).toBe(60000);
      expect(result.segments[0].text).toBe("Hello world");
    });

    it("should handle file not found error", async () => {
      mockAccess.mockImplementation(() => Promise.reject(new Error()));

      await expect(
        processAudioFile("/path/to/file", "valid-key")
      ).rejects.toThrow(
        new ProcessingError("Input file does not exist", "FILE_NOT_FOUND")
      );
    });

    it("should handle transcription error", async () => {
      mockAccess.mockImplementation(() => Promise.resolve());
      mockGet.mockImplementation(() =>
        Promise.resolve({
          ...mockTranscriptResponse,
          status: "error",
          error: "Transcription failed",
        })
      );

      await expect(
        processAudioFile("/path/to/file", "valid-key")
      ).rejects.toThrow(
        new ProcessingError(
          "Transcription failed: Transcription failed",
          "TRANSCRIPTION_FAILED"
        )
      );
    });

    it("should handle polling for completion", async () => {
      mockAccess.mockImplementation(() => Promise.resolve());
      let callCount = 0;
      mockGet.mockImplementation(() => {
        callCount++;
        if (callCount < 3) {
          return Promise.resolve({
            ...mockTranscriptResponse,
            status: "processing",
          });
        }
        return Promise.resolve(mockTranscriptResponse);
      });

      const result = await processAudioFile("/path/to/file", "valid-key");
      expect(mockGet).toHaveBeenCalledTimes(3);
      expect(result.segments).toHaveLength(1);
    });

    it("should handle non-ProcessingError errors", async () => {
      mockAccess.mockImplementation(() => Promise.resolve());
      mockUpload.mockImplementation(() =>
        Promise.reject(new Error("Network error"))
      );

      await expect(
        processAudioFile("/path/to/file", "valid-key")
      ).rejects.toThrow(
        new ProcessingError(
          "Processing failed: Network error",
          "PROCESSING_FAILED"
        )
      );
    });

    it("should handle missing utterance data", async () => {
      mockAccess.mockImplementation(() => Promise.resolve());
      mockGet.mockImplementation(() =>
        Promise.resolve({
          id: "mock-transcript-id",
          status: "completed",
          audio_duration: 60000,
          utterances: [],
        })
      );

      const result = await processAudioFile("/path/to/file", "valid-key");
      expect(result.segments).toHaveLength(0);
      expect(result.speakers).toHaveLength(0);
      expect(result.metadata.duration).toBe(60000);
    });

    it("should support known speakers", async () => {
      mockAccess.mockImplementation(() => Promise.resolve());
      const knownSpeakers = { speaker_1: "John Doe" };

      const result = await processAudioFile("/path/to/file", "valid-key", {
        knownSpeakers,
      });

      expect(result.segments[0].speaker.name).toBe("John Doe");
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          speakers_expected: 1,
          speaker_labels: true,
        })
      );
    });
  });

  describe("formatTranscriptAsSRT", () => {
    const mockTranscript: ProcessedTranscript = {
      segments: [
        {
          text: "Hello world",
          start: 0,
          end: 1000,
          speaker: { id: "1", name: "Alice", confidence: 0.9 },
          confidence: 0.95,
        },
        {
          text: "Second line",
          start: 3600000, // 1 hour
          end: 3605000, // 1 hour + 5 seconds
          speaker: { id: "2", name: "Bob", confidence: 0.85 },
          confidence: 0.9,
        },
      ],
      speakers: [
        { id: "1", name: "Alice", confidence: 0.9 },
        { id: "2", name: "Bob", confidence: 0.85 },
      ],
      metadata: {
        fileName: "test.mp3",
        duration: 3605000,
        processedAt: "2024-02-10T00:00:00.000Z",
      },
    };

    it("should format transcript in SRT format", () => {
      const result = formatTranscriptAsSRT(mockTranscript);
      expect(result).toContain("1");
      expect(result).toContain("00:00:00,000 --> 00:00:01,000");
      expect(result).toContain("Alice: Hello world");
      // Test hour formatting
      expect(result).toContain("01:00:00,000 --> 01:00:05,000");
      expect(result).toContain("Bob: Second line");
    });
  });

  describe("formatTranscriptAsText", () => {
    const mockTranscript: ProcessedTranscript = {
      segments: [
        {
          text: "Hello world",
          start: 0,
          end: 1000,
          speaker: { id: "1", name: "Alice", confidence: 0.9 },
          confidence: 0.95,
        },
      ],
      speakers: [{ id: "1", name: "Alice", confidence: 0.9 }],
      metadata: {
        fileName: "test.mp3",
        duration: 1000,
        processedAt: "2024-02-10T00:00:00.000Z",
      },
    };

    it("should format transcript in text format", () => {
      const result = formatTranscriptAsText(mockTranscript);
      expect(result).toBe("[Alice] Hello world");
    });
  });
});
