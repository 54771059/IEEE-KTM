import Page from "./page";
import { GetContestUserResultsResponse } from "@monkeytype/contracts/contests";
import * as Skeleton from "../utils/skeleton";
import * as Notifications from "../elements/notifications";
import Ape from "../ape";
import {
  Contest,
  ContestLeaderboardEntry,
} from "@monkeytype/contracts/schemas/contests";
import { isAuthenticated } from "../firebase";
import * as ContestMode from "../states/contest-mode";

let activeContest: Contest | null = null;
let contestResults: ContestLeaderboardEntry[] = [];
let isLoading = false;

function resetContent(): void {
  $(".page.pageContests .activeContest").addClass("hidden");
  $(".page.pageContests .noActiveContest").addClass("hidden");
  $(".page.pageContests .contestResults").addClass("hidden");
  $(".page.pageContests .leaderboard").addClass("hidden");
  $(".page.pageContests .contestActions").addClass("hidden");
  $(".page.pageContests .error").addClass("hidden");
  $(".page.pageContests .loading").addClass("hidden");

  // Remove any contest instructions that might have been added
  $(".page.pageContests .contestInstructions").remove();

  // Reset join button state
  $("#joinContestButton").html('<i class="fas fa-play"></i> Join Contest');
  $("#joinContestButton").prop("disabled", false);
}

function showLoading(): void {
  resetContent();
  $(".page.pageContests .loading").removeClass("hidden");
}

function hideLoading(): void {
  $(".page.pageContests .loading").addClass("hidden");
}

function showError(message: string): void {
  resetContent();
  $(".page.pageContests .error").removeClass("hidden");
  $(".page.pageContests .error .message").text(message);
}

async function loadActiveContest(): Promise<void> {
  if (isLoading) return;

  isLoading = true;
  showLoading();

  try {
    const response = await Ape.contests.getActive();

    if (response.status === 200) {
      activeContest = response.body.data;
      updateContestDisplay();
    } else {
      showError(response.body.message);
    }
  } catch (error) {
    console.error("Failed to load active contest:", error);
    showError("Failed to load contest information");
  } finally {
    isLoading = false;
    hideLoading();
  }
}

async function loadLeaderboard(): Promise<void> {
  if (!activeContest) return;

  try {
    const response = await Ape.contests.getLeaderboard({
      query: {
        page: 0,
        pageSize: 50,
      },
    });

    if (response.status === 200) {
      contestResults = response.body.data.entries;
      updateLeaderboardDisplay();
    } else {
      Notifications.add(
        "Failed to load leaderboard: " + response.body.message,
        -1
      );
    }
  } catch (error) {
    console.error("Failed to load leaderboard:", error);
    Notifications.add("Failed to load leaderboard", -1);
  }
}

async function loadUserResults(): Promise<void> {
  if (!activeContest || !isAuthenticated()) return;

  try {
    const response = await Ape.contests.getUserResults({
      query: {
        page: 0,
        pageSize: 10,
      },
    });

    if (response.status === 200) {
      updateUserResultsDisplay(response.body.data);
    } else {
      console.error("Failed to load user results:", response.body.message);
    }
  } catch (error) {
    console.error("Failed to load user results:", error);
  }
}

function updateUserResultsDisplay(
  data: GetContestUserResultsResponse["data"]
): void {
  // For now, we can simply log the user results data
  // This function can be expanded later to show user's personal results
  console.log("User contest results:", data);
}

function updateContestDisplay(): void {
  resetContent();

  if (!activeContest) {
    $(".page.pageContests .noActiveContest").removeClass("hidden");
    return;
  }

  $(".page.pageContests .activeContest").removeClass("hidden");
  $(".page.pageContests .contestActions").removeClass("hidden");

  // Update contest info
  $(".page.pageContests .contestName").text(activeContest.name);
  $(".page.pageContests .contestDescription").text(
    activeContest.description ?? ""
  );

  // Contest is simplified - English only, unlimited attempts

  // Update contest status
  const now = Date.now();
  const startTime = activeContest.startTime;
  const endTime = activeContest.endTime;

  let statusText = "Active";
  let statusClass = "active";

  // If contest has start/end times, check them; otherwise use isActive
  if (startTime !== undefined && endTime !== undefined) {
    if (now < startTime) {
      statusText = "Upcoming";
      statusClass = "upcoming";
      const timeUntil = Math.ceil((startTime - now) / 1000);
      $(".page.pageContests .timeInfo").text(
        `Starts in: ${formatTime(timeUntil)}`
      );
    } else if (now > endTime) {
      statusText = "Ended";
      statusClass = "ended";
      $(".page.pageContests .timeInfo").text("Contest has ended");
    } else {
      const timeLeft = Math.ceil((endTime - now) / 1000);
      $(".page.pageContests .timeInfo").text(
        `Time left: ${formatTime(timeLeft)}`
      );
    }
  } else if (startTime !== undefined && now < startTime) {
    statusText = "Upcoming";
    statusClass = "upcoming";
    const timeUntil = Math.ceil((startTime - now) / 1000);
    $(".page.pageContests .timeInfo").text(
      `Starts in: ${formatTime(timeUntil)}`
    );
  } else if (endTime !== undefined && now > endTime) {
    statusText = "Ended";
    statusClass = "ended";
    $(".page.pageContests .timeInfo").text("Contest has ended");
  } else {
    // No time constraints or within time bounds - use isActive
    if (activeContest.isActive) {
      $(".page.pageContests .timeInfo").text("Open contest");
    } else {
      statusText = "Inactive";
      statusClass = "ended";
      $(".page.pageContests .timeInfo").text("Contest is inactive");
    }
  }

  setInterval(() => {
    const now = Date.now();
    const endTime = activeContest?.endTime;

    if (endTime !== undefined && now > endTime) {
      $(".page.pageContests .timeInfo").text("Contest has ended");
    } else if (endTime !== undefined) {
      const timeLeft = Math.ceil((endTime - now) / 1000);
      $(".page.pageContests .timeInfo").text(
        `Time left: ${formatTime(timeLeft)}`
      );
    }
    // If no endTime, keep current text (open contest or inactive)
  }, 1000); // Update time left every second

  $(".page.pageContests .contestStatus")
    .text(statusText)
    .removeClass("active upcoming ended")
    .addClass(statusClass);

  // Load leaderboard and user results
  void loadLeaderboard();
  if (isAuthenticated()) {
    void loadUserResults();
  }
}

function updateLeaderboardDisplay(): void {
  $(".page.pageContests .leaderboard").removeClass("hidden");

  const tbody = $(".page.pageContests .leaderboard tbody");
  tbody.empty();

  if (contestResults.length === 0) {
    tbody.append(`
      <tr>
        <td colspan="5" class="text-center">No results yet</td>
      </tr>
    `);
    return;
  }

  contestResults.forEach((entry, index) => {
    const row = `
      <tr>
        <td>${index + 1}</td>
        <td>${entry.name}</td>
        <td>${entry.wpm}</td>
        <td>${entry.acc.toFixed(2)}%</td>
        <td>${entry.totalAttempts}</td>
      </tr>
    `;
    tbody.append(row);
  });
}

function formatTime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m ${secs}s`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}

// Event handlers
$(".page.pageContests").on("click", "#joinContestButton", async () => {
  if (!isAuthenticated()) {
    Notifications.add("Please login to join the contest", 0);
    return;
  }

  if (!activeContest) {
    Notifications.add("No active contest", -1);
    return;
  }

  // Update button state
  $("#joinContestButton").html(
    '<i class="fas fa-spinner fa-spin"></i> Joining...'
  );
  $("#joinContestButton").prop("disabled", true);

  try {
    await ContestMode.joinContest();
    // Navigation to test page happens inside joinContest function
  } catch (error) {
    console.error("Failed to join contest:", error);
    // Reset button state on error
    $("#joinContestButton").html('<i class="fas fa-play"></i> Join Contest');
    $("#joinContestButton").prop("disabled", false);
  }
});

$(".page.pageContests").on("click", "#refreshContestButton", () => {
  void loadActiveContest();
});

$(".page.pageContests").on("click", "#viewResultsButton", () => {
  if (!isAuthenticated()) {
    Notifications.add("Please login to view your results", 0);
    return;
  }

  // TODO: Show user's contest results modal
  Notifications.add("User results view coming soon", 0);
});

// Navigation buttons
$(".page.pageContests").on("click", "#goToNormalTestButton", () => {
  window.location.href = "/";
});

export const page = new Page({
  id: "contests",
  element: $(".page.pageContests"),
  path: "/contests",
  afterHide: async (): Promise<void> => {
    Skeleton.remove("pageContests");
    resetContent();
  },
  beforeShow: async (): Promise<void> => {
    Skeleton.append("pageContests", "main");
    void loadActiveContest();
  },
});

$(() => {
  Skeleton.save("pageContests");
});
