import { contestsContract } from "@monkeytype/contracts/contests";
import { initServer } from "@ts-rest/express";
import * as ContestController from "../controllers/contest";
import { callController } from "../ts-rest-adapter";

const s = initServer();
export default s.router(contestsContract, {
  getActive: {
    handler: async (r) => callController(ContestController.getActiveContest)(r),
  },
  addResult: {
    handler: async (r) => callController(ContestController.addContestResult)(r),
  },
  getLeaderboard: {
    handler: async (r) =>
      callController(ContestController.getContestLeaderboard)(r),
  },
  getUserRank: {
    handler: async (r) =>
      callController(ContestController.getUserContestRank)(r),
  },
  getUserResults: {
    handler: async (r) =>
      callController(ContestController.getUserContestResults)(r),
  },
});
