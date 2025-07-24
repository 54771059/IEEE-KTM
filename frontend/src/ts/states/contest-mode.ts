import { Contest } from "@monkeytype/contracts/schemas/contests";
import { CompletedEvent } from "@monkeytype/contracts/schemas/results";
import * as Notifications from "../elements/notifications";
import * as Config from "../config";
import Ape from "../ape";

let contestMode = false;
let activeContest: Contest | null = null;

// Persistent contest mode storage
const CONTEST_MODE_KEY = "contestModeActive";
const ACTIVE_CONTEST_KEY = "activeContestData";

export function isContestMode(): boolean {
  return contestMode;
}

export function getActiveContest(): Contest | null {
  return activeContest;
}

// Initialize contest mode from localStorage on page load
export function initializeContestMode(): void {
  const storedContestMode = localStorage.getItem(CONTEST_MODE_KEY);
  const storedContestData = localStorage.getItem(ACTIVE_CONTEST_KEY);

  if (storedContestMode === "true" && storedContestData !== null) {
    try {
      activeContest = JSON.parse(storedContestData) as Contest;
      contestMode = true;
      console.log("Restored contest mode from storage:", activeContest?.name);
    } catch (error) {
      console.error("Failed to restore contest mode:", error);
      clearContestModeStorage();
    }
  }
}

// Clear contest mode from localStorage
function clearContestModeStorage(): void {
  localStorage.removeItem(CONTEST_MODE_KEY);
  localStorage.removeItem(ACTIVE_CONTEST_KEY);
}

// Save contest mode to localStorage
function saveContestModeStorage(): void {
  if (contestMode && activeContest) {
    localStorage.setItem(CONTEST_MODE_KEY, "true");
    localStorage.setItem(ACTIVE_CONTEST_KEY, JSON.stringify(activeContest));
  } else {
    clearContestModeStorage();
  }
}

export function setContestMode(enabled: boolean): void {
  contestMode = enabled;
  saveContestModeStorage();
  updateUI();
}

export async function joinContest(): Promise<void> {
  try {
    const response = await Ape.contests.getActive();

    if (response.status === 200 && response.body.data) {
      activeContest = response.body.data;
      contestMode = true;
      saveContestModeStorage();

      console.log("Contest joined:", activeContest);
      console.log("Contest options:", activeContest.options);

      // Apply contest options to test configuration
      applyContestOptions(activeContest.options);

      Notifications.add(`Joined contest: ${activeContest.name}`, 1);

      // Navigate to test page in contest mode with contest parameter
      window.location.href = "/?contest=true";
    } else {
      Notifications.add("No active contest found", -1);
      throw new Error("No active contest found");
    }
  } catch (error) {
    console.error("Failed to join contest:", error);
    Notifications.add("Failed to join contest", -1);
    throw error;
  }
}

export function exitContestMode(): void {
  contestMode = false;
  activeContest = null;
  clearContestModeStorage();
  updateUI();
  Notifications.add("Contest mode disabled", 0);
}

export function enableContestModeForContestPage(): void {
  // This function is specifically for the contest page to enable contest mode
  // It should only be called from within the contest page context
  contestMode = true;
  if (activeContest) {
    Notifications.add(`Contest mode enabled: ${activeContest.name}`, 1);
  }
}

export function setActiveContest(contest: Contest): void {
  activeContest = contest;
}

function applyContestOptions(options: Contest["options"]): void {
  console.log("Applying contest options:", options);

  try {
    // Apply mode (time or words)
    if (options.mode) {
      console.log("Setting mode to:", options.mode);
      Config.setMode(options.mode, true); // nosave = true to prevent saving to localStorage
    }

    // Apply mode2 (time duration or word count)
    if (options.mode2) {
      console.log("Setting mode2 to:", options.mode2);
      if (options.mode === "time") {
        Config.setTimeConfig(parseInt(options.mode2), true);
      } else if (options.mode === "words") {
        Config.setWordCount(parseInt(options.mode2), true);
      }
    }

    // Apply punctuation
    if (typeof options.punctuation === "boolean") {
      console.log("Setting punctuation to:", options.punctuation);
      Config.setPunctuation(options.punctuation, true);
    }

    // Apply numbers
    if (typeof options.numbers === "boolean") {
      console.log("Setting numbers to:", options.numbers);
      Config.setNumbers(options.numbers, true);
    }

    console.log("Contest options applied successfully");
  } catch (error) {
    console.error("Error applying contest options:", error);
  }
}

// Export for use in test page
export { applyContestOptions };

function updateUI(): void {
  // Contest mode UI elements should only appear on the contest page
  // Homepage/practice mode should have no traces of contest mode

  // Remove any existing contest info from homepage
  $("#contestInfo").remove();

  // Restore test config and hide contest name when exiting contest mode
  if (!contestMode) {
    // Show test config again
    const testConfig = $("#testConfig");
    testConfig.removeClass("hidden");

    // Show mobile test config button again
    const mobileTestConfigButton = $("#mobileTestConfigButton");
    mobileTestConfigButton.removeClass("hidden");

    // Hide contest name and show regular testModesNotice
    const contestName = $("#contestName");
    contestName.addClass("hidden");
    const testModesNotice = $("#testModesNotice");
    testModesNotice.removeClass("hidden");
  }
}

export async function submitContestResult(
  result: CompletedEvent
): Promise<boolean> {
  if (!contestMode || !activeContest) {
    Notifications.add("Not in contest mode", -1);
    return false;
  }

  try {
    const contestResult = {
      result: {
        wpm: result.wpm,
        rawWpm: result.rawWpm,
        cpm: result.cpm, // Include cpm if available
        acc: result.acc,
        consistency: result.consistency,
        testDuration: result.testDuration,
        timestamp: Date.now(),
        // Optional fields that might be included for analysis
        restartCount: result.restartCount,
        incompleteTestSeconds: result.incompleteTestSeconds,
        afkDuration: result.afkDuration,
        bailedOut: result.bailedOut,
      },
    };

    const response = await Ape.contests.addResult({
      body: contestResult,
    });

    if (response.status === 200) {
      const data = response.body.data;
      Notifications.add(
        `Contest result submitted! Attempt #${data.attemptNumber}`
      );
      return true;
    } else {
      Notifications.add(
        `Failed to submit contest result: ${response.body.message}`,
        -1
      );
      return false;
    }
  } catch (error) {
    console.error("Failed to submit contest result:", error);
    Notifications.add("Failed to submit contest result", -1);
    return false;
  }
}
