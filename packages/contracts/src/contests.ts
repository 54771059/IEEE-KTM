import { z } from "zod";
import {
  CommonResponses,
  meta,
  MonkeyClientError,
  responseWithData,
  responseWithNullableData,
} from "./schemas/api";
import {
  ContestSchema,
  ContestResultSchema,
  ContestLeaderboardEntrySchema,
} from "./schemas/contests";
import { initContract } from "@ts-rest/core";
import { IdSchema } from "./schemas/util";

const PaginationQuerySchema = z.object({
  page: z.number().int().safe().nonnegative().default(0),
  pageSize: z.number().int().safe().positive().min(10).max(200).default(50),
});

const ContestLeaderboardResponseSchema = z.object({
  count: z.number().int().nonnegative(),
  pageSize: z.number().int().positive(),
  entries: z.array(ContestLeaderboardEntrySchema),
  contestInfo: ContestSchema,
});

//--------------------------------------------------------------------------

export const GetActiveContestResponseSchema =
  responseWithNullableData(ContestSchema);
export type GetActiveContestResponse = z.infer<
  typeof GetActiveContestResponseSchema
>;

//--------------------------------------------------------------------------

export const AddContestResultRequestSchema = z.object({
  result: ContestResultSchema.omit({
    _id: true,
    contestId: true,
    attemptNumber: true,
  }),
});
export type AddContestResultRequest = z.infer<
  typeof AddContestResultRequestSchema
>;

export const AddContestResultResponseSchema = responseWithData(
  z.object({
    insertedId: IdSchema,
    attemptNumber: z.number().int().positive(),
    rank: z.number().int().positive().optional(),
  })
);
export type AddContestResultResponse = z.infer<
  typeof AddContestResultResponseSchema
>;

//--------------------------------------------------------------------------

export const GetContestLeaderboardQuerySchema = z
  .object({
    contestId: IdSchema.optional(), // If not provided, gets active contest
  })
  .merge(PaginationQuerySchema);

export type GetContestLeaderboardQuery = z.infer<
  typeof GetContestLeaderboardQuerySchema
>;

export const GetContestLeaderboardResponseSchema = responseWithData(
  ContestLeaderboardResponseSchema
);
export type GetContestLeaderboardResponse = z.infer<
  typeof GetContestLeaderboardResponseSchema
>;

//--------------------------------------------------------------------------

export const GetContestUserRankQuerySchema = z.object({
  contestId: IdSchema.optional(), // If not provided, gets active contest
});
export type GetContestUserRankQuery = z.infer<
  typeof GetContestUserRankQuerySchema
>;

export const GetContestUserRankResponseSchema = responseWithNullableData(
  ContestLeaderboardEntrySchema
);
export type GetContestUserRankResponse = z.infer<
  typeof GetContestUserRankResponseSchema
>;

//--------------------------------------------------------------------------

export const GetContestUserResultsQuerySchema = z
  .object({
    contestId: IdSchema.optional(), // If not provided, gets active contest
  })
  .merge(PaginationQuerySchema);

export type GetContestUserResultsQuery = z.infer<
  typeof GetContestUserResultsQuerySchema
>;

export const GetContestUserResultsResponseSchema = responseWithData(
  z.object({
    results: z.array(ContestResultSchema),
    bestResult: ContestResultSchema.optional(),
    totalAttempts: z.number().int().nonnegative(),
    contestInfo: ContestSchema,
  })
);
export type GetContestUserResultsResponse = z.infer<
  typeof GetContestUserResultsResponseSchema
>;

//--------------------------------------------------------------------------

const c = initContract();
export const contestsContract = c.router(
  {
    getActive: {
      summary: "get active contest",
      description: "Get the currently active contest information.",
      method: "GET",
      path: "/active",
      responses: {
        200: GetActiveContestResponseSchema,
        404: MonkeyClientError,
      },
      metadata: meta({
        authenticationOptions: { isPublic: true },
        requireConfiguration: {
          path: "contests.enabled",
          invalidMessage: "Contest mode is not available at this time.",
        },
      }),
    },
    addResult: {
      summary: "add contest result",
      description: "Add a result to the active contest.",
      method: "POST",
      path: "/results",
      body: AddContestResultRequestSchema,
      responses: {
        200: AddContestResultResponseSchema,
        400: MonkeyClientError,
        401: MonkeyClientError,
        422: MonkeyClientError,
      },
      metadata: meta({
        authenticationOptions: { acceptApeKeys: true },
        requireConfiguration: {
          path: "contests.enabled",
          invalidMessage: "Contest mode is not available at this time.",
        },
      }),
    },
    getLeaderboard: {
      summary: "get contest leaderboard",
      description: "Get contest leaderboard entries.",
      method: "GET",
      path: "/leaderboard",
      query: GetContestLeaderboardQuerySchema.strict(),
      responses: {
        200: GetContestLeaderboardResponseSchema,
        404: MonkeyClientError,
      },
      metadata: meta({
        authenticationOptions: { isPublic: true },
        requireConfiguration: {
          path: "contests.enabled",
          invalidMessage: "Contest mode is not available at this time.",
        },
      }),
    },
    getUserRank: {
      summary: "get user contest rank",
      description: "Get the rank of the current user in the contest.",
      method: "GET",
      path: "/rank",
      query: GetContestUserRankQuerySchema.strict(),
      responses: {
        200: GetContestUserRankResponseSchema,
        404: MonkeyClientError,
      },
      metadata: meta({
        authenticationOptions: { acceptApeKeys: true },
        requireConfiguration: {
          path: "contests.enabled",
          invalidMessage: "Contest mode is not available at this time.",
        },
      }),
    },
    getUserResults: {
      summary: "get user contest results",
      description: "Get all results of the current user for a contest.",
      method: "GET",
      path: "/results",
      query: GetContestUserResultsQuerySchema.strict(),
      responses: {
        200: GetContestUserResultsResponseSchema,
        404: MonkeyClientError,
      },
      metadata: meta({
        authenticationOptions: { acceptApeKeys: true },
        requireConfiguration: {
          path: "contests.enabled",
          invalidMessage: "Contest mode is not available at this time.",
        },
      }),
    },
  },
  {
    pathPrefix: "/contests",
    strictStatusCodes: true,
    metadata: meta({
      openApiTags: "contests",
    }),
    commonResponses: CommonResponses,
  }
);
