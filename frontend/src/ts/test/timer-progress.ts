import Config from "../config";
import * as CustomText from "./custom-text";
import * as DateTime from "../utils/date-and-time";
import * as TestWords from "./test-words";
import * as TestInput from "./test-input";
import * as Time from "../states/time";
import * as SlowTimer from "../states/slow-timer";
import * as TestState from "./test-state";
import * as ActivePage from "../states/active-page";
import * as ConfigEvent from "../observables/config-event";

function getBarEl(): JQuery<HTMLElement> {
  return $(
    ActivePage.get() === "contest"
      ? ".pageContest #barTimerProgress .bar"
      : ".pageTest #barTimerProgress .bar"
  );
}

function getBarOpacityEl(): JQuery<HTMLElement> {
  return $(
    ActivePage.get() === "contest"
      ? ".pageContest #barTimerProgress .opacityWrapper"
      : ".pageTest #barTimerProgress .opacityWrapper"
  );
}

function getTextEl(): JQuery<HTMLElement> {
  return $(
    ActivePage.get() === "contest"
      ? ".pageContest #liveStatsTextTop .timerProgress"
      : ".pageTest #liveStatsTextTop .timerProgress"
  );
}

function getMiniEl(): JQuery<HTMLElement> {
  return $(
    ActivePage.get() === "contest"
      ? ".pageContest #liveStatsMini .time"
      : ".pageTest #liveStatsMini .time"
  );
}

export function show(): void {
  if (Config.mode !== "zen" && Config.timerStyle === "bar") {
    getBarOpacityEl()
      .stop(true, true)
      .removeClass("hidden")
      .css("opacity", 0)
      .animate(
        {
          opacity: 1,
        },
        125
      );
  } else if (Config.timerStyle === "text") {
    getTextEl()
      .stop(true, true)
      .removeClass("hidden")
      .css("opacity", 0)
      .animate(
        {
          opacity: 1,
        },
        125
      );
  } else if (Config.mode === "zen" || Config.timerStyle === "mini") {
    getMiniEl()
      .stop(true, true)
      .removeClass("hidden")
      .css("opacity", 0)
      .animate(
        {
          opacity: 1,
        },
        125
      );
  }
}

export function reset(): void {
  let width = "0vw";
  if (
    Config.mode === "time" ||
    (Config.mode === "custom" && CustomText.getLimitMode() === "time")
  ) {
    width = "100vw";
  }
  getBarEl().stop(true, true).animate(
    {
      width,
    },
    0
  );
  getMiniEl().text("0");
  getTextEl().text("0");
}

export function hide(): void {
  getBarOpacityEl().stop(true, true).animate(
    {
      opacity: 0,
    },
    125
  );
  getMiniEl()
    .stop(true, true)
    .animate(
      {
        opacity: 0,
      },
      125,
      () => {
        getMiniEl().addClass("hidden");
      }
    );
  getTextEl().stop(true, true).animate(
    {
      opacity: 0,
    },
    125
  );
}

function getTimerNumberElement(): HTMLElement {
  return getTextEl()[0] as HTMLElement;
}

function getMiniTimerNumberElement(): HTMLElement {
  return getMiniEl()[0] as HTMLElement;
}

function getCurrentCount(): number {
  if (Config.mode === "custom" && CustomText.getLimitMode() === "section") {
    return (
      (TestWords.words.sectionIndexList[TestState.activeWordIndex] as number) -
      1
    );
  } else {
    return TestInput.input.getHistory().length;
  }
}

export function update(): void {
  const time = Time.get();
  if (
    Config.mode === "time" ||
    (Config.mode === "custom" && CustomText.getLimitMode() === "time")
  ) {
    let maxtime = Config.time;
    if (Config.mode === "custom" && CustomText.getLimitMode() === "time") {
      maxtime = CustomText.getLimitValue();
    }
    if (Config.timerStyle === "bar") {
      const percent = 100 - ((time + 1) / maxtime) * 100;
      getBarEl()
        .stop(true, true)
        .animate(
          {
            width: percent + "vw",
          },
          SlowTimer.get() ? 0 : 1000,
          "linear"
        );
    } else if (Config.timerStyle === "text") {
      let displayTime = DateTime.secondsToString(maxtime - time);
      if (maxtime === 0) {
        displayTime = DateTime.secondsToString(time);
      }
      if (getTimerNumberElement() !== null) {
        getTimerNumberElement().innerHTML = "<div>" + displayTime + "</div>";
      }
    } else if (Config.timerStyle === "mini") {
      let displayTime = DateTime.secondsToString(maxtime - time);
      if (maxtime === 0) {
        displayTime = DateTime.secondsToString(time);
      }
      if (getMiniTimerNumberElement() !== null) {
        getMiniTimerNumberElement().innerHTML = displayTime;
      }
    }
  } else if (
    Config.mode === "words" ||
    Config.mode === "custom" ||
    Config.mode === "quote"
  ) {
    let outof = TestWords.words.length;
    if (Config.mode === "words") {
      outof = Config.words;
    }
    if (Config.mode === "custom") {
      outof = CustomText.getLimitValue();
    }
    if (Config.mode === "quote") {
      outof = TestWords.currentQuote?.textSplit.length ?? 1;
    }
    if (Config.timerStyle === "bar") {
      const percent = Math.floor(
        ((TestState.activeWordIndex + 1) / outof) * 100
      );
      getBarEl()
        .stop(true, true)
        .animate(
          {
            width: percent + "vw",
          },
          SlowTimer.get() ? 0 : 250
        );
    } else if (Config.timerStyle === "text") {
      if (outof === 0) {
        if (getTimerNumberElement() !== null) {
          getTimerNumberElement().innerHTML = `<div>${
            TestInput.input.getHistory().length
          }</div>`;
        }
      } else {
        if (getTimerNumberElement() !== null) {
          getTimerNumberElement().innerHTML = `<div>${getCurrentCount()}/${outof}</div>`;
        }
      }
    } else if (Config.timerStyle === "mini") {
      if (outof === 0) {
        if (getMiniTimerNumberElement() !== null) {
          getMiniTimerNumberElement().innerHTML = `${
            TestInput.input.getHistory().length
          }`;
        }
      } else {
        if (getMiniTimerNumberElement() !== null) {
          getMiniTimerNumberElement().innerHTML = `${getCurrentCount()}/${outof}`;
        }
      }
    }
  } else if (Config.mode === "zen") {
    if (Config.timerStyle === "text") {
      if (getTimerNumberElement() !== null) {
        getTimerNumberElement().innerHTML = `<div>${
          TestInput.input.getHistory().length
        }</div>`;
      }
    } else {
      if (getMiniTimerNumberElement() !== null) {
        getMiniTimerNumberElement().innerHTML = `${
          TestInput.input.getHistory().length
        }`;
      }
    }
  }
}

export function updateStyle(): void {
  if (!TestState.isActive) return;
  hide();
  update();
  if (Config.timerStyle === "off") return;
  setTimeout(() => {
    show();
  }, 125);
}

ConfigEvent.subscribe((eventKey, eventValue) => {
  if (eventKey === "timerStyle") updateStyle();
});
