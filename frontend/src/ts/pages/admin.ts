import Page from "./page";

type Contest = {
  id: number;
  name: string;
  description: string;
  startTime: string;
  endTime: string;
  duration: number;
  maxParticipants: number;
  currentParticipants: number;
  status: string;
};

type Participant = {
  id: number;
  username: string;
  contestId: number;
  wpm: number;
  accuracy: number;
  rank: number;
};

class AdminPageController {
  private activeTab = "contests";
  private contests: Contest[] = [];
  private participants: Participant[] = [];

  init(): void {
    this.setupTabSwitching();
    this.setupEventListeners();
    this.setupModalHandlers();
    void this.loadInitialData();
  }

  private setupTabSwitching(): void {
    const tabs = $("#adminPage .tabs .tab");

    tabs.on("click", (e) => {
      const tabName = $(e.currentTarget).data("tab") as string | undefined;
      if (typeof tabName === "string" && tabName) {
        this.switchTab(tabName);
      }
    });

    $("#adminPage").on("input", "#contestSearch", (e) => {
      const searchTerm = $(e.currentTarget).val() as string;
      const statusFilter = $("#statusFilter").val() as string;
      this.filterContests(searchTerm, statusFilter);
    });

    $("#adminPage").on("change", "#statusFilter", (e) => {
      const statusFilter = $(e.currentTarget).val() as string;
      const searchTerm = $("#contestSearch").val() as string;
      this.filterContests(searchTerm, statusFilter);
    });

    $("#adminPage").on("click", ".newContestBtn", () => {
      this.showContestModal();
    });
  }

  private switchTab(tabName: string): void {
    this.activeTab = tabName;

    $("#adminPage .tabs .tab").removeClass("active");
    $(`#adminPage .tabs .tab[data-tab="${tabName}"]`).addClass("active");

    $("#adminPage .tabContent").addClass("hidden");
    $(`#adminPage .tabContent[data-tab="${tabName}"]`).removeClass("hidden");

    this.loadTabContent(tabName);
  }

  private filterContests(
    searchTerm: string,
    statusFilter: string = "all"
  ): void {
    let filteredContests = [...this.contests];

    if (statusFilter && statusFilter !== "all") {
      filteredContests = filteredContests.filter(
        (contest) => contest.status === statusFilter
      );
    }

    if (searchTerm) {
      const searchTermLower = searchTerm.toLowerCase();
      filteredContests = filteredContests.filter(
        (contest) =>
          contest.name.toLowerCase().includes(searchTermLower) ||
          contest.description.toLowerCase().includes(searchTermLower)
      );
    }

    this.renderContests(filteredContests);
  }

  private loadTabContent(tabName: string): void {
    switch (tabName) {
      case "contests":
        this.loadContests();
        break;
      case "participants":
        this.loadParticipants();
        break;
      case "leaderboard":
        this.loadLeaderboard();
        break;
      case "stats":
        this.loadStats();
        this.loadContestStats();
        break;
    }
  }

  private async loadInitialData(): Promise<void> {
    $("#adminPage .loading").removeClass("hidden");

    try {
      try {
        const response = await fetch("/api/admin/contests");
        if (response.ok) {
          const data = (await response.json()) as Record<string, unknown>[];
          if (Array.isArray(data)) {
            this.contests = data.map((contest: Record<string, unknown>) => ({
              id: (contest["id"] as number) || (contest["_id"] as number),
              name: contest["name"] as string,
              description: (contest["description"] as string) || "",
              startTime: new Date(contest["startTime"] as string).toISOString(),
              endTime: (contest["endTime"] as string)
                ? new Date(contest["endTime"] as string).toISOString()
                : "",
              duration: (contest["duration"] as number) || 60,
              maxParticipants: (contest["maxParticipants"] as number) || 100,
              currentParticipants: (contest["participantCount"] as number) || 0,
              status: (contest["isActive"] as boolean)
                ? "active"
                : new Date(contest["startTime"] as string) > new Date()
                ? "upcoming"
                : "ended",
            }));
            console.log("Contests loaded from API:", this.contests);
          }
        } else {
          console.warn("Failed to fetch contests from API, using sample data");
          throw new Error("API error");
        }
      } catch (err) {
        console.warn("Using sample data", err);
        this.contests = [
          {
            id: 1,
            name: "Speed Championship 2025",
            description: "Annual typing speed championship",
            startTime: "2025-08-15T10:00",
            endTime: "2025-08-15T12:00",
            duration: 60,
            maxParticipants: 100,
            currentParticipants: 45,
            status: "upcoming",
          },
          {
            id: 2,
            name: "Weekly Speed Test",
            description: "Regular weekly typing test",
            startTime: "2025-08-11T14:00",
            endTime: "2025-08-11T16:00",
            duration: 30,
            maxParticipants: 50,
            currentParticipants: 23,
            status: "active",
          },
          {
            id: 3,
            name: "Accuracy Challenge",
            description: "Focus on typing accuracy",
            startTime: "2025-08-10T09:00",
            endTime: "2025-08-10T11:00",
            duration: 120,
            maxParticipants: 75,
            currentParticipants: 67,
            status: "ended",
          },
        ];
      }

      try {
        this.participants = [
          {
            id: 1,
            username: "speedtyper123",
            contestId: 1,
            wpm: 95,
            accuracy: 98,
            rank: 1,
          },
          {
            id: 2,
            username: "keyboardwarrior",
            contestId: 1,
            wpm: 87,
            accuracy: 96,
            rank: 2,
          },
          {
            id: 3,
            username: "typingpro",
            contestId: 2,
            wpm: 102,
            accuracy: 94,
            rank: 1,
          },
          {
            id: 4,
            username: "fastfingers",
            contestId: 2,
            wpm: 78,
            accuracy: 99,
            rank: 2,
          },
          {
            id: 5,
            username: "accuratetyper",
            contestId: 3,
            wpm: 65,
            accuracy: 100,
            rank: 1,
          },
        ];
      } catch (error) {
        console.error("Error fetching participants:", error);
      }

      this.updateContestSelectors();
      $("#adminPage .loading").addClass("hidden");
    } catch (error) {
      console.error("Error loading initial data:", error);
      $("#adminPage .error")
        .removeClass("hidden")
        .find(".message")
        .text("Failed to load data. Please try again later.");
    }
  }

  private updateContestSelectors(): void {
    const selectors = [
      ".contestSelector",
      ".leaderboardContestSelector",
      ".contestStatsSelector",
    ];
    selectors.forEach((selector) => {
      const $select = $(selector);
      $select.find("option:not(:first)").remove();
      this.contests.forEach((contest) => {
        $select.append(
          `<option value="${contest.id}">${contest.name}</option>`
        );
      });
    });
  }

  private loadContests(): void {
    const container = $("#adminPage .contestsList");

    container.html('<div class="loading">Loading contests...</div>');

    setTimeout(() => {
      this.renderContests(this.contests);
    }, 300);
  }

  private renderContests(contestsToRender: Contest[]): void {
    const container = $("#adminPage .contestsList");

    if (contestsToRender.length === 0) {
      container.html(
        '<div class="noResults">No contests found matching your search</div>'
      );
      return;
    }

    let html = "";

    contestsToRender.forEach((contest) => {
      const startDate = new Date(contest.startTime).toLocaleString();
      const endDate = new Date(contest.endTime).toLocaleString();

      html += `
        <div class="contestItem" data-contest-id="${contest.id}">
          <h3>${contest.name}</h3>
          <p>${contest.description}</p>
          <div class="timeInfo">
            <div class="timeSlot">
              <div class="label">Start Time</div>
              <div class="time">${startDate}</div>
            </div>
            <div class="timeSlot">
              <div class="label">End Time</div>
              <div class="time">${endDate}</div>
            </div>
          </div>
          <p>
            <span class="status ${
              contest.status
            }">${contest.status.toUpperCase()}</span>
            | Participants: ${contest.currentParticipants ?? 0}/${
        contest.maxParticipants > 999000 ? "∞" : contest.maxParticipants
      }
            | Duration: ${contest.duration}s
          </p>
          <div class="actions">
            <button class="edit" data-contest-id="${contest.id}">
              <i class="fas fa-edit"></i> Edit
            </button>
            <button class="view" data-contest-id="${contest.id}">
              <i class="fas fa-eye"></i> View
            </button>
            <button class="danger delete" data-contest-id="${contest.id}">
              <i class="fas fa-trash"></i> Delete
            </button>
          </div>
        </div>
      `;
    });

    container.html(html);
  }

  private loadParticipants(): void {
    const selectedContestId = $(".contestSelector").val();
    const filteredParticipants =
      selectedContestId !== undefined &&
      selectedContestId !== null &&
      selectedContestId !== ""
        ? this.participants.filter(
            (p) => p.contestId === Number(selectedContestId)
          )
        : this.participants;

    const container = $("#adminPage .participantsList");
    let html = "";

    filteredParticipants.forEach((participant) => {
      const contest = this.contests.find((c) => c.id === participant.contestId);
      html += `
        <div class="participantItem">
          <h3>${participant.username}</h3>
          <div class="info">Contest: ${contest?.name ?? "Unknown"}</div>
          <div class="stats">WPM: ${participant.wpm} | Accuracy: ${
        participant.accuracy
      }% | Rank: #${participant.rank}</div>
          <div class="actions">
            <button class="view">View Profile</button>
            <button class="remove danger">Remove from Contest</button>
          </div>
        </div>
      `;
    });

    container.html(
      html ||
        '<div class="loading">No participants found for selected contest.</div>'
    );
  }

  private loadLeaderboard(): void {
    const selectedContestId = $(".leaderboardContestSelector").val();
    const container = $("#adminPage .leaderboardData");

    if (
      selectedContestId === undefined ||
      selectedContestId === null ||
      selectedContestId === ""
    ) {
      container.html(
        '<div class="loading">Select a contest to view leaderboard...</div>'
      );
      return;
    }

    const contestParticipants = this.participants
      .filter((p) => p.contestId === Number(selectedContestId))
      .sort((a, b) => a.rank - b.rank);

    let html = "";
    contestParticipants.forEach((participant, index) => {
      const medal =
        index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : "";
      html += `
        <div class="leaderboardItem">
          <h3>${medal} #${participant.rank} - ${participant.username}</h3>
          <div class="stats">WPM: ${participant.wpm} | Accuracy: ${participant.accuracy}%</div>
          <div class="actions">
            <button class="view">View Details</button>
            <button class="disqualify danger">Disqualify</button>
          </div>
        </div>
      `;
    });

    container.html(
      html || '<div class="loading">No participants in this contest.</div>'
    );
  }

  private loadStats(): void {
    const container = $("#adminPage .statsContainer");
    const totalParticipants = this.participants.length;
    const avgWpm =
      Math.round(
        this.participants.reduce((sum, p) => sum + p.wpm, 0) / totalParticipants
      ) || 0;
    const avgAccuracy =
      Math.round(
        this.participants.reduce((sum, p) => sum + p.accuracy, 0) /
          totalParticipants
      ) || 0;

    container.html(`
      <div class="statCard">
        <h3>Total Contests</h3>
        <div class="value">${this.contests.length}</div>
      </div>
      <div class="statCard">
        <h3>Active Participants</h3>
        <div class="value">${totalParticipants}</div>
      </div>
      <div class="statCard">
        <h3>Average WPM</h3>
        <div class="value">${avgWpm}</div>
      </div>
      <div class="statCard">
        <h3>Average Accuracy</h3>
        <div class="value">${avgAccuracy}%</div>
      </div>
    `);
  }

  private loadContestStats(): void {
    const container = $("#adminPage .contestStatsContainer");
    const contestId = parseInt($(".contestStatsSelector").val() as string);

    if (isNaN(contestId)) {
      container.html(
        `<div class="noSelection">Select a contest to view detailed statistics</div>`
      );
      return;
    }

    const contest = this.contests.find((c) => c.id === contestId);
    if (!contest) {
      container.html(`<div class="noSelection">Contest not found</div>`);
      return;
    }

    const contestParticipants = this.participants.filter(
      (p) => p.contestId === contestId
    );
    const participantCount = contestParticipants.length;

    if (participantCount === 0) {
      container.html(
        `<div class="noSelection">No participants in this contest yet</div>`
      );
      return;
    }

    const avgWpm = Math.round(
      contestParticipants.reduce((sum, p) => sum + p.wpm, 0) / participantCount
    );
    const avgAccuracy = Math.round(
      contestParticipants.reduce((sum, p) => sum + p.accuracy, 0) /
        participantCount
    );
    const highestWpm = Math.max(...contestParticipants.map((p) => p.wpm));
    const mostAccurate = Math.max(
      ...contestParticipants.map((p) => p.accuracy)
    );

    container.html(`
      <div class="statCard">
        <h3>Participants</h3>
        <div class="value">${participantCount}</div>
      </div>
      <div class="statCard">
        <h3>Average WPM</h3>
        <div class="value">${avgWpm}</div>
      </div>
      <div class="statCard">
        <h3>Average Accuracy</h3>
        <div class="value">${avgAccuracy}%</div>
      </div>
      <div class="statCard">
        <h3>Highest WPM</h3>
        <div class="value">${highestWpm}</div>
      </div>
      <div class="statCard">
        <h3>Best Accuracy</h3>
        <div class="value">${mostAccurate}%</div>
      </div>
    `);
  }

  private setupEventListeners(): void {
    $("#adminPage").on("click", ".createContest", () => {
      this.showContestModal();
    });

    $("#adminPage").on("change", ".contestSelector", () => {
      this.loadParticipants();
    });

    $("#adminPage").on("change", ".leaderboardContestSelector", () => {
      this.loadLeaderboard();
    });

    $("#adminPage").on("change", ".contestStatsSelector", () => {
      this.loadContestStats();
    });

    $("#adminPage").on("click", ".updateLeaderboard", () => {
      this.loadLeaderboard();
      alert("Leaderboard updated!");
    });

    $("#adminPage").on("click", ".exportLeaderboard", () => {
      alert("Export functionality - Step 5!");
    });

    $("#adminPage").on("click", ".contestsList .edit", (e) => {
      const contestId = $(e.currentTarget).data("contest-id") as
        | number
        | undefined;
      if (contestId !== undefined && contestId !== null) {
        const contest = this.contests.find((c) => c.id === Number(contestId));
        if (contest) {
          this.showEditContestModal(contest);
        }
      }
    });

    $("#adminPage").on("click", ".contestsList .view", (e) => {
      const contestId = $(e.currentTarget).data("contest-id") as
        | number
        | undefined;
      if (contestId !== undefined && contestId !== null) {
        $(".leaderboardContestSelector").val(String(contestId));
        this.switchTab("leaderboard");
      }
    });

    $("#adminPage").on("click", ".contestsList .delete", async (e) => {
      const contestId = $(e.currentTarget).data("contest-id") as
        | number
        | undefined;
      if (
        contestId !== undefined &&
        contestId !== null &&
        confirm(
          "Are you sure you want to delete this contest? This action cannot be undone."
        )
      ) {
        void this.deleteContest(Number(contestId));
      }
    });
  }

  private setupModalHandlers(): void {
    $("#adminPage").on("click", ".closeModal, .cancelBtn", () => {
      this.hideContestModal();
    });

    $("#adminPage").on("change", "#unlimitedParticipants", (e) => {
      const isChecked = $(e.currentTarget).prop("checked") === true;
      const $maxParticipantsInput = $("#maxParticipants");

      $maxParticipantsInput.val("");

      const minAttr = $maxParticipantsInput.attr("min");
      const minValue =
        minAttr !== undefined && minAttr !== "" ? parseInt(minAttr, 10) : 0;

      if (isChecked) {
        $maxParticipantsInput.prop("disabled", true).val("999999");
      } else {
        const defaultValue = Math.max(minValue, 100);
        $maxParticipantsInput
          .prop("disabled", false)
          .val(defaultValue.toString());
      }
    });

    $("#adminPage").on("click", ".modal", (e) => {
      if (e.target === e.currentTarget) {
        this.hideContestModal();
      }
    });
  }

  private showContestModal(): void {
    console.log("Showing contest modal in create mode");

    $(".modalHeader h3").text("Create New Contest");
    $(".saveBtn").text("Create Contest");

    $(".contestForm").attr("data-mode", "create").removeAttr("data-contest-id");
    $(".contestForm").data("mode", "create").removeData("contest-id");

    const form = document.querySelector(".contestForm") as HTMLFormElement;
    if (form !== null) {
      form.reset();
    }

    const now = new Date();
    const startTime = new Date(now.getTime() + 60 * 60 * 1000);
    const endTime = new Date(startTime.getTime() + 2 * 60 * 60 * 1000);

    $("#startTime").val(startTime.toISOString().slice(0, 16));
    $("#endTime").val(endTime.toISOString().slice(0, 16));

    $(".contestModal").removeClass("hidden");

    $(".contestForm")
      .off("submit")
      .on("submit", (e) => {
        e.preventDefault();

        console.log("Create form submitted");

        this.createContest();
      });
  }

  private hideContestModal(): void {
    console.log("Hiding contest modal and resetting form");

    $(".contestModal").addClass("hidden");

    $(".contestForm").removeAttr("data-mode").removeAttr("data-contest-id");
    $(".contestForm").removeData("mode").removeData("contest-id");

    $(".formNote").remove();

    $(".contestForm").off("submit");

    const form = document.querySelector(".contestForm") as HTMLFormElement;
    if (form !== null) {
      form.reset();

      $("#maxParticipants").val("").prop("disabled", false).removeAttr("min");

      $("#unlimitedParticipants").prop("checked", false);
    }
  }

  private createContest(): void {
    console.log("Creating new contest");

    const maxParticipantsValue = ($("#maxParticipants").val() as string).trim();

    const formData = {
      name: $("#contestName").val() as string,
      description: $("#contestDescription").val() as string,
      startTime: $("#startTime").val() as string,
      endTime: $("#endTime").val() as string,
      duration: parseInt($("#testDuration").val() as string),
      maxParticipants: isNaN(parseInt(maxParticipantsValue, 10))
        ? 100
        : parseInt(maxParticipantsValue, 10),
    };

    const newContest: Contest = {
      id: this.contests.length + 1,
      ...formData,
      currentParticipants: 0,
      status: "upcoming",
    };

    this.contests.push(newContest);
    this.updateContestSelectors();
    this.loadContests();
    this.hideContestModal();

    alert(`Contest "${formData.name}" created successfully!`);
  }

  private showEditContestModal(contest: Contest): void {
    $(".modalHeader h3").text("Edit Contest");
    $(".saveBtn").text("Update Contest");

    console.log(`Setting form to edit mode with contest ID: ${contest.id}`);

    $(".contestForm")
      .attr("data-mode", "edit")
      .attr("data-contest-id", contest.id.toString());
    $(".contestForm").data("mode", "edit").data("contest-id", contest.id);

    const form = document.querySelector(".contestForm") as HTMLFormElement;
    if (form !== null) {
      form.reset();
    }

    $("#contestName").val(contest.name);
    $("#contestDescription").val(contest.description);
    $("#startTime").val(new Date(contest.startTime).toISOString().slice(0, 16));
    $("#endTime").val(
      contest.endTime
        ? new Date(contest.endTime).toISOString().slice(0, 16)
        : ""
    );
    $("#testDuration").val(contest.duration);

    const currentParticipants = contest.currentParticipants ?? 0;

    $("#maxParticipants").val("");

    if (currentParticipants > 0) {
      $("#maxParticipants").attr("min", currentParticipants.toString());
    }

    if (contest.maxParticipants > 999000) {
      $("#maxParticipants").val("999999").prop("disabled", true);
      $("#unlimitedParticipants").prop("checked", true);
    } else {
      $("#maxParticipants")
        .val(contest.maxParticipants.toString())
        .prop("disabled", false);
      $("#unlimitedParticipants").prop("checked", false);
    }

    $(".contestModal").removeClass("hidden");

    $(".contestForm")
      .off("submit")
      .on("submit", (e) => {
        e.preventDefault();

        console.log("Edit form submitted");

        const contestId = contest.id;
        console.log(`Updating contest with ID: ${contestId}`);

        void this.updateContest(contestId);
      });
  }

  private async updateContest(contestId: number): Promise<void> {
    console.log(`Updating contest with ID: ${contestId}`);

    const maxParticipantsValue = ($("#maxParticipants").val() as string).trim();

    const formData = {
      name: $("#contestName").val() as string,
      description: $("#contestDescription").val() as string,
      startTime: $("#startTime").val() as string,
      endTime: $("#endTime").val() as string,
      duration: parseInt($("#testDuration").val() as string),
      maxParticipants: isNaN(parseInt(maxParticipantsValue, 10))
        ? 100
        : parseInt(maxParticipantsValue, 10),
    };

    const index = this.contests.findIndex((c) => c.id === contestId);
    if (index === -1) {
      alert(`Contest with ID ${contestId} not found!`);
      return;
    }

    console.log(`Found contest at index ${index}`);

    const existingContest = this.contests[index];

    if (!existingContest) {
      alert("Contest data is missing or corrupted");
      return;
    }

    const currentParticipants = existingContest.currentParticipants ?? 0;
    if (formData.maxParticipants < currentParticipants) {
      alert(
        `Cannot reduce max participants to ${formData.maxParticipants}. This contest already has ${currentParticipants} participants.`
      );
      return;
    }

    const updatedContest: Contest = {
      id: existingContest.id,
      currentParticipants: existingContest.currentParticipants ?? 0,
      name: formData.name,
      description: formData.description,
      startTime: formData.startTime,
      endTime: formData.endTime,
      duration: formData.duration,
      maxParticipants: formData.maxParticipants,
      status:
        new Date(formData.startTime) > new Date()
          ? "upcoming"
          : formData.endTime && new Date(formData.endTime) < new Date()
          ? "ended"
          : "active",
    };

    console.log("Original contest:", this.contests[index]);
    console.log("Updated contest:", updatedContest);

    this.contests[index] = updatedContest;

    this.hideContestModal();
    this.updateContestSelectors();
    this.loadContests();

    alert(`Contest "${formData.name}" updated successfully!`);
  }

  private async deleteContest(contestId: number): Promise<void> {
    this.contests = this.contests.filter((c) => c.id !== contestId);

    this.updateContestSelectors();
    this.loadContests();

    alert("Contest deleted successfully!");
  }
}

const adminController = new AdminPageController();

export const page = new Page({
  id: "admin",
  element: $("#adminPage"),
  path: "/admin",
  afterHide: async (): Promise<void> => {
    // Cleanup when leaving admin page
  },
  beforeShow: async (): Promise<void> => {
    adminController.init();
  },
});
