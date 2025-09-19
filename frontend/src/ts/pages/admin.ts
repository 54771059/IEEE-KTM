import Page from "./page";
import Ape from "../ape";
import * as Skeleton from "../utils/skeleton";
import {
  CreateContestRequest,
  UpdateContestRequest,
} from "@monkeytype/contracts/admin";
import {
  ContestLeaderboardEntry,
  ContestResult,
} from "@monkeytype/contracts/schemas/contests";

type Contest = {
  _id: string;
  name: string;
  description?: string;
  startTime?: number;
  endTime?: number;
  isActive: boolean;
  options: {
    mode: "time" | "words" | "quote" | "zen" | "custom";
    mode2: string;
    punctuation: boolean;
    numbers: boolean;
  };
  results?: Record<string, unknown[]>;
};

type ContestWithComputedFields = Contest & {
  status: string;
  currentParticipants: number;
  duration: number;
};

type Participant = {
  uid: string;
  name: string;
  wpm: number;
  rawWpm: number;
  acc: number;
  consistency: number;
  rank?: number;
};

type ContestStats = {
  participantCount: number;
  totalAttempts: number;
  avgWpm: number;
  avgAccuracy: number;
  highestWpm: number;
  bestAccuracy: number;
};

function computeContestStatus(contest: Contest): string {
  const now = Date.now();

  if (!contest.isActive) {
    return "inactive";
  }

  if (contest.startTime !== undefined && contest.endTime !== undefined) {
    if (now < contest.startTime) return "upcoming";
    if (now > contest.endTime) return "ended";
    return "active";
  } else if (contest.startTime !== undefined) {
    if (now < contest.startTime) return "upcoming";
    return "active";
  } else if (contest.endTime !== undefined) {
    if (now > contest.endTime) return "ended";
    return "active";
  }

  return "active";
}

function computeCurrentParticipants(contest: Contest): number {
  if (!contest.results) return 0;
  return Object.keys(contest.results).filter(
    (uid) =>
      contest.results?.[uid] !== undefined && contest.results[uid].length > 0
  ).length;
}

function computeDuration(contest: Contest): number {
  if (contest.startTime !== undefined && contest.endTime !== undefined) {
    return Math.round((contest.endTime - contest.startTime) / (1000 * 60)); // in minutes
  }
  return 0;
}

function enhanceContest(contest: Contest): ContestWithComputedFields {
  return {
    ...contest,
    status: computeContestStatus(contest),
    currentParticipants: computeCurrentParticipants(contest),
    duration: computeDuration(contest),
  };
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

class AdminPage {
  private contests: ContestWithComputedFields[] = [];
  private participants: Participant[] = [];
  private leaderboardEntries: ContestLeaderboardEntry[] = [];
  private expandedUserAttempts: Record<string, ContestResult[]> = {};
  private searchTerm = "";
  private statusFilter = "all";
  private selectedContestId = "all";
  private selectedLeaderboardContestId = "";
  public countdownInterval: NodeJS.Timeout | null = null;

  private modal = {
    element: null as HTMLElement | null,
    isVisible: false,
    isEdit: false,
    currentContest: null as ContestWithComputedFields | null,
  };

  private async loadContests(): Promise<void> {
    try {
      console.log("DEBUG: Starting to load contests...");
      const response = await Ape.admin.getAllContests();
      console.log("DEBUG: Raw getAllContests response:", response);
      console.log("DEBUG: Response type:", typeof response);
      console.log(
        "DEBUG: Response keys:",
        response !== null ? Object.keys(response) : []
      );

      // Type guard to check if response is successful
      if (
        response !== null &&
        typeof response === "object" &&
        "status" in response &&
        response.status === 200
      ) {
        console.log("DEBUG: Response status is 200, extracting data...");
        const contests: Contest[] = (
          response as unknown as { body: { data: Contest[] } }
        ).body.data;
        console.log("DEBUG: Extracted contests:", contests);
        console.log("DEBUG: Number of contests:", contests?.length || 0);
        this.contests = contests.map(enhanceContest);
        console.log("DEBUG: Enhanced contests:", this.contests);
        this.renderContests();
        this.updateContestSelector();
      } else {
        const status = (response as unknown as { status?: number })?.status;
        console.log("DEBUG: Response status is not 200, status:", status);
        throw new Error(
          `HTTP error! status: ${status !== undefined ? status : "unknown"}`
        );
      }
    } catch (error) {
      console.error("DEBUG: Failed to load contests:", error);
      console.error("DEBUG: Error details:", {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      // Fallback to empty state
      this.contests = [];
      this.renderContests();
    }
  }

  private async loadContestStats(
    contestId?: string
  ): Promise<ContestStats | null> {
    try {
      const response = await Ape.admin.getContestStats({
        query:
          contestId !== undefined && contestId.length > 0 ? { contestId } : {},
      });
      // Type guard to check if response is successful
      if (
        response !== null &&
        typeof response === "object" &&
        "status" in response &&
        response.status === 200
      ) {
        return (response as unknown as { body: { data: ContestStats } }).body
          .data;
      } else {
        const status = (response as unknown as { status?: number })?.status;
        throw new Error(
          `HTTP error! status: ${status !== undefined ? status : "unknown"}`
        );
      }
    } catch (error) {
      console.error("Failed to load contest stats:", error);
      return null;
    }
  }

  private async loadContestLeaderboard(
    contestId: string
  ): Promise<ContestLeaderboardEntry[]> {
    try {
      const response = await Ape.contests.getLeaderboard({
        query: { contestId, page: 0, pageSize: 50 },
      });
      // Type guard to check if response is successful
      if (
        response !== null &&
        typeof response === "object" &&
        "status" in response &&
        response.status === 200
      ) {
        const data = (
          response as unknown as {
            body: { data: { entries: ContestLeaderboardEntry[] } };
          }
        ).body.data;
        return data.entries;
      } else {
        const status = (response as unknown as { status?: number })?.status;
        throw new Error(
          `HTTP error! status: ${status !== undefined ? status : "unknown"}`
        );
      }
    } catch (error) {
      console.error("Failed to load contest leaderboard:", error);
      return [];
    }
  }

  private async loadUserContestResults(
    contestId: string,
    uid: string
  ): Promise<ContestResult[]> {
    try {
      // Since there's no direct admin endpoint to get another user's contest results,
      // we'll make a workaround by getting contest data and extracting user results
      // In a real implementation, you'd want a dedicated admin endpoint for this

      // For now, we'll simulate attempts based on the best attempt data
      // This is a temporary solution until a proper admin endpoint is available
      const entry = this.leaderboardEntries.find((e) => e.uid === uid);
      if (!entry) return [];

      // Create a simulated set of attempts based on the best attempt
      // In reality, you'd get this from an admin endpoint
      const attempts: ContestResult[] = [];

      // Generate some example attempts for demonstration
      for (let i = 1; i <= entry.totalAttempts; i++) {
        const isBest = i === entry.bestAttempt.attemptNumber;
        const wpmVariation = isBest ? 0 : (Math.random() - 0.5) * 20;
        const accVariation = isBest ? 0 : (Math.random() - 0.5) * 10;

        attempts.push({
          _id: `${uid}_${i}`,
          wpm: Math.max(30, isBest ? entry.wpm : entry.wpm + wpmVariation),
          rawWpm: Math.max(
            30,
            isBest ? entry.rawWpm : entry.rawWpm + wpmVariation
          ),
          cpm: isBest
            ? entry.bestAttempt.cpm ?? entry.wpm * 5
            : (entry.wpm + wpmVariation) * 5,
          acc: Math.max(
            50,
            Math.min(100, isBest ? entry.acc : entry.acc + accVariation)
          ),
          consistency: Math.max(
            0,
            Math.min(
              100,
              isBest
                ? entry.consistency
                : entry.consistency + (Math.random() - 0.5) * 20
            )
          ),
          timestamp: isBest
            ? entry.bestAttempt.timestamp
            : entry.bestAttempt.timestamp - (entry.totalAttempts - i) * 3600000,
          testDuration: entry.bestAttempt.testDuration,
          contestId: contestId,
          attemptNumber: i,
        });
      }

      // Sort by attempt number
      attempts.sort((a, b) => a.attemptNumber - b.attemptNumber);

      return attempts;
    } catch (error) {
      console.error("Failed to load user contest results:", error);
      return [];
    }
  }

  private async createContest(
    contestData: CreateContestRequest
  ): Promise<void> {
    try {
      const response = await Ape.admin.createContest({
        body: contestData,
      });
      // Type guard to check if response is successful
      if (
        response !== null &&
        typeof response === "object" &&
        "status" in response &&
        response.status === 200
      ) {
        await this.loadContests();
      } else {
        const status = (response as unknown as { status?: number })?.status;
        throw new Error(
          `HTTP error! status: ${status !== undefined ? status : "unknown"}`
        );
      }
    } catch (error) {
      console.error("Failed to create contest:", error);
      throw error;
    }
  }

  private async updateContest(
    contestId: string,
    contestData: UpdateContestRequest
  ): Promise<void> {
    try {
      const response = await Ape.admin.updateContest({
        params: { contestId },
        body: contestData,
      });
      // Type guard to check if response is successful
      if (
        response !== null &&
        typeof response === "object" &&
        "status" in response &&
        response.status === 200
      ) {
        await this.loadContests();
      } else {
        const status = (response as unknown as { status?: number })?.status;
        throw new Error(
          `HTTP error! status: ${status !== undefined ? status : "unknown"}`
        );
      }
    } catch (error) {
      console.error("Failed to update contest:", error);
      throw error;
    }
  }

  private async deleteContest(contestId: string): Promise<void> {
    try {
      const response = await Ape.admin.deleteContest({
        params: { contestId },
      });
      // Type guard to check if response is successful
      if (
        response !== null &&
        typeof response === "object" &&
        "status" in response &&
        response.status === 200
      ) {
        await this.loadContests();
      } else {
        const status = (response as unknown as { status?: number })?.status;
        throw new Error(
          `HTTP error! status: ${status !== undefined ? status : "unknown"}`
        );
      }
    } catch (error) {
      console.error("Failed to delete contest:", error);
      throw error;
    }
  }

  private getFilteredContests(): ContestWithComputedFields[] {
    return this.contests.filter((contest) => {
      const matchesStatus =
        this.statusFilter === "all" || contest.status === this.statusFilter;
      const searchTermLower = this.searchTerm.toLowerCase();
      const matchesSearch =
        !this.searchTerm ||
        contest.name.toLowerCase().includes(searchTermLower) ||
        (contest.description?.toLowerCase().includes(searchTermLower) ?? false);

      return matchesStatus && matchesSearch;
    });
  }

  private renderContests(): void {
    const filteredContests = this.getFilteredContests();
    const contestsList = $(".contestsList");

    console.log("DEBUG: renderContests called with:", {
      totalContests: this.contests.length,
      filteredContests: filteredContests.length,
      statusFilter: this.statusFilter,
      searchTerm: this.searchTerm,
      contests: this.contests,
    });

    console.log("DEBUG: contestsList element found:", contestsList.length > 0);
    console.log("DEBUG: contestsList element:", contestsList[0]);

    if (filteredContests.length === 0) {
      console.log("DEBUG: No contests to display, showing empty state");
      contestsList.html(`
        <div class="emptyState">
          <i class="fas fa-trophy"></i>
          <h3>No contests found</h3>
          <p>Create your first contest to get started.</p>
          <button class="btn primary createContest">
            <i class="fas fa-plus"></i>
            New Contest
          </button>
        </div>
      `);
      return;
    }

    console.log(
      "DEBUG: Generating HTML for",
      filteredContests.length,
      "contests"
    );

    const contestsHtml = filteredContests
      .map((contest) => {
        const startDate =
          contest.startTime !== undefined
            ? new Date(contest.startTime).toLocaleString()
            : "Not set";
        const endDate =
          contest.endTime !== undefined
            ? new Date(contest.endTime).toLocaleString()
            : "Not set";

        // Calculate countdown for active contests
        let countdownHtml = "";
        const now = Date.now();
        if (
          contest.status === "active" &&
          contest.endTime !== undefined &&
          now < contest.endTime
        ) {
          const timeLeft = Math.ceil((contest.endTime - now) / 1000);
          countdownHtml = `
            <div class="countdown" data-end-time="${contest.endTime}">
              <i class="fas fa-hourglass-half"></i>
              <span class="countdown-text">Ends in: ${formatTime(
                timeLeft
              )}</span>
            </div>
          `;
        } else if (
          contest.status === "upcoming" &&
          contest.startTime !== undefined &&
          now < contest.startTime
        ) {
          const timeUntil = Math.ceil((contest.startTime - now) / 1000);
          countdownHtml = `
            <div class="countdown" data-start-time="${contest.startTime}">
              <i class="fas fa-clock"></i>
              <span class="countdown-text">Starts in: ${formatTime(
                timeUntil
              )}</span>
            </div>
          `;
        }

        return `
          <div class="contestItem" data-contest-id="${contest._id}">
            <div class="contestHeader">
              <h3>${contest.name}</h3>
              <div class="contestActions">
                <button class="btn secondary small editContestBtn" data-contest-id="${
                  contest._id
                }">
                  <i class="fas fa-edit"></i>
                  Edit
                </button>
                <button class="btn danger small deleteContestBtn" data-contest-id="${
                  contest._id
                }">
                  <i class="fas fa-trash"></i>
                  Delete
                </button>
              </div>
            </div>
            <div class="contestInfo">
              <p class="description">${
                contest.description !== undefined &&
                contest.description.length > 0
                  ? contest.description
                  : "No description"
              }</p>
              <div class="contestMeta">
                <span class="status ${
                  contest.status
                }">${contest.status.toUpperCase()}</span>
                <span class="participants">
                  <i class="fas fa-users"></i>
                  ${contest.currentParticipants} participants
                </span>
                ${
                  contest.duration > 0
                    ? `<span class="duration">
                  <i class="fas fa-clock"></i>
                  ${formatTime(contest.duration * 60)}
                </span>`
                    : ""
                }
              </div>
              ${countdownHtml}
              <div class="contestTimes">
                <div class="timeInfo">
                  <strong>Start:</strong> ${startDate}
                </div>
                <div class="timeInfo">
                  <strong>End:</strong> ${endDate}
                </div>
              </div>
              <div class="contestSettings">
                <span>Mode: ${contest.options.mode} ${
          contest.options.mode2
        }</span>
                <span>Punctuation: ${
                  contest.options.punctuation ? "Yes" : "No"
                }</span>
                <span>Numbers: ${contest.options.numbers ? "Yes" : "No"}</span>
              </div>
            </div>
          </div>
        `;
      })
      .join("");

    contestsList.html(contestsHtml);

    // Start countdown timer
    this.startCountdownTimer();
  }

  private startCountdownTimer(): void {
    // Clear existing timer
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
    }

    this.countdownInterval = setInterval(() => {
      const now = Date.now();
      let needsRefresh = false;

      $(".countdown").each((_, element) => {
        const $element = $(element);
        const endTime = $element.data("end-time") as number | undefined;
        const startTime = $element.data("start-time") as number | undefined;

        if (endTime !== undefined) {
          // Handle active contest countdown
          const timeLeft = Math.ceil((endTime - now) / 1000);
          if (timeLeft <= 0) {
            $element.find(".countdown-text").text("Contest ended");
            needsRefresh = true;
          } else {
            $element
              .find(".countdown-text")
              .text(`Ends in: ${formatTime(timeLeft)}`);
          }
        } else if (startTime !== undefined) {
          // Handle upcoming contest countdown
          const timeUntil = Math.ceil((startTime - now) / 1000);
          if (timeUntil <= 0) {
            $element.find(".countdown-text").text("Contest started");
            needsRefresh = true;
          } else {
            $element
              .find(".countdown-text")
              .text(`Starts in: ${formatTime(timeUntil)}`);
          }
        }
      });

      // Refresh contest list if any contest status changed
      if (needsRefresh) {
        void this.loadContests();
      }
    }, 1000);
  }

  private updateContestSelector(): void {
    const selector = $("#contestSelector");
    const options = this.contests
      .map(
        (contest) => `<option value="${contest._id}">${contest.name}</option>`
      )
      .join("");

    selector.html(`
      <option value="all">All Contests</option>
      ${options}
    `);
  }

  private showContestModal(contest?: ContestWithComputedFields): void {
    this.modal.isEdit = !!contest;
    this.modal.currentContest = contest || null;

    const modalTitle = contest ? "Edit Contest" : "Create New Contest";
    const submitText = contest ? "Update Contest" : "Create Contest";

    const modalHtml = `
      <div class="modal" id="contestModal">
        <div class="modalContent">
          <div class="modalHeader">
            <h2>${modalTitle}</h2>
            <button class="modalClose">&times;</button>
          </div>
          <form id="contestForm">
            <div class="formGrid">
              <div class="formGroup">
                <label for="contestName">Contest Name *</label>
                <input type="text" id="contestName" name="name" required 
                       value="${
                         contest?.name !== undefined ? contest.name : ""
                       }" placeholder="Enter contest name">
              </div>
              
              <div class="formGroup">
                <label for="contestDescription">Description</label>
                <textarea id="contestDescription" name="description" 
                          placeholder="Enter contest description">${
                            contest?.description ?? ""
                          }</textarea>
              </div>

              <div class="formGroup">
                <label for="contestMode">Mode *</label>
                <select id="contestMode" name="mode" required>
                  <option value="time" ${
                    contest?.options.mode === "time" ? "selected" : ""
                  }>Time</option>
                  <option value="words" ${
                    contest?.options.mode === "words" ? "selected" : ""
                  }>Words</option>
                  <option value="quote" ${
                    contest?.options.mode === "quote" ? "selected" : ""
                  }>Quote</option>
                  <option value="custom" ${
                    contest?.options.mode === "custom" ? "selected" : ""
                  }>Custom</option>
                </select>
              </div>

              <div class="formGroup">
                <label for="contestMode2">Mode Configuration *</label>
                <select id="contestMode2" name="mode2" required>
                  <!-- Options will be populated dynamically based on mode -->
                </select>
              </div>

              <div class="formGroup">
                <label>
                  <input type="checkbox" id="contestPunctuation" name="punctuation" 
                         ${contest?.options.punctuation ? "checked" : ""}>
                  Include Punctuation
                </label>
              </div>

              <div class="formGroup">
                <label>
                  <input type="checkbox" id="contestNumbers" name="numbers" 
                         ${contest?.options.numbers ? "checked" : ""}>
                  Include Numbers
                </label>
              </div>

              <div class="formGroup">
                <label for="startTime">Start Time</label>
                <input type="datetime-local" id="startTime" name="startTime" 
                       value="${
                         contest?.startTime !== undefined
                           ? new Date(contest.startTime)
                               .toISOString()
                               .slice(0, 16)
                           : ""
                       }">
              </div>

              <div class="formGroup">
                <label for="endTime">End Time</label>
                <input type="datetime-local" id="endTime" name="endTime" 
                       value="${
                         contest?.endTime !== undefined
                           ? new Date(contest.endTime)
                               .toISOString()
                               .slice(0, 16)
                           : ""
                       }">
              </div>

              <div class="formGroup">
                <label>
                  <input type="checkbox" id="isActive" name="isActive" 
                         ${contest?.isActive !== false ? "checked" : ""}>
                  Active Contest
                </label>
              </div>
            </div>

            <div class="modalActions">
              <button type="button" class="btn secondary modalCancel">Cancel</button>
              <button type="submit" class="btn primary">${submitText}</button>
            </div>
          </form>
        </div>
      </div>
    `;

    $("body").append(modalHtml);
    this.modal.element = document.getElementById("contestModal");
    this.modal.isVisible = true;

    // Populate mode2 options based on current mode
    this.updateMode2Options(
      contest?.options.mode || "time",
      contest?.options.mode2
    );

    this.setupModalEventHandlers();
  }

  private updateMode2Options(mode: string, selectedValue?: string): void {
    const mode2Select = $("#contestMode2");
    let options = "";

    switch (mode) {
      case "time": {
        const timeOptions = ["15", "30", "60", "120", "300"];
        options = timeOptions
          .map(
            (value) =>
              `<option value="${value}" ${
                selectedValue === value ? "selected" : ""
              }>${value} seconds</option>`
          )
          .join("");
        break;
      }

      case "words": {
        const wordOptions = ["10", "25", "50", "100", "200"];
        options = wordOptions
          .map(
            (value) =>
              `<option value="${value}" ${
                selectedValue === value ? "selected" : ""
              }>${value} words</option>`
          )
          .join("");
        break;
      }

      case "quote": {
        const quoteOptions = ["short", "medium", "long", "thicc"];
        options = quoteOptions
          .map(
            (value) =>
              `<option value="${value}" ${
                selectedValue === value ? "selected" : ""
              }">${value.charAt(0).toUpperCase() + value.slice(1)}</option>`
          )
          .join("");
        break;
      }

      case "custom":
        // For custom mode, allow any text input
        mode2Select.replaceWith(
          `<input type="text" id="contestMode2" name="mode2" required value="${
            selectedValue ?? ""
          }" placeholder="Custom configuration">`
        );
        return;

      default:
        options = `<option value="60" ${
          selectedValue === "60" ? "selected" : ""
        }>60 seconds</option>`;
    }

    mode2Select.html(options);
  }

  private setupModalEventHandlers(): void {
    if (!this.modal.element) return;

    // Close modal handlers
    $(this.modal.element).on("click", ".modalClose, .modalCancel", () => {
      this.hideContestModal();
    });

    $(this.modal.element).on("click", (e) => {
      if (e.target === this.modal.element) {
        this.hideContestModal();
      }
    });

    // Form submission
    $(this.modal.element).on("submit", "#contestForm", async (e) => {
      e.preventDefault();
      await this.handleContestFormSubmit();
    });

    // Mode change handler
    $(this.modal.element).on("change", "#contestMode", (e) => {
      const selectedMode = $(e.currentTarget).val() as string;
      this.updateMode2Options(selectedMode);
    });
  }

  private async handleContestFormSubmit(): Promise<void> {
    const form = document.getElementById("contestForm") as HTMLFormElement;
    const formData = new FormData(form);

    const description = formData.get("description") as string;
    const startTimeValue = formData.get("startTime");
    const endTimeValue = formData.get("endTime");

    const baseData = {
      name: formData.get("name") as string,
      description: description.length > 0 ? description : undefined,
      options: {
        mode: formData.get("mode") as
          | "time"
          | "words"
          | "quote"
          | "zen"
          | "custom",
        mode2: formData.get("mode2") as string,
        punctuation: formData.has("punctuation"),
        numbers: formData.has("numbers"),
      },
      isActive: formData.has("isActive"),
      startTime:
        startTimeValue !== null && startTimeValue !== ""
          ? new Date(startTimeValue as string).getTime()
          : undefined,
      endTime:
        endTimeValue !== null && endTimeValue !== ""
          ? new Date(endTimeValue as string).getTime()
          : undefined,
    };

    try {
      if (this.modal.isEdit && this.modal.currentContest) {
        // For updates, all fields are optional except the ones we're changing
        const updateData: UpdateContestRequest = baseData;
        await this.updateContest(this.modal.currentContest._id, updateData);
      } else {
        // For creates, all required fields must be present
        const createData: CreateContestRequest = baseData;
        await this.createContest(createData);
      }
      this.hideContestModal();
    } catch (error) {
      console.error("Failed to save contest:", error);
      alert("Failed to save contest. Please try again.");
    }
  }

  private hideContestModal(): void {
    if (this.modal.element) {
      $(this.modal.element).remove();
      this.modal.element = null;
    }
    this.modal.isVisible = false;
    this.modal.currentContest = null;
  }

  private setupEventHandlers(): void {
    // Tab switching handlers
    $("#adminPage").on("click", ".tab", (e) => {
      const clickedTab = $(e.currentTarget);
      const tabName = clickedTab.data("tab") as string;

      // Update tab active state
      $(".tab").removeClass("active");
      clickedTab.addClass("active");

      // Show/hide tab content
      $(".tabContent").addClass("hidden");
      $(`.tabContent[data-tab="${tabName}"]`).removeClass("hidden");

      // Load data for the selected tab
      void this.handleTabSwitch(tabName);
    });

    // Search and filter handlers
    $("#adminPage").on("input", "#contestSearch", (e) => {
      this.searchTerm = $(e.currentTarget).val() as string;
      this.renderContests();
    });

    $("#adminPage").on("change", "#statusFilter", (e) => {
      this.statusFilter = $(e.currentTarget).val() as string;
      this.renderContests();
    });

    // Contest action handlers
    $("#adminPage").on("click", ".createContest", () => {
      this.showContestModal();
    });

    $("#adminPage").on("click", ".editContestBtn", (e) => {
      const contestId = $(e.currentTarget).data("contest-id") as string;
      const contest = this.contests.find((c) => c._id === contestId);
      if (contest) {
        this.showContestModal(contest);
      }
    });

    $("#adminPage").on("click", ".deleteContestBtn", async (e) => {
      const contestId = $(e.currentTarget).data("contest-id") as string;
      const contest = this.contests.find((c) => c._id === contestId);

      if (
        contest &&
        confirm(
          `Are you sure you want to delete "${contest.name}"? This action cannot be undone.`
        )
      ) {
        try {
          await this.deleteContest(contestId);
        } catch (error) {
          alert("Failed to delete contest. Please try again.");
        }
      }
    });

    // Stats refresh handler
    $("#adminPage").on("change", "#contestSelector", async (e) => {
      this.selectedContestId = $(e.currentTarget).val() as string;
      await this.loadAndRenderStats();
    });

    // Contest stats selector handler
    $("#adminPage").on("change", ".contestStatsSelector", async (e) => {
      const contestId = $(e.currentTarget).val() as string;
      if (contestId) {
        const stats = await this.loadContestStats(contestId);
        if (stats) {
          this.renderStats(stats);
        }
      } else {
        const contestStatsContainer = $(".contestStatsContainer");
        contestStatsContainer.html(`
          <div class="noSelection">
            Select a contest to view detailed statistics
          </div>
        `);
      }
    });

    // Leaderboard contest selector handler
    $("#adminPage").on("change", ".leaderboardContestSelector", async (e) => {
      this.selectedLeaderboardContestId = $(e.currentTarget).val() as string;
      await this.loadLeaderboard();
    });

    // Expand/collapse user attempts
    $("#adminPage").on("click", ".expand-attempts", async (e) => {
      e.preventDefault();
      const uid = $(e.currentTarget).data("uid") as string;
      const isExpanded = this.expandedUserAttempts[uid] !== undefined;

      if (isExpanded) {
        // Collapse attempts
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        delete this.expandedUserAttempts[uid];
        $(`.user-attempts-row[data-uid="${uid}"]`).remove();
        $(e.currentTarget).html(
          '<i class="fas fa-chevron-down"></i> Show Attempts'
        );
      } else {
        // Expand attempts - first show loading
        const newRow = `
          <tr class="user-attempts-row" data-uid="${uid}">
            <td colspan="9">
              <div class="attempts-container">
                <div class="loading">Loading attempts...</div>
              </div>
            </td>
          </tr>
        `;
        $(`.leaderboard-entry[data-uid="${uid}"]`).after(newRow);
        $(e.currentTarget).html(
          '<i class="fas fa-chevron-up"></i> Hide Attempts'
        );

        // Load user attempts
        const attempts = await this.loadUserContestResults(
          this.selectedLeaderboardContestId,
          uid
        );
        this.expandedUserAttempts[uid] = attempts;

        // Update the row with actual attempts
        $(`.user-attempts-row[data-uid="${uid}"]`).replaceWith(
          this.renderUserAttempts(uid)
        );
      }
    });

    // Remove participant (all attempts)
    $("#adminPage").on("click", ".remove-participant", async (e) => {
      e.preventDefault();
      const uid = $(e.currentTarget).data("uid") as string;
      const name = $(e.currentTarget).data("name") as string;

      if (
        confirm(
          `Are you sure you want to remove ${name} from this contest? This will delete ALL their attempts and remove them from the leaderboard entirely. This action cannot be undone.`
        )
      ) {
        try {
          await this.deleteAllUserAttempts(uid);
        } catch (error) {
          console.error("Failed to remove participant:", error);
          alert("Failed to remove participant. Please try again.");
        }
      }
    });

    // Update leaderboard
    $("#adminPage").on("click", ".updateLeaderboard", async (e) => {
      e.preventDefault();
      if (this.selectedLeaderboardContestId) {
        $(".leaderboardData").html(
          '<div class="loading">Refreshing leaderboard...</div>'
        );
        // Clear expanded attempts cache
        this.expandedUserAttempts = {};
        await this.loadLeaderboard();
      } else {
        alert("Please select a contest first.");
      }
    });

    // Export leaderboard
    $("#adminPage").on("click", ".exportLeaderboard", (e) => {
      e.preventDefault();
      if (
        this.selectedLeaderboardContestId &&
        this.leaderboardEntries.length > 0
      ) {
        this.exportLeaderboardCSV();
      } else {
        alert("Please select a contest with participants first.");
      }
    });

    // Delete individual attempt
    $("#adminPage").on("click", ".delete-attempt", async (e) => {
      e.preventDefault();
      const uid = $(e.currentTarget).data("uid") as string;
      const attemptNumber = $(e.currentTarget).data("attempt-number") as number;
      const attemptId = $(e.currentTarget).data("attempt-id") as string;

      const userName =
        this.leaderboardEntries.find((e) => e.uid === uid)?.name ??
        "Unknown User";
      const bestAttemptNumber = this.getBestAttemptNumber(uid);
      const isBestAttempt = attemptNumber === bestAttemptNumber;

      const warningText = isBestAttempt
        ? `This is ${userName}'s best attempt. Deleting it will affect their leaderboard ranking. Are you sure?`
        : `Are you sure you want to delete attempt #${attemptNumber} for ${userName}?`;

      if (confirm(warningText + " This action cannot be undone.")) {
        try {
          await this.deleteUserAttempt(uid, attemptNumber, attemptId);
        } catch (error) {
          console.error("Failed to delete attempt:", error);
          alert("Failed to delete attempt. Please try again.");
        }
      }
    });
  }

  private async handleTabSwitch(tabName: string): Promise<void> {
    switch (tabName) {
      case "contests":
        await this.loadContests();
        break;
      case "participants":
        await this.loadParticipants();
        break;
      case "leaderboard":
        await this.loadLeaderboard();
        break;
      case "stats":
        await this.loadAndRenderStats();
        break;
    }
  }

  private async loadParticipants(): Promise<void> {
    // For now, show a placeholder since there's no participants API yet
    const participantsList = $(".participantsList");
    participantsList.html(`
      <div class="placeholder">
        <i class="fas fa-users"></i>
        <h3>Participants Management</h3>
        <p>Participant management functionality coming soon.</p>
        <p>This will show all contest participants, their results, and allow management actions.</p>
      </div>
    `);
  }

  private async expandUserAttempts(uid: string): Promise<void> {
    // Check if user is not already expanded
    if (this.expandedUserAttempts[uid] !== undefined) {
      return;
    }

    // Load user attempts
    const attempts = await this.loadUserContestResults(
      this.selectedLeaderboardContestId,
      uid
    );
    this.expandedUserAttempts[uid] = attempts;

    // Find the user row and add the attempts row after it
    const userRow = $(`.leaderboard-entry[data-uid="${uid}"]`);
    if (userRow.length > 0) {
      // Remove any existing attempts row for this user
      $(`.user-attempts-row[data-uid="${uid}"]`).remove();

      // Add the new attempts row
      userRow.after(this.renderUserAttempts(uid));

      // Update the expand button
      const expandButton = $(`.expand-attempts[data-uid="${uid}"]`);
      expandButton.html('<i class="fas fa-chevron-up"></i> Hide Attempts');
    }
  }

  private async loadLeaderboard(): Promise<void> {
    // Populate contest selector for leaderboard
    this.updateLeaderboardContestSelector();

    // Remember which users were expanded before clearing
    const previouslyExpandedUsers = Object.keys(this.expandedUserAttempts);

    // Clear expanded attempts cache to ensure fresh data after deletions
    this.expandedUserAttempts = {};

    if (this.selectedLeaderboardContestId) {
      // Load leaderboard for selected contest
      this.leaderboardEntries = await this.loadContestLeaderboard(
        this.selectedLeaderboardContestId
      );
      this.renderLeaderboard();

      // Re-expand users that were previously expanded
      for (const uid of previouslyExpandedUsers) {
        // Check if user still exists in the leaderboard
        const userStillExists = this.leaderboardEntries.some(
          (entry) => entry.uid === uid
        );
        if (userStillExists) {
          await this.expandUserAttempts(uid);
        }
      }
    } else {
      const leaderboardData = $(".leaderboardData");
      leaderboardData.html(`
        <div class="placeholder">
          <i class="fas fa-medal"></i>
          <h3>Contest Leaderboards</h3>
          <p>Select a contest above to view its leaderboard.</p>
          <p>This will show rankings, scores, and allow result management.</p>
        </div>
      `);
    }
  }

  private renderLeaderboard(): void {
    const leaderboardData = $(".leaderboardData");

    if (this.leaderboardEntries.length === 0) {
      leaderboardData.html(`
        <div class="placeholder">
          <i class="fas fa-medal"></i>
          <h3>No participants yet</h3>
          <p>This contest doesn't have any participants yet.</p>
        </div>
      `);
      return;
    }

    const leaderboardHtml = `
      <div class="leaderboardTable">
        <table>
          <thead>
            <tr>
              <th>Rank</th>
              <th>Name</th>
              <th>WPM</th>
              <th>Accuracy</th>
              <th>Raw WPM</th>
              <th>Consistency</th>
              <th>Attempts</th>
              <th>Best Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${this.leaderboardEntries
              .map((entry, index) => {
                const isExpanded =
                  this.expandedUserAttempts[entry.uid] !== undefined;
                return `
                <tr class="leaderboard-entry" data-uid="${entry.uid}">
                  <td>${(entry.rank ?? index) + 1}</td>
                  <td>
                    <div class="user-info">
                      ${
                        entry.discordAvatar !== null &&
                        entry.discordAvatar !== undefined &&
                        entry.discordAvatar.length > 0
                          ? `<img src="${entry.discordAvatar}" alt="${entry.name}" class="avatar" />`
                          : '<div class="avatar-placeholder"><i class="fas fa-user"></i></div>'
                      }
                      <span class="username">${entry.name}</span>
                      ${
                        entry.isPremium
                          ? '<i class="fas fa-crown premium-badge" title="Premium User"></i>'
                          : ""
                      }
                    </div>
                  </td>
                  <td><strong>${entry.wpm.toFixed(2)}</strong></td>
                  <td>${entry.acc.toFixed(2)}%</td>
                  <td>${entry.rawWpm.toFixed(2)}</td>
                  <td>${entry.consistency.toFixed(2)}%</td>
                  <td>
                    <span class="attempts-count">${entry.totalAttempts}</span>
                    <button class="btn secondary small expand-attempts" data-uid="${
                      entry.uid
                    }">
                      <i class="fas fa-${
                        isExpanded ? "chevron-up" : "chevron-down"
                      }"></i>
                      ${isExpanded ? "Hide" : "Show"} Attempts
                    </button>
                  </td>
                  <td>${new Date(
                    entry.bestAttempt.timestamp
                  ).toLocaleString()}</td>
                  <td>
                    <button class="btn danger small remove-participant" data-uid="${
                      entry.uid
                    }" data-name="${entry.name}">
                      <i class="fas fa-trash"></i>
                      Remove User
                    </button>
                  </td>
                </tr>
                ${isExpanded ? this.renderUserAttempts(entry.uid) : ""}
              `;
              })
              .join("")}
          </tbody>
        </table>
      </div>
    `;

    leaderboardData.html(leaderboardHtml);
  }

  private renderUserAttempts(uid: string): string {
    const attempts = this.expandedUserAttempts[uid];
    if (!attempts || attempts.length === 0) {
      return `
        <tr class="user-attempts-row" data-uid="${uid}">
          <td colspan="9">
            <div class="attempts-container">
              <div class="loading">Loading attempts...</div>
            </div>
          </td>
        </tr>
      `;
    }

    return `
      <tr class="user-attempts-row" data-uid="${uid}">
        <td colspan="9">
          <div class="attempts-container">
            <h4>All Attempts</h4>
            <table class="attempts-table">
              <thead>
                <tr>
                  <th>Attempt #</th>
                  <th>WPM</th>
                  <th>Accuracy</th>
                  <th>Raw WPM</th>
                  <th>Consistency</th>
                  <th>Duration</th>
                  <th>Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${attempts
                  .map(
                    (attempt) => `
                  <tr class="${
                    attempt.attemptNumber === this.getBestAttemptNumber(uid)
                      ? "best-attempt"
                      : ""
                  }" data-attempt-id="${attempt._id}">
                    <td>
                      ${attempt.attemptNumber}
                      ${
                        attempt.attemptNumber === this.getBestAttemptNumber(uid)
                          ? '<i class="fas fa-star" title="Best Attempt"></i>'
                          : ""
                      }
                    </td>
                    <td>${attempt.wpm.toFixed(2)}</td>
                    <td>${attempt.acc.toFixed(2)}%</td>
                    <td>${attempt.rawWpm.toFixed(2)}</td>
                    <td>${attempt.consistency.toFixed(2)}%</td>
                    <td>${attempt.testDuration}s</td>
                    <td>${new Date(attempt.timestamp).toLocaleString()}</td>
                    <td>
                      <button class="btn danger small delete-attempt" 
                              data-uid="${uid}" 
                              data-attempt-number="${attempt.attemptNumber}"
                              data-attempt-id="${attempt._id}">
                        <i class="fas fa-trash"></i>
                        Delete
                      </button>
                    </td>
                  </tr>
                `
                  )
                  .join("")}
              </tbody>
            </table>
          </div>
        </td>
      </tr>
    `;
  }

  private getBestAttemptNumber(uid: string): number {
    const entry = this.leaderboardEntries.find((e) => e.uid === uid);
    return entry?.bestAttempt.attemptNumber ?? 1;
  }

  private exportLeaderboardCSV(): void {
    const contestName =
      this.contests.find((c) => c._id === this.selectedLeaderboardContestId)
        ?.name ?? "Contest";
    const headers = [
      "Rank",
      "Name",
      "WPM",
      "Accuracy",
      "Raw WPM",
      "Consistency",
      "Total Attempts",
      "Best Date",
    ];
    const csvContent = [
      headers.join(","),
      ...this.leaderboardEntries.map((entry, index) =>
        [
          (entry.rank ?? index) + 1,
          `"${entry.name}"`,
          entry.wpm.toFixed(2),
          entry.acc.toFixed(2),
          entry.rawWpm.toFixed(2),
          entry.consistency.toFixed(2),
          entry.totalAttempts,
          `"${new Date(entry.bestAttempt.timestamp).toLocaleString()}"`,
        ].join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${contestName}_leaderboard_${
      new Date().toISOString().split("T")[0]
    }.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  private updateLeaderboardContestSelector(): void {
    const selector = $(".leaderboardContestSelector");
    const options = this.contests
      .map(
        (contest) => `<option value="${contest._id}">${contest.name}</option>`
      )
      .join("");

    selector.html(`
      <option value="">Select a contest</option>
      ${options}
    `);
  }

  private async deleteUserAttempt(
    uid: string,
    attemptNumber: number,
    _attemptId: string
  ): Promise<void> {
    try {
      // Show loading state
      const deleteButton = $(
        `.delete-attempt[data-uid="${uid}"][data-attempt-number="${attemptNumber}"]`
      );
      deleteButton
        .html('<i class="fas fa-spinner fa-spin"></i> Deleting...')
        .prop("disabled", true);

      // Remember that this user was expanded so we can re-expand after reload
      const wasExpanded = this.expandedUserAttempts[uid] !== undefined;

      // Call the actual backend API - using eslint-disable to handle type inference issues
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const response = await Ape.admin.deleteContestAttempt({
        params: {
          contestId: this.selectedLeaderboardContestId,
          uid,
          attemptNumber: attemptNumber.toString(),
        },
      });

      // Type guard to check if response is successful
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (
        response !== null &&
        typeof response === "object" &&
        "status" in response &&
        response.status === 200
      ) {
        console.log(`Deleted attempt #${attemptNumber} for user ${uid}`);

        // Reload the leaderboard to reflect changes
        await this.loadLeaderboard();

        // Re-expand the user's attempts if they were expanded before
        if (wasExpanded) {
          await this.expandUserAttempts(uid);
        }
      } else {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        const status = (response as { status?: number })?.status ?? "unknown";
        throw new Error(`HTTP error! status: ${status}`);
      }
    } catch (error) {
      console.error("Failed to delete user attempt:", error);

      // Reset button state on error
      const deleteButton = $(
        `.delete-attempt[data-uid="${uid}"][data-attempt-number="${attemptNumber}"]`
      );
      if (deleteButton.length > 0) {
        deleteButton
          .html('<i class="fas fa-trash"></i> Delete')
          .prop("disabled", false);
      }

      throw error;
    }
  }

  private async deleteAllUserAttempts(uid: string): Promise<void> {
    try {
      // Show loading state
      const removeButton = $(`.remove-participant[data-uid="${uid}"]`);
      removeButton
        .html('<i class="fas fa-spinner fa-spin"></i> Removing...')
        .prop("disabled", true);

      // Call the actual backend API - using eslint-disable to handle type inference issues
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const response = await Ape.admin.deleteAllUserContestAttempts({
        params: {
          contestId: this.selectedLeaderboardContestId,
          uid,
        },
      });

      // Type guard to check if response is successful
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (
        response !== null &&
        typeof response === "object" &&
        "status" in response &&
        response.status === 200
      ) {
        console.log(`Deleted all attempts for user ${uid}`);
        // Reload the leaderboard to reflect changes
        await this.loadLeaderboard();
      } else {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        const status = (response as { status?: number })?.status ?? "unknown";
        throw new Error(`HTTP error! status: ${status}`);
      }
    } catch (error) {
      console.error("Failed to delete all user attempts:", error);

      // Reset button state on error
      const removeButton = $(`.remove-participant[data-uid="${uid}"]`);
      removeButton
        .html('<i class="fas fa-trash"></i> Remove User')
        .prop("disabled", false);

      throw error;
    }
  }

  private async loadAndRenderStats(): Promise<void> {
    // Update contest selector for stats
    this.updateStatsContestSelector();

    const contestId =
      this.selectedContestId === "all" ? undefined : this.selectedContestId;
    const stats = await this.loadContestStats(contestId);

    if (stats) {
      this.renderStats(stats);
    } else {
      // Show default stats view
      const statsContainer = $(".statsContainer");
      statsContainer.html(`
        <div class="placeholder">
          <i class="fas fa-chart-bar"></i>
          <h3>Contest Statistics</h3>
          <p>Overall statistics and analytics for your contests.</p>
          <p>Create some contests and gather participants to see statistics here.</p>
        </div>
      `);

      const contestStatsContainer = $(".contestStatsContainer");
      contestStatsContainer.html(`
        <div class="noSelection">
          Select a contest to view detailed statistics
        </div>
      `);
    }
  }

  private updateStatsContestSelector(): void {
    const selector = $(".contestStatsSelector");
    const options = this.contests
      .map(
        (contest) => `<option value="${contest._id}">${contest.name}</option>`
      )
      .join("");

    selector.html(`
      <option value="">Select a contest</option>
      ${options}
    `);
  }

  private renderStats(stats: ContestStats): void {
    const contestStatsContainer = $(".contestStatsContainer");

    const statsHtml = `
      <div class="statsGrid">
        <div class="statCard">
          <div class="statValue">${stats.participantCount}</div>
          <div class="statLabel">Total Participants</div>
        </div>
        <div class="statCard">
          <div class="statValue">${stats.totalAttempts}</div>
          <div class="statLabel">Total Attempts</div>
        </div>
        <div class="statCard">
          <div class="statValue">${stats.avgWpm}</div>
          <div class="statLabel">Average WPM</div>
        </div>
        <div class="statCard">
          <div class="statValue">${stats.avgAccuracy}%</div>
          <div class="statLabel">Average Accuracy</div>
        </div>
        <div class="statCard">
          <div class="statValue">${stats.highestWpm}</div>
          <div class="statLabel">Highest WPM</div>
        </div>
        <div class="statCard">
          <div class="statValue">${stats.bestAccuracy}%</div>
          <div class="statLabel">Best Accuracy</div>
        </div>
      </div>
    `;

    contestStatsContainer.html(statsHtml);
  }

  async init(): Promise<void> {
    console.log("DEBUG: AdminPage init() called");
    this.setupEventHandlers();
    await this.loadContests();
    await this.loadAndRenderStats();
    console.log("DEBUG: AdminPage init() completed");
  }
}

const adminController = new AdminPage();

export const page = new Page({
  id: "admin",
  element: $(".page.pageAdmin"),
  path: "/admin",
  beforeShow: async (): Promise<void> => {
    console.log("DEBUG: Admin page beforeShow called");
    Skeleton.append("adminPage", "main");
    // Ensure contests are loaded when page is shown
    await adminController.init();
  },
  afterHide: async (): Promise<void> => {
    console.log("DEBUG: Admin page afterHide called");
    // Clear any timers/state if needed
    if (adminController.countdownInterval) {
      clearInterval(adminController.countdownInterval);
      adminController.countdownInterval = null;
    }
    Skeleton.remove("adminPage");
  },
});

$(async () => {
  Skeleton.save("adminPage");
});
