import * as PageController from "./page-controller";
import * as TestUI from "../test/test-ui";
import * as PageTransition from "../states/page-transition";
import { Auth, isAuthenticated } from "../firebase";
import { isFunboxActive } from "../test/funbox/list";
import * as TestState from "../test/test-state";
import * as Notifications from "../elements/notifications";
import * as ContestMode from "../states/contest-mode";

//source: https://www.youtube.com/watch?v=OstALBk-jTc
// https://www.youtube.com/watch?v=OstALBk-jTc

//this will be used in tribe
type NavigateOptions = {
  empty?: boolean;
  data?: unknown;
};

function pathToRegex(path: string): RegExp {
  return new RegExp(
    "^" + path.replace(/\//g, "\\/").replace(/:\w+/g, "(.+)") + "$"
  );
}

function getParams(match: {
  route: Route;
  result: RegExpMatchArray;
}): Record<string, string> {
  const values = match.result.slice(1);
  const keys = Array.from(match.route.path.matchAll(/:(\w+)/g)).map(
    (result) => result[1]
  );

  const a = keys.map((key, index) => [key, values[index]]);
  return Object.fromEntries(a) as Record<string, string>;
}

type Route = {
  path: string;
  load: (
    params: Record<string, string>,
    navigateOptions: NavigateOptions
  ) => void;
};

const route404: Route = {
  path: "404",
  load: (): void => {
    // Exit contest mode when navigating to 404 page
    if (ContestMode.isContestMode()) {
      ContestMode.exitContestMode();
    }
    void PageController.change("404");
  },
};

const routes: Route[] = [
  {
    path: "/",
    load: (): void => {
      // Exit contest mode when navigating to home page manually
      // (but not when joining a contest)
      if (ContestMode.isContestMode()) {
        // Check if this navigation is from a contest join (has activeContest but no URL contest param)
        const urlParams = new URLSearchParams(window.location.search);
        const contestParam = urlParams.get("contest");

        // Exit contest mode only if not joining contest
        if (contestParam !== "true") {
          ContestMode.exitContestMode();
        }
      }
      void PageController.change("test");
    },
  },
  {
    path: "/verify",
    load: (): void => {
      // Exit contest mode when navigating to verify page
      if (ContestMode.isContestMode()) {
        ContestMode.exitContestMode();
      }
      void PageController.change("test");
    },
  },
  {
    path: "/leaderboards",
    load: (): void => {
      // Exit contest mode when navigating to leaderboards
      if (ContestMode.isContestMode()) {
        ContestMode.exitContestMode();
      }
      void PageController.change("leaderboards");
    },
  },
  {
    path: "/contests",
    load: (): void => {
      // Exit contest mode when navigating to contests page
      if (ContestMode.isContestMode()) {
        ContestMode.exitContestMode();
      }
      void PageController.change("contests");
    },
  },
  {
    path: "/contest",
    load: (): void => {
      // Redirect to test page with contest mode enabled
      navigate("/?contest=true");
    },
  },
  {
    path: "/about",
    load: (): void => {
      // Exit contest mode when navigating to about
      if (ContestMode.isContestMode()) {
        ContestMode.exitContestMode();
      }
      void PageController.change("about");
    },
  },
  {
    path: "/settings",
    load: (): void => {
      // Exit contest mode when navigating to settings
      if (ContestMode.isContestMode()) {
        ContestMode.exitContestMode();
      }
      void PageController.change("settings");
    },
  },
  {
    path: "/login",
    load: (): void => {
      if (!Auth) {
        navigate("/");
        return;
      }
      if (isAuthenticated()) {
        navigate("/account");
        return;
      }
      // Exit contest mode when navigating to login
      if (ContestMode.isContestMode()) {
        ContestMode.exitContestMode();
      }
      void PageController.change("login");
    },
  },
  {
    path: "/account",
    load: (_params, options): void => {
      if (!Auth) {
        navigate("/");
        return;
      }
      // Exit contest mode when navigating to account
      if (ContestMode.isContestMode()) {
        ContestMode.exitContestMode();
      }
      void PageController.change("account", {
        data: options.data,
      });
    },
  },
  {
    path: "/account-settings",
    load: (_params, options): void => {
      if (!Auth) {
        navigate("/");
        return;
      }
      if (!isAuthenticated()) {
        navigate("/login");
        return;
      }
      // Exit contest mode when navigating to account settings
      if (ContestMode.isContestMode()) {
        ContestMode.exitContestMode();
      }
      void PageController.change("accountSettings", {
        data: options.data,
      });
    },
  },
  {
    path: "/profile",
    load: (_params): void => {
      // Exit contest mode when navigating to profile search
      if (ContestMode.isContestMode()) {
        ContestMode.exitContestMode();
      }
      void PageController.change("profileSearch");
    },
  },
  {
    path: "/profile/:uidOrName",
    load: (params, options): void => {
      // Exit contest mode when navigating to profile
      if (ContestMode.isContestMode()) {
        ContestMode.exitContestMode();
      }
      void PageController.change("profile", {
        force: true,
        params: {
          uidOrName: params["uidOrName"] as string,
        },
        data: options.data,
      });
    },
  },
];

export function navigate(
  url = window.location.pathname + window.location.search,
  options = {} as NavigateOptions
): void {
  if (
    TestUI.testRestarting ||
    TestUI.resultCalculating ||
    PageTransition.get()
  ) {
    console.debug(
      `navigate: ${url} ignored, page is busy (testRestarting: ${
        TestUI.testRestarting
      }, resultCalculating: ${
        TestUI.resultCalculating
      }, pageTransition: ${PageTransition.get()})`
    );
    return;
  }

  const noQuit = isFunboxActive("no_quit");
  if (TestState.isActive && noQuit) {
    Notifications.add("No quit funbox is active. Please finish the test.", 0, {
      important: true,
    });
    event?.preventDefault();
    return;
  }

  url = url.replace(/\/$/, "");
  if (url === "") url = "/";

  // only push to history if we're navigating to a different URL
  const currentUrl = new URL(window.location.href);
  const targetUrl = new URL(url, window.location.origin);

  if (
    currentUrl.pathname + currentUrl.search + currentUrl.hash !==
    targetUrl.pathname + targetUrl.search + targetUrl.hash
  ) {
    history.pushState(null, "", url);
  }

  void router(options);
}

async function router(options = {} as NavigateOptions): Promise<void> {
  const matches = routes.map((r) => {
    return {
      route: r,
      result: location.pathname.match(pathToRegex(r.path)),
    };
  });

  const match = matches.find((m) => m.result !== null) as {
    route: Route;
    result: RegExpMatchArray;
  };

  if (match === undefined) {
    route404.load({}, {});
    return;
  }

  match.route.load(getParams(match), options);
}

window.addEventListener("popstate", () => {
  void router();
});

document.addEventListener("DOMContentLoaded", () => {
  document.body.addEventListener("click", (e) => {
    const target = e?.target as HTMLLinkElement;
    if (target.matches("[router-link]") && target?.href) {
      e.preventDefault();
      navigate(target.href);
    }
  });
});
