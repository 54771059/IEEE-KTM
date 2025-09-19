import Ape from "../ape";
import { isAuthenticated } from "../firebase";

let isAdminCache: boolean | null = null;
let lastCheckTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Checks if the current user has admin permissions
 * Uses caching to avoid repeated API calls
 */
export async function isCurrentUserAdmin(): Promise<boolean> {
  // Return false if not authenticated
  if (!isAuthenticated()) {
    return false;
  }

  const now = Date.now();

  // Return cached result if it's still valid
  if (isAdminCache !== null && now - lastCheckTime < CACHE_DURATION) {
    return isAdminCache;
  }

  try {
    console.log("DEBUG: Checking admin status...");
    const response = await Ape.admin.test();

    // Type guard to check if response is successful
    if (
      response !== null &&
      typeof response === "object" &&
      "status" in response &&
      response.status === 200
    ) {
      isAdminCache = true;
      lastCheckTime = now;
      console.log("DEBUG: User is admin - UID is in admin-uids collection");
      return true;
    } else {
      isAdminCache = false;
      lastCheckTime = now;
      const status = (response as { status?: number })?.status;
      console.log("DEBUG: User is not admin - response status:", status);
      return false;
    }
  } catch (error) {
    console.log(
      "DEBUG: Admin check failed - user UID not in admin-uids collection or other error:",
      error
    );
    isAdminCache = false;
    lastCheckTime = now;
    return false;
  }
}

/**
 * Clears the admin status cache
 * Useful when user logs in/out or when permissions might have changed
 */
export function clearAdminCache(): void {
  isAdminCache = null;
  lastCheckTime = 0;
}
