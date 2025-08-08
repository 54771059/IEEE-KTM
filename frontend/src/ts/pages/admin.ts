import Page from "./page";

export const page = new Page({
  id: "admin",
  element: $("#adminPage"),
  path: "/admin",
  afterHide: async (): Promise<void> => {
    // Any cleanup logic when leaving the admin page
  },
  beforeShow: async (): Promise<void> => {
    // Any initialization logic when entering the admin page
  },
});
