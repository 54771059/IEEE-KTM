import { MonkeyRequest } from "../types";
import { MonkeyResponse } from "../../utils/monkey-response";
import MonkeyError from "../../utils/error";
import * as ContestDAL from "../../dal/contest";
import {
  GetActiveContestResponse,
  AddContestResultRequest,
  AddContestResultResponse,
  GetContestLeaderboardQuery,
  GetContestLeaderboardResponse,
  GetContestUserRankQuery,
  GetContestUserRankResponse,
  GetContestUserResultsQuery,
  GetContestUserResultsResponse,
} from "@monkeytype/contracts/contests";

export async function getActiveContest(
  _req: MonkeyRequest
): Promise<GetActiveContestResponse> {
  const contest = await ContestDAL.getActiveContest();

  return new MonkeyResponse("Contest retrieved", contest);
}

export async function addContestResult(
  req: MonkeyRequest<undefined, AddContestResultRequest>
): Promise<AddContestResultResponse> {
  const { uid } = req.ctx.decodedToken;
  const { result } = req.body;

  // Check if there's an active contest
  const activeContest = await ContestDAL.getActiveContest();
  if (!activeContest) {
    throw new MonkeyError(404, "No active contest found");
  }

  // Check if contest is still accepting submissions
  const isActive = await ContestDAL.isContestActive(activeContest._id);
  if (!isActive) {
    throw new MonkeyError(400, "Contest is not accepting submissions");
  }

  // Calculate CPM if not provided
  const resultWithCpm = {
    ...result,
    cpm: result.cpm !== undefined ? result.cpm : result.wpm * 5, // Standard conversion: 1 WPM = 5 CPM
  };

  // Add the result
  const { insertedId, attemptNumber } = await ContestDAL.addContestResult(
    uid,
    activeContest._id,
    resultWithCpm
  );

  // Get user's rank (optional, might be expensive for large contests)
  let rank: number | undefined;
  try {
    const userRank = await ContestDAL.getUserContestRank(
      uid,
      activeContest._id
    );
    rank = userRank?.rank;
  } catch (error) {
    // Rank calculation failed, but result was saved successfully
    console.warn("Failed to calculate user rank:", error);
  }

  return new MonkeyResponse("Contest result added", {
    insertedId: insertedId.toString(),
    attemptNumber,
    rank,
  });
}

export async function getContestLeaderboard(
  req: MonkeyRequest<GetContestLeaderboardQuery>
): Promise<GetContestLeaderboardResponse> {
  const { contestId, page = 0, pageSize = 50 } = req.query;

  const offset = page * pageSize;
  const { entries, count, contestInfo } =
    await ContestDAL.getContestLeaderboard(contestId, offset, pageSize);

  return new MonkeyResponse("Contest leaderboard retrieved", {
    count,
    pageSize,
    entries,
    contestInfo,
  });
}

export async function getUserContestRank(
  req: MonkeyRequest<GetContestUserRankQuery>
): Promise<GetContestUserRankResponse> {
  const { uid } = req.ctx.decodedToken;
  const { contestId } = req.query;

  const userRank = await ContestDAL.getUserContestRank(uid, contestId);

  return new MonkeyResponse("User contest rank retrieved", userRank);
}

export async function getUserContestResults(
  req: MonkeyRequest<GetContestUserResultsQuery>
): Promise<GetContestUserResultsResponse> {
  const { uid } = req.ctx.decodedToken;
  const { contestId, page = 0, pageSize = 50 } = req.query;

  const offset = page * pageSize;
  const userResults = await ContestDAL.getUserContestResults(
    uid,
    contestId,
    offset,
    pageSize
  );

  return new MonkeyResponse("User contest results retrieved", userResults);
}
