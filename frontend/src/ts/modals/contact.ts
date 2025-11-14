import SlimSelect from "slim-select";
import AnimatedModal from "../utils/animated-modal";

let select: SlimSelect | undefined = undefined;

export function show(): void {
  void modal.show({
    beforeAnimation: async (modalEl) => {
      select = new SlimSelect({
        select: modalEl.querySelector(
          "select[name='contactType']"
        ) as HTMLElement,
        data: [
          { text: "Question", value: "Question" },
          { text: "Feedback", value: "Feedback" },
          { text: "Bug Report", value: "Bug Report" },
          { text: "Suggestion", value: "Suggestion" },
          { text: "Other", value: "Other" },
        ],
        settings: {
          contentLocation: modalEl,
        },
      });

      const cancelButton = modalEl.querySelector(".cancelBtn");
      cancelButton?.addEventListener("click", () => {
        void modal.hide();
      });
    },
  });
}

const modal = new AnimatedModal({
  dialogId: "contactModal",
  cleanup: async (): Promise<void> => {
    select?.destroy();
    select = undefined;
  },
});
