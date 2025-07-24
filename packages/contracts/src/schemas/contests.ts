import { z } from "zod";
import { IdSchema, PercentageSchema, WpmSchema } from "./util";
import { Mode2Schema, ModeSchema } from "./shared";

export const ContestEntrySchema = z.object({
  wpm: WpmSchema,
  rawWpm: WpmSchema,
  cpm: z.number().nonnegative().optional(), // Characters per minute (strokes per minute) - optional
  acc: PercentageSchema.min(50),
  consistency: PercentageSchema,
  timestamp: z.number().int().nonnegative(),
  uid: z.string(),
  name: z.string(),
  discordId: z.string().optional(),
  discordAvatar: z.string().optional(),
  badgeId: z.number().int().optional(),
  isPremium: z.boolean().optional(),
  rank: z.number().nonnegative().int().optional(),
});
export type ContestEntry = z.infer<typeof ContestEntrySchema>;

export const ContestResultSchema = z.object({
  _id: IdSchema,
  wpm: WpmSchema,
  rawWpm: WpmSchema,
  cpm: z.number().nonnegative().optional(), // Characters per minute (optional for now)
  acc: PercentageSchema.min(50),
  consistency: PercentageSchema,
  timestamp: z.number().int().nonnegative(),
  testDuration: z.number().min(1),
  // Additional contest-specific fields
  contestId: IdSchema,
  attemptNumber: z.number().int().positive(),
  // Optional fields that might be included for analysis
  restartCount: z.number().int().nonnegative().optional(),
  incompleteTestSeconds: z.number().nonnegative().optional(),
  afkDuration: z.number().nonnegative().optional(),
  bailedOut: z.boolean().optional(),
});
export type ContestResult = z.infer<typeof ContestResultSchema>;

export const ContestSchema = z.object({
  _id: IdSchema,
  name: z.string(),
  description: z.string().optional(),
  startTime: z.number().int().nonnegative().optional(), // Unix timestamp
  endTime: z.number().int().nonnegative().optional(), // Unix timestamp
  isActive: z.boolean(),
  options: z.object({
    mode: ModeSchema,
    mode2: Mode2Schema,
    punctuation: z.boolean(),
    numbers: z.boolean(),
  }),
  // Results stored in contest document, indexed by user ID
  results: z
    .record(
      z.string(),
      z.array(ContestResultSchema.omit({ _id: true, contestId: true }))
    )
    .optional(),
});
export type Contest = z.infer<typeof ContestSchema>;

export const ContestLeaderboardEntrySchema = ContestEntrySchema.extend({
  bestAttempt: ContestResultSchema.pick({
    wpm: true,
    rawWpm: true,
    cpm: true,
    acc: true,
    consistency: true,
    timestamp: true,
    testDuration: true,
    attemptNumber: true,
  }),
  totalAttempts: z.number().int().nonnegative(),
});
export type ContestLeaderboardEntry = z.infer<
  typeof ContestLeaderboardEntrySchema
>;
