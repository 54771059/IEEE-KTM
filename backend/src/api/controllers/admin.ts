import { MonkeyResponse } from "../../utils/monkey-response";
import { buildMonkeyMail } from "../../utils/monkey-mail";
import * as UserDAL from "../../dal/user";
import * as ReportDAL from "../../dal/report";
import * as ContestDAL from "../../dal/contest";
import GeorgeQueue from "../../queues/george-queue";
import { sendForgotPasswordEmail as authSendForgotPasswordEmail } from "../../utils/auth";
import {
  AcceptReportsRequest,
  ClearStreakHourOffsetRequest,
  RejectReportsRequest,
  SendForgotPasswordEmailRequest,
  ToggleBanRequest,
  ToggleBanResponse,
  GetAllContestsResponse,
  CreateContestRequest,
  CreateContestResponse,
  UpdateContestRequest,
  UpdateContestResponse,
  GetContestStatsResponse,
  GetContestStatsRequest,
} from "@monkeytype/contracts/admin";
import MonkeyError, { getErrorMessage } from "../../utils/error";
import { Configuration } from "@monkeytype/contracts/schemas/configuration";
import { addImportantLog } from "../../dal/logs";
import { MonkeyRequest } from "../types";

export async function test(_req: MonkeyRequest): Promise<MonkeyResponse> {
  return new MonkeyResponse("OK", null);
}

export async function toggleBan(
  req: MonkeyRequest<undefined, ToggleBanRequest>
): Promise<ToggleBanResponse> {
  const { uid } = req.body;

  const user = await UserDAL.getPartialUser(uid, "toggle ban", [
    "banned",
    "discordId",
  ]);
  const discordId = user.discordId;
  const discordIdIsValid = discordId !== undefined && discordId !== "";

  await UserDAL.setBanned(uid, !user.banned);
  if (discordIdIsValid) await GeorgeQueue.userBanned(discordId, !user.banned);

  void addImportantLog("user_ban_toggled", { banned: !user.banned }, uid);

  return new MonkeyResponse(`Ban toggled`, {
    banned: !user.banned,
  });
}

export async function clearStreakHourOffset(
  req: MonkeyRequest<undefined, ClearStreakHourOffsetRequest>
): Promise<MonkeyResponse> {
  const { uid } = req.body;

  await UserDAL.clearStreakHourOffset(uid);
  void addImportantLog("admin_streak_hour_offset_cleared_by", {}, uid);

  return new MonkeyResponse("Streak hour offset cleared", null);
}

export async function acceptReports(
  req: MonkeyRequest<undefined, AcceptReportsRequest>
): Promise<MonkeyResponse> {
  await handleReports(
    req.body.reports.map((it) => ({ ...it })),
    true,
    req.ctx.configuration.users.inbox
  );
  return new MonkeyResponse("Reports removed and users notified.", null);
}

export async function rejectReports(
  req: MonkeyRequest<undefined, RejectReportsRequest>
): Promise<MonkeyResponse> {
  await handleReports(
    req.body.reports.map((it) => ({ ...it })),
    false,
    req.ctx.configuration.users.inbox
  );
  return new MonkeyResponse("Reports removed and users notified.", null);
}

export async function handleReports(
  reports: { reportId: string; reason?: string }[],
  accept: boolean,
  inboxConfig: Configuration["users"]["inbox"]
): Promise<void> {
  const reportIds = reports.map(({ reportId }) => reportId);

  const reportsFromDb = await ReportDAL.getReports(reportIds);
  const reportById = new Map(reportsFromDb.map((it) => [it.id, it]));

  const existingReportIds = new Set(reportsFromDb.map((report) => report.id));
  const missingReportIds = reportIds.filter(
    (reportId) => !existingReportIds.has(reportId)
  );

  if (missingReportIds.length > 0) {
    throw new MonkeyError(
      404,
      `Reports not found for some IDs ${missingReportIds.join(",")}`
    );
  }

  await ReportDAL.deleteReports(reportIds);

  for (const { reportId, reason } of reports) {
    try {
      const report = reportById.get(reportId);
      if (!report) {
        throw new MonkeyError(404, `Report not found for ID: ${reportId}`);
      }

      let mailBody = "";
      if (accept) {
        mailBody = `Your report regarding ${report.type} ${
          report.contentId
        } (${report.reason.toLowerCase()}) has been approved. Thank you.`;
      } else {
        mailBody = `Sorry, but your report regarding ${report.type} ${
          report.contentId
        } (${report.reason.toLowerCase()}) has been denied. ${
          reason !== undefined ? `\nReason: ${reason}` : ""
        }`;
      }

      const mailSubject = accept ? "Report approved" : "Report denied";
      const mail = buildMonkeyMail({
        subject: mailSubject,
        body: mailBody,
      });
      await UserDAL.addToInbox(report.uid, [mail], inboxConfig);
    } catch (e) {
      if (e instanceof MonkeyError) {
        throw new MonkeyError(e.status, e.message);
      } else {
        throw new MonkeyError(
          500,
          "Error handling reports: " + getErrorMessage(e)
        );
      }
    }
  }
}

export async function sendForgotPasswordEmail(
  req: MonkeyRequest<undefined, SendForgotPasswordEmailRequest>
): Promise<MonkeyResponse> {
  const { email } = req.body;
  await authSendForgotPasswordEmail(email);
  return new MonkeyResponse("Password reset request email sent.", null);
}

// Contest management functions
export async function getAllContests(
  _req: MonkeyRequest
): Promise<GetAllContestsResponse> {
  console.log("DEBUG: getAllContests controller called");
  const contests = await ContestDAL.getAllContests();
  console.log("DEBUG: Retrieved contests from DAL:", {
    count: contests.length,
    contests: contests.map((c) => ({
      id: c._id,
      name: c.name,
      isActive: c.isActive,
    })),
  });
  return new MonkeyResponse("All contests retrieved", contests);
}

export async function createContest(
  req: MonkeyRequest<undefined, CreateContestRequest>
): Promise<CreateContestResponse> {
  const contestData = req.body;

  const result = await ContestDAL.createContest(contestData);

  void addImportantLog("contest_created", {
    contestId: result.insertedId.toString(),
  });

  return new MonkeyResponse("Contest created successfully", {
    contestId: result.insertedId.toString(),
  });
}

export async function updateContest(
  req: MonkeyRequest<undefined, UpdateContestRequest, { contestId: string }>
): Promise<UpdateContestResponse> {
  const { contestId } = req.params;
  const updates = req.body;

  const result = await ContestDAL.updateContest(contestId, updates);

  if (result.matchedCount === 0) {
    throw new MonkeyError(404, "Contest not found");
  }

  void addImportantLog("contest_updated", { contestId });

  return new MonkeyResponse("Contest updated successfully", null);
}

export async function deleteContest(
  req: MonkeyRequest<undefined, undefined, { contestId: string }>
): Promise<MonkeyResponse<null>> {
  const { contestId } = req.params;

  const result = await ContestDAL.deleteContest(contestId);

  if (result.deletedCount === 0) {
    throw new MonkeyError(404, "Contest not found");
  }

  void addImportantLog("contest_deleted", { contestId });

  return new MonkeyResponse("Contest deleted successfully", null);
}

export async function getContestStats(
  req: MonkeyRequest<GetContestStatsRequest>
): Promise<GetContestStatsResponse> {
  const { contestId } = req.query;

  const stats = await ContestDAL.getContestStats(contestId);

  return new MonkeyResponse("Contest statistics retrieved", stats);
}

export async function deleteContestAttempt(
  req: MonkeyRequest<
    undefined,
    undefined,
    { contestId: string; uid: string; attemptNumber: string }
  >
): Promise<MonkeyResponse> {
  const { contestId, uid, attemptNumber } = req.params;

  await ContestDAL.deleteContestAttempt(
    contestId,
    uid,
    parseInt(attemptNumber)
  );

  void addImportantLog("contest_attempt_deleted", {
    contestId,
    uid,
    attemptNumber: parseInt(attemptNumber),
  });

  return new MonkeyResponse("Contest attempt deleted successfully", null);
}

export async function deleteAllUserContestAttempts(
  req: MonkeyRequest<undefined, undefined, { contestId: string; uid: string }>
): Promise<MonkeyResponse> {
  const { contestId, uid } = req.params;

  await ContestDAL.deleteAllUserContestAttempts(contestId, uid);

  void addImportantLog("all_user_contest_attempts_deleted", {
    contestId,
    uid,
  });

  return new MonkeyResponse(
    "All user contest attempts deleted successfully",
    null
  );
}
