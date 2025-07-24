import {
  Collection,
  type DeleteResult,
  ObjectId,
  type UpdateResult,
  type InsertOneResult,
} from "mongodb";
import MonkeyError from "../utils/error";
import * as db from "../init/db";
import {
  Contest,
  ContestResult,
  ContestLeaderboardEntry,
} from "@monkeytype/contracts/schemas/contests";
import { User } from "@monkeytype/contracts/schemas/users";
import { replaceObjectId } from "../utils/misc";

type DBContest = Omit<Contest, "_id"> & { _id: ObjectId };
type DBContestResult = Omit<ContestResult, "_id"> & { _id: ObjectId };

export const getContestCollection = (): Collection<DBContest> =>
  db.collection<DBContest>("contests");

export const getContestResultsCollection = (): Collection<DBContestResult> =>
  db.collection<DBContestResult>("contestResults");

// Contest management functions
export async function getActiveContest(): Promise<Contest | null> {
  const now = Date.now();

  // Look for active contests
  const contests = await getContestCollection()
    .find({ isActive: true })
    .toArray();

  for (const contest of contests) {
    // If contest has both start and end times, check if we're within that period
    if (contest.startTime !== undefined && contest.endTime !== undefined) {
      if (now >= contest.startTime && now <= contest.endTime) {
        return replaceObjectId(contest);
      }
    }
    // If contest has only start time, check if it has started
    else if (contest.startTime !== undefined && contest.endTime === undefined) {
      if (now >= contest.startTime) {
        return replaceObjectId(contest);
      }
    }
    // If contest has only end time, check if it hasn't ended
    else if (contest.startTime === undefined && contest.endTime !== undefined) {
      if (now <= contest.endTime) {
        return replaceObjectId(contest);
      }
    }
    // If contest has no time restrictions, it's active
    else if (contest.startTime === undefined && contest.endTime === undefined) {
      return replaceObjectId(contest);
    }
  }

  return null;
}

export async function getContestById(
  contestId: string
): Promise<Contest | null> {
  const contest = await getContestCollection().findOne({
    _id: new ObjectId(contestId),
  });

  return contest ? replaceObjectId(contest) : null;
}

export async function createContest(
  contest: Omit<Contest, "_id">
): Promise<InsertOneResult<DBContest>> {
  const contestDoc: Omit<DBContest, "_id"> = {
    ...contest,
  };

  return await getContestCollection().insertOne(contestDoc as DBContest);
}

export async function updateContest(
  contestId: string,
  updates: Partial<Omit<Contest, "_id">>
): Promise<UpdateResult> {
  return await getContestCollection().updateOne(
    { _id: new ObjectId(contestId) },
    { $set: updates }
  );
}

export async function deleteContest(contestId: string): Promise<DeleteResult> {
  return await getContestCollection().deleteOne({
    _id: new ObjectId(contestId),
  });
}

// Contest result functions
export async function addContestResult(
  uid: string,
  contestId: string,
  result: Omit<ContestResult, "_id" | "contestId" | "attemptNumber">
): Promise<{ insertedId: ObjectId; attemptNumber: number }> {
  // Get the contest document
  const contest = await getContestCollection().findOne({
    _id: new ObjectId(contestId),
  });

  if (!contest) {
    throw new MonkeyError(404, "Contest not found");
  }

  // Initialize results object if it doesn't exist
  if (!contest.results) {
    contest.results = {};
  }

  // Initialize user's results array if it doesn't exist
  if (!contest.results[uid]) {
    contest.results[uid] = [];
  }

  // Calculate attempt number
  const attemptNumber = contest.results[uid].length + 1;

  // Create the result object (without _id, contestId, and uid since it's stored in the contest document indexed by uid)
  const contestResult = {
    ...result,
    attemptNumber,
  };

  // Add result to user's array in the contest document
  const updateResult = await getContestCollection().updateOne(
    { _id: new ObjectId(contestId) },
    {
      $push: { [`results.${uid}`]: contestResult },
    }
  );

  if (updateResult.modifiedCount === 0) {
    throw new MonkeyError(500, "Failed to add contest result");
  }

  // Generate a fake ObjectId for compatibility (since we're not storing in separate collection)
  const fakeInsertedId = new ObjectId();

  return {
    insertedId: fakeInsertedId,
    attemptNumber,
  };
}

export async function getUserContestResults(
  uid: string,
  contestId?: string,
  offset = 0,
  limit = 50
): Promise<{
  results: ContestResult[];
  bestResult?: ContestResult;
  totalAttempts: number;
  contestInfo: Contest;
}> {
  // Get contest info
  const contest =
    contestId !== undefined
      ? await getContestById(contestId)
      : await getActiveContest();

  if (!contest) {
    throw new MonkeyError(404, "Contest not found");
  }

  // Get user's results from the contest document
  const userResults = contest.results?.[uid] || [];

  // Convert to full ContestResult objects (add back _id and contestId)
  const allResults = userResults.map((result) => ({
    ...result,
    _id: new ObjectId().toString(), // Generate fake ID for compatibility
    contestId: contest._id,
  }));

  // Sort by timestamp (most recent first)
  allResults.sort((a, b) => b.timestamp - a.timestamp);

  // Get paginated results
  const paginatedResults = allResults.slice(offset, offset + limit);

  // Find best result based on WPM (primary) and accuracy (secondary)
  let bestResult: ContestResult | undefined;
  if (allResults.length > 0) {
    const bestResultData = allResults.reduce((best, current) => {
      if (
        current.wpm > best.wpm ||
        (current.wpm === best.wpm && current.acc > best.acc)
      ) {
        return current;
      }
      return best;
    });
    bestResult = bestResultData;
  }

  return {
    results: paginatedResults,
    bestResult,
    totalAttempts: allResults.length,
    contestInfo: contest,
  };
}

export async function getContestLeaderboard(
  contestId?: string,
  offset = 0,
  limit = 50
): Promise<{
  entries: ContestLeaderboardEntry[];
  count: number;
  contestInfo: Contest;
}> {
  // Get contest info
  const contest =
    contestId !== undefined
      ? await getContestById(contestId)
      : await getActiveContest();

  if (!contest) {
    throw new MonkeyError(404, "Contest not found");
  }

  const entries: ContestLeaderboardEntry[] = [];

  // Process each user's results from the contest document
  if (contest.results !== undefined && contest.results !== null) {
    for (const [uid, userResults] of Object.entries(contest.results)) {
      if (
        userResults === null ||
        userResults === undefined ||
        userResults.length === 0
      )
        continue;

      // Find best result for this user (for leaderboard display only - all attempts are still stored)
      const bestResult = userResults.reduce((best, current) => {
        if (
          current.wpm > best.wpm ||
          (current.wpm === best.wpm && current.acc > best.acc)
        ) {
          return current;
        }
        return best;
      });

      // Get user info from users collection
      const userInfo = await db.collection("users").findOne({ uid });

      // Type-safe user info access
      const userDoc = userInfo as Partial<User> | null;
      const userName = userDoc?.name ?? "Unknown";
      const discordId = userDoc?.discordId;
      const discordAvatar = userDoc?.discordAvatar;
      const isPremium = userDoc?.isPremium;

      const entry: ContestLeaderboardEntry = {
        wpm: bestResult.wpm,
        rawWpm: bestResult.rawWpm,
        cpm: bestResult.cpm !== undefined ? bestResult.cpm : bestResult.wpm * 5, // Fallback calculation if cpm not provided
        acc: bestResult.acc,
        consistency: bestResult.consistency,
        timestamp: bestResult.timestamp,
        uid,
        name: userName,
        discordId,
        discordAvatar,
        isPremium,
        bestAttempt: {
          wpm: bestResult.wpm,
          rawWpm: bestResult.rawWpm,
          cpm:
            bestResult.cpm !== undefined ? bestResult.cpm : bestResult.wpm * 5, // Fallback calculation if cpm not provided
          acc: bestResult.acc,
          consistency: bestResult.consistency,
          timestamp: bestResult.timestamp,
          testDuration: bestResult.testDuration,
          attemptNumber: bestResult.attemptNumber,
        },
        totalAttempts: userResults.length,
      };

      entries.push(entry);
    }
  }

  // Sort by WPM (descending), then by timestamp (ascending for ties)
  entries.sort((a, b) => {
    if (b.wpm !== a.wpm) return b.wpm - a.wpm;
    return a.timestamp - b.timestamp;
  });

  // Add ranks
  entries.forEach((entry, index) => {
    entry.rank = index + 1;
  });

  const totalCount = entries.length;
  const paginatedEntries = entries.slice(offset, offset + limit);

  return {
    entries: paginatedEntries,
    count: totalCount,
    contestInfo: contest,
  };
}

export async function getUserContestRank(
  uid: string,
  contestId?: string
): Promise<ContestLeaderboardEntry | null> {
  // Get contest info
  const contest =
    contestId !== undefined
      ? await getContestById(contestId)
      : await getActiveContest();

  if (!contest) {
    throw new MonkeyError(404, "Contest not found");
  }

  const actualContestId = contest._id;

  // Get user's best result
  const userResults = await getUserContestResults(uid, actualContestId);
  if (!userResults.bestResult) {
    return null;
  }

  // Get leaderboard to find rank
  const leaderboard = await getContestLeaderboard(actualContestId, 0, 10000);
  const userEntry = leaderboard.entries.find((entry) => entry.uid === uid);

  return userEntry || null;
}

// Utility functions
export async function isContestActive(contestId?: string): Promise<boolean> {
  const contest =
    contestId !== undefined
      ? await getContestById(contestId)
      : await getActiveContest();

  if (!contest) return false;

  const now = Date.now();

  // Check if contest is marked as active
  if (!contest.isActive) return false;

  // Check start time
  if (contest.startTime !== undefined && contest.startTime > now) return false;

  // Check end time
  if (contest.endTime !== undefined && contest.endTime < now) return false;

  return true;
}

export async function getUserAttemptCount(
  uid: string,
  contestId: string
): Promise<number> {
  const contest = await getContestById(contestId);
  if (
    contest === null ||
    contest.results === undefined ||
    contest.results[uid] === undefined
  ) {
    return 0;
  }
  return contest.results[uid].length;
}
