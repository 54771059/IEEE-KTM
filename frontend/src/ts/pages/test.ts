import * as TestStats from "../test/test-stats";
import * as ManualRestart from "../test/manual-restart-tracker";
import * as TestLogic from "../test/test-logic";
import * as Funbox from "../test/funbox/funbox";
import Page from "./page";
import { updateFooterAndVerticalAds } from "../controllers/ad-controller";
import * as ModesNotice from "../elements/modes-notice";
import * as Keymap from "../elements/keymap";
import * as TestConfig from "../test/test-config";
import * as ScrollToTop from "../elements/scroll-to-top";
import * as ContestMode from "../states/contest-mode";
import * as Notifications from "../elements/notifications";

export const page = new Page({
  id: "test",
  element: $(".page.pageTest"),
  path: "/",
  beforeHide: async (): Promise<void> => {
    $("#wordsInput").trigger("focusout");
    // Note: Contest mode exit is handled by route controller when navigating to other pages
    // Don't exit contest mode here to allow persistence on refresh
  },
  afterHide: async (): Promise<void> => {
    ManualRestart.set();
    TestLogic.restart({
      noAnim: true,
    });
    void Funbox.clear();
    void ModesNotice.update();
    updateFooterAndVerticalAds(true);
  },
  beforeShow: async (): Promise<void> => {
    updateFooterAndVerticalAds(false);
    TestStats.resetIncomplete();
    ManualRestart.set();

    // Initialize contest mode from storage
    ContestMode.initializeContestMode();

    // Check if we're in contest mode (either from storage or URL parameter)
    const urlParams = new URLSearchParams(window.location.search);
    const contestParam = urlParams.get("contest");

    if (ContestMode.isContestMode() || contestParam === "true") {
      try {
        // If not already in contest mode, join the contest
        if (!ContestMode.isContestMode()) {
          await ContestMode.joinContest();
        }

        // Show contest mode UI
        showContestModeIndicator();

        // Apply contest options if we have them
        const activeContest = ContestMode.getActiveContest();
        if (activeContest) {
          ContestMode.applyContestOptions(activeContest.options);
        }

        // Clean up URL parameters
        const newUrl = window.location.pathname;
        window.history.replaceState(null, "", newUrl);
      } catch (error) {
        console.error("Failed to enable contest mode:", error);
        Notifications.add(
          "Failed to enable contest mode. Redirecting to home.",
          -1
        );
        ContestMode.exitContestMode();
        setTimeout(() => {
          window.location.href = "/";
        }, 2000);
        return;
      }
    }

    TestLogic.restart({
      noAnim: true,
    });
    void TestConfig.instantUpdate();
    void Keymap.refresh();
    ScrollToTop.hide();
  },
});

function showContestModeIndicator(): void {
  // Hide test config in contest mode (options are pre-defined by contest)
  const testConfig = $("#testConfig");
  testConfig.addClass("hidden");

  // Also hide mobile test config button
  const mobileTestConfigButton = $("#mobileTestConfigButton");
  mobileTestConfigButton.addClass("hidden");

  // Hide the regular testModesNotice and show contest name instead
  const testModesNotice = $("#testModesNotice");
  testModesNotice.addClass("hidden");

  // Create contest name element if it doesn't exist
  let contestName = $("#contestName");
  if (contestName.length === 0) {
    contestName = $(`<div id="contestName" class="contest-name"></div>`);
    testModesNotice.after(contestName);
  }

  // Display contest name
  const activeContest = ContestMode.getActiveContest();
  if (activeContest) {
    contestName.html(`
      <i class="fas fa-trophy"></i>
      ${activeContest.name}
    `);
    contestName.removeClass("hidden");
  }
}
