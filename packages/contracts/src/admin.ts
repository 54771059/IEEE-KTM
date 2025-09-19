import { initContract } from "@ts-rest/core";
import { z } from "zod";
import {
  CommonResponses,
  meta,
  MonkeyResponseSchema,
  responseWithData,
} from "./schemas/api";
import { IdSchema } from "./schemas/util";
import { ContestSchema } from "./schemas/contests";

export const ToggleBanRequestSchema = z
  .object({
    uid: IdSchema,
  })
  .strict();
export type ToggleBanRequest = z.infer<typeof ToggleBanRequestSchema>;

export const ClearStreakHourOffsetRequestSchema = z
  .object({
    uid: IdSchema,
  })
  .strict();
export type ClearStreakHourOffsetRequest = z.infer<
  typeof ClearStreakHourOffsetRequestSchema
>;

export const ToggleBanResponseSchema = responseWithData(
  z.object({
    banned: z.boolean(),
  })
).strict();
export type ToggleBanResponse = z.infer<typeof ToggleBanResponseSchema>;

export const AcceptReportsRequestSchema = z
  .object({
    reports: z.array(z.object({ reportId: z.string() }).strict()).nonempty(),
  })
  .strict();
export type AcceptReportsRequest = z.infer<typeof AcceptReportsRequestSchema>;

export const RejectReportsRequestSchema = z
  .object({
    reports: z
      .array(
        z
          .object({ reportId: z.string(), reason: z.string().optional() })
          .strict()
      )
      .nonempty(),
  })
  .strict();
export type RejectReportsRequest = z.infer<typeof RejectReportsRequestSchema>;

export const SendForgotPasswordEmailRequestSchema = z
  .object({
    email: z.string().email(),
  })
  .strict();
export type SendForgotPasswordEmailRequest = z.infer<
  typeof SendForgotPasswordEmailRequestSchema
>;

// Contest management schemas
export const GetAllContestsResponseSchema = responseWithData(
  z.array(ContestSchema)
).strict();
export type GetAllContestsResponse = z.infer<
  typeof GetAllContestsResponseSchema
>;

export const CreateContestRequestSchema = z
  .object({
    name: z.string().min(1),
    description: z.string().optional(),
    startTime: z.number().int().nonnegative().optional(),
    endTime: z.number().int().nonnegative().optional(),
    isActive: z.boolean(),
    options: z.object({
      mode: z.enum(["time", "words", "quote", "zen", "custom"]),
      mode2: z.string(),
      punctuation: z.boolean(),
      numbers: z.boolean(),
    }),
  })
  .strict();
export type CreateContestRequest = z.infer<typeof CreateContestRequestSchema>;

export const CreateContestResponseSchema = responseWithData(
  z.object({
    contestId: IdSchema,
  })
).strict();
export type CreateContestResponse = z.infer<typeof CreateContestResponseSchema>;

export const UpdateContestRequestSchema = z
  .object({
    name: z.string().min(1).optional(),
    description: z.string().optional(),
    startTime: z.number().int().nonnegative().optional(),
    endTime: z.number().int().nonnegative().optional(),
    isActive: z.boolean().optional(),
    options: z
      .object({
        mode: z.enum(["time", "words", "quote", "zen", "custom"]),
        mode2: z.string(),
        punctuation: z.boolean(),
        numbers: z.boolean(),
      })
      .optional(),
  })
  .strict();
export type UpdateContestRequest = z.infer<typeof UpdateContestRequestSchema>;

export const UpdateContestResponseSchema = responseWithData(z.null()).strict();
export type UpdateContestResponse = z.infer<typeof UpdateContestResponseSchema>;

export const DeleteContestRequestSchema = z
  .object({
    contestId: IdSchema,
  })
  .strict();
export type DeleteContestRequest = z.infer<typeof DeleteContestRequestSchema>;

export const GetContestStatsRequestSchema = z
  .object({
    contestId: IdSchema.optional(),
  })
  .strict();
export type GetContestStatsRequest = z.infer<
  typeof GetContestStatsRequestSchema
>;

export const GetContestStatsResponseSchema = responseWithData(
  z.object({
    participantCount: z.number().int().nonnegative(),
    totalAttempts: z.number().int().nonnegative(),
    avgWpm: z.number().nonnegative(),
    avgAccuracy: z.number().nonnegative(),
    highestWpm: z.number().nonnegative(),
    bestAccuracy: z.number().nonnegative(),
  })
).strict();
export type GetContestStatsResponse = z.infer<
  typeof GetContestStatsResponseSchema
>;

// Contest attempt deletion schemas
export const DeleteContestAttemptRequestSchema = z
  .object({
    contestId: IdSchema,
    uid: IdSchema,
    attemptNumber: z.number().int().positive(),
  })
  .strict();
export type DeleteContestAttemptRequest = z.infer<
  typeof DeleteContestAttemptRequestSchema
>;

export const DeleteAllUserContestAttemptsRequestSchema = z
  .object({
    contestId: IdSchema,
    uid: IdSchema,
  })
  .strict();
export type DeleteAllUserContestAttemptsRequest = z.infer<
  typeof DeleteAllUserContestAttemptsRequestSchema
>;

const c = initContract();
export const adminContract = c.router(
  {
    test: {
      summary: "test permission",
      description: "Check for admin permission for the current user",
      method: "GET",
      path: "",
      responses: {
        200: MonkeyResponseSchema,
      },
    },
    toggleBan: {
      summary: "toggle user ban",
      description: "Ban an unbanned user or unban a banned user.",
      method: "POST",
      path: "/toggleBan",
      body: ToggleBanRequestSchema,
      responses: {
        200: ToggleBanResponseSchema,
      },
    },
    clearStreakHourOffset: {
      summary: "clear streak hour offset",
      description: "Clear the streak hour offset for a user",
      method: "POST",
      path: "/clearStreakHourOffset",
      body: ClearStreakHourOffsetRequestSchema,
      responses: {
        200: MonkeyResponseSchema,
      },
    },
    acceptReports: {
      summary: "accept reports",
      description: "Accept one or many reports",
      method: "POST",
      path: "/report/accept",
      body: AcceptReportsRequestSchema,
      responses: {
        200: MonkeyResponseSchema,
      },
    },
    rejectReports: {
      summary: "reject reports",
      description: "Reject one or many reports",
      method: "POST",
      path: "/report/reject",
      body: RejectReportsRequestSchema,
      responses: {
        200: MonkeyResponseSchema,
      },
    },
    sendForgotPasswordEmail: {
      summary: "send forgot password email",
      description: "Send a forgot password email to the given user email",
      method: "POST",
      path: "/sendForgotPasswordEmail",
      body: SendForgotPasswordEmailRequestSchema,
      responses: {
        200: MonkeyResponseSchema,
      },
    },
    getAllContests: {
      summary: "get all contests",
      description: "Get all contests for admin management",
      method: "GET",
      path: "/contests",
      responses: {
        200: GetAllContestsResponseSchema,
      },
    },
    createContest: {
      summary: "create contest",
      description: "Create a new contest",
      method: "POST",
      path: "/contests",
      body: CreateContestRequestSchema,
      responses: {
        200: CreateContestResponseSchema,
      },
    },
    updateContest: {
      summary: "update contest",
      description: "Update an existing contest",
      method: "PATCH",
      path: "/contests/:contestId",
      pathParams: z.object({
        contestId: IdSchema,
      }),
      body: UpdateContestRequestSchema,
      responses: {
        200: UpdateContestResponseSchema,
      },
    },
    deleteContest: {
      summary: "delete contest",
      description: "Delete a contest",
      method: "DELETE",
      path: "/contests/:contestId",
      pathParams: z.object({
        contestId: IdSchema,
      }),
      body: c.noBody(),
      responses: {
        200: responseWithData(z.null()).strict(),
      },
    },
    getContestStats: {
      summary: "get contest statistics",
      description: "Get statistics for a specific contest or overall stats",
      method: "GET",
      path: "/contests/stats",
      query: GetContestStatsRequestSchema,
      responses: {
        200: GetContestStatsResponseSchema,
      },
    },
    deleteContestAttempt: {
      summary: "delete contest attempt",
      description: "Delete a specific attempt from a user in a contest",
      method: "DELETE",
      path: "/contests/:contestId/users/:uid/attempts/:attemptNumber",
      pathParams: z.object({
        contestId: IdSchema,
        uid: IdSchema,
        attemptNumber: z.string(),
      }),
      body: c.noBody(),
      responses: {
        200: responseWithData(z.null()).strict(),
      },
    },
    deleteAllUserContestAttempts: {
      summary: "delete all user contest attempts",
      description: "Delete all attempts from a user in a contest",
      method: "DELETE",
      path: "/contests/:contestId/users/:uid/attempts",
      pathParams: z.object({
        contestId: IdSchema,
        uid: IdSchema,
      }),
      body: c.noBody(),
      responses: {
        200: responseWithData(z.null()).strict(),
      },
    },
  },
  {
    pathPrefix: "/admin",
    strictStatusCodes: true,
    metadata: meta({
      openApiTags: "admin",
      authenticationOptions: { noCache: true, isPublicOnDev: true },
      rateLimit: "adminLimit",
      requirePermission: "admin",
      requireConfiguration: {
        path: "admin.endpointsEnabled",
        invalidMessage: "Admin endpoints are currently disabled.",
      },
    }),

    commonResponses: CommonResponses,
  }
);
