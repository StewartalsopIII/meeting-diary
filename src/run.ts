#!/usr/bin/env node

import { Command } from "commander";
import fs from "fs/promises";
import path from "path";
import ora from "ora";
import chalk from "chalk";
import inquirer from "inquirer";
import Conf from "conf";
import {
  ProcessingError,
  processAudioFile,
  formatTranscriptAsSRT,
  formatTranscriptAsText,
  formatTranscriptAsMarkdown,
  validateApiKey,
  identifySpeakers,
  updateTranscriptSpeakers,
} from "./lib";
import type { Config } from "./types";

const config = new Conf<Config>({
  projectName: "meeting-diary",
  schema: {
    assemblyAiKey: {
      type: "string",
      default: undefined,
    },
    defaultOutputDir: {
      type: "string",
      default: undefined,
    },
    knownSpeakers: {
      type: "object",
      default: {},
    },
    cacheEnabled: {
      type: "boolean",
      default: true,
    },
    cacheDir: {
      type: "string",
      default: undefined,
    },
  },
});

const program = new Command();

async function getApiKey(): Promise<string> {
  const savedKey = config.get("assemblyAiKey");
  const envKey = process.env.ASSEMBLYAI_API_KEY;
  let apiKey = savedKey || envKey;

  if (!apiKey) {
    const result = await inquirer.prompt<{ apiKey: string; save: boolean }>([
      {
        type: "password",
        name: "apiKey",
        message: "Please enter your AssemblyAI API key:",
        validate: async (input: string) => {
          if (!input) return "API key is required";
          const isValid = await validateApiKey(input);
          return isValid ? true : "Invalid API key";
        },
      },
      {
        type: "confirm",
        name: "save",
        message: "Would you like to save this API key for future use?",
        default: true,
      },
    ]);

    apiKey = result.apiKey;
    if (result.save) {
      config.set("assemblyAiKey", apiKey);
    }
  }

  if (!apiKey) {
    throw new Error("API key is required");
  }

  return apiKey;
}

async function main() {
  program
    .name("meeting-diary")
    .description("Transcribe and diarize audio/video files")
    .version("0.0.1")
    .argument("<input>", "Input audio/video file")
    .option(
      "-o, --output <file>",
      "Output file (defaults to input file name with new extension)"
    )
    .option("-f, --format <format>", "Output format (json, txt, srt, md)", "md")
    .option(
      "-s, --speakers <names...>",
      "Known speaker names (skip interactive identification)"
    )
    .option("--skip-diarization", "Skip speaker diarization")
    .option("-v, --verbose", "Show verbose output")
    .option(
      "--api-key <key>",
      "AssemblyAI API key (will prompt if not provided)"
    )
    .option("--no-cache", "Disable caching of uploads and transcripts")
    .option("--cache-dir <dir>", "Directory to store cache files")
    .option("--no-interactive", "Skip interactive speaker identification")
    .action(async (input, options) => {
      const spinner = ora();
      try {
        // Validate input file
        if (
          !(await fs
            .access(input)
            .then(() => true)
            .catch(() => false))
        ) {
          throw new ProcessingError(
            "Input file does not exist",
            "FILE_NOT_FOUND"
          );
        }

        // Get API key
        const apiKey = options.apiKey || (await getApiKey());

        // Process known speakers
        const knownSpeakers: Record<string, string> = {};
        if (options.speakers) {
          options.speakers.forEach((name, index) => {
            knownSpeakers[`speaker_${index + 1}`] = name;
          });
        }

        // Determine output file
        const outputFile =
          options.output ||
          path.join(
            path.dirname(input),
            `${path.basename(input, path.extname(input))}.${options.format}`
          );

        // Process the file
        spinner.start("Processing audio file...");
        let result = await processAudioFile(input, apiKey, {
          knownSpeakers: options.speakers ? knownSpeakers : undefined,
          skipDiarization: options.skipDiarization,
          cache: {
            enabled: options.cache !== false,
            cacheDir: options.cacheDir,
          },
        });

        // If no speakers provided and interactive mode is enabled, identify speakers
        if (
          !options.speakers &&
          options.interactive !== false &&
          !options.skipDiarization
        ) {
          spinner.stop();
          console.log(
            chalk.cyan("\nLet's identify the speakers in this recording.\n")
          );
          console.log(
            chalk.dim(
              "I'll show you the most significant contributions from each speaker."
            )
          );
          console.log(
            chalk.dim("Please help identify who is speaking in each case.\n")
          );

          const speakerMap = await identifySpeakers(result);
          result = updateTranscriptSpeakers(result, speakerMap);

          // Update cache with identified speakers
          if (options.cache !== false) {
            spinner.start("Updating cache with speaker identifications...");
            await processAudioFile(input, apiKey, {
              knownSpeakers: speakerMap,
              skipDiarization: options.skipDiarization,
              cache: {
                enabled: true,
                cacheDir: options.cacheDir,
              },
            });
            spinner.stop();
          }
        }

        // Format output
        spinner.start("Formatting transcript...");
        let output: string;
        switch (options.format) {
          case "srt":
            output = formatTranscriptAsSRT(result);
            break;
          case "txt":
            output = formatTranscriptAsText(result);
            break;
          case "md":
            output = formatTranscriptAsMarkdown(result);
            break;
          default:
            output = JSON.stringify(result, null, 2);
        }

        // Write output
        await fs.writeFile(outputFile, output);
        spinner.succeed(
          chalk.green(`Processed successfully! Output saved to ${outputFile}`)
        );

        if (options.verbose) {
          console.log("\nProcessing summary:");
          console.log(
            `- Duration: ${Math.round(
              result.metadata.duration / 60000
            )} minutes`
          );
          console.log(`- Speakers detected: ${result.speakers.length}`);
          console.log(`- Segments: ${result.segments.length}`);
        }
      } catch (error) {
        spinner.fail(chalk.red("Processing failed"));

        if (error instanceof ProcessingError) {
          console.error(chalk.red(`\nError (${error.code}): ${error.message}`));
        } else {
          console.error(chalk.red("\nUnexpected error:"), error);
        }

        process.exit(1);
      }
    });

  await program.parseAsync();
}

main().catch((error) => {
  console.error(chalk.red("Fatal error:"), error);
  process.exit(1);
});
