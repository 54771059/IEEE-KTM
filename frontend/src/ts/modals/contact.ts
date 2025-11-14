/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/strict-boolean-expressions */
import SlimSelect from "slim-select";
import AnimatedModal from "../utils/animated-modal";
import { InputIndicator } from "../elements/input-indicator";
import { z } from "zod";
import * as Notifications from "../elements/notifications";
import * as Loader from "../elements/loader";

let select: SlimSelect | undefined = undefined;
let nameIndicator: InputIndicator | undefined = undefined;
let emailIndicator: InputIndicator | undefined = undefined;
let contactTypeIndicator: InputIndicator | undefined = undefined;
let messageIndicator: InputIndicator | undefined = undefined;

const nameSchema = z
  .string()
  .min(1, "Name is required")
  .max(100, "Name is too long");
const emailSchema = z.string().email("Please enter a valid email address");
const contactTypeSchema = z.enum(
  ["Question", "Feedback", "Bug Report", "Suggestion", "Other"],
  { errorMap: () => ({ message: "Please select a contact type" }) }
);
const messageSchema = z
  .string()
  .min(10, "Message must be at least 10 characters")
  .max(2000, "Message is too long");

function addValidation(
  element: HTMLElement,
  schema: z.ZodSchema,
  indicator: InputIndicator
): void {
  const $element = $(element);
  $element.on("input", () => {
    const value = (
      element as HTMLInputElement | HTMLTextAreaElement
    ).value.trim();
    if (value === "") {
      indicator.hide();
      return;
    }
    const validationResult = schema.safeParse(value);
    if (!validationResult.success) {
      indicator.show(
        "invalid",
        validationResult.error.errors.map((err) => err.message).join(", ")
      );
      return;
    }
    indicator.show("valid");
  });
}

async function submitContactForm(
  form: HTMLFormElement,
  modalEl: HTMLElement
): Promise<void> {
  const formData = new FormData(form);
  const name = (formData.get("name") as string)?.trim() || "";
  const email = (formData.get("email") as string)?.trim() || "";
  // Get contact type from SlimSelect if available, otherwise from form
  const contactTypeSelect = modalEl.querySelector(
    "select[name='contactType']"
  ) as HTMLSelectElement;
  const contactType =
    select?.getSelected()[0]?.value || contactTypeSelect?.value || "";
  const message = (formData.get("message") as string)?.trim() || "";

  // Validate all fields and show indicators
  const nameValidation = nameSchema.safeParse(name);
  const emailValidation = emailSchema.safeParse(email);
  const contactTypeValidation = contactTypeSchema.safeParse(contactType);
  const messageValidation = messageSchema.safeParse(message);

  let hasErrors = false;

  // Validate and show indicator for name
  if (!nameValidation.success) {
    nameIndicator?.show(
      "invalid",
      nameValidation.error.errors.map((err) => err.message).join(", ")
    );
    hasErrors = true;
  } else if (name) {
    nameIndicator?.show("valid");
  } else {
    nameIndicator?.show("invalid", "Name is required");
    hasErrors = true;
  }

  // Validate and show indicator for email
  if (!emailValidation.success) {
    emailIndicator?.show(
      "invalid",
      emailValidation.error.errors.map((err) => err.message).join(", ")
    );
    hasErrors = true;
  } else if (email) {
    emailIndicator?.show("valid");
  } else {
    emailIndicator?.show("invalid", "Email is required");
    hasErrors = true;
  }

  // Validate and show indicator for contact type
  if (!contactTypeValidation.success) {
    contactTypeIndicator?.show(
      "invalid",
      contactTypeValidation.error.errors.map((err) => err.message).join(", ")
    );
    hasErrors = true;
  } else if (contactType) {
    contactTypeIndicator?.show("valid");
  } else {
    contactTypeIndicator?.show("invalid", "Please select a contact type");
    hasErrors = true;
  }

  // Validate and show indicator for message
  if (!messageValidation.success) {
    messageIndicator?.show(
      "invalid",
      messageValidation.error.errors.map((err) => err.message).join(", ")
    );
    hasErrors = true;
  } else if (message) {
    messageIndicator?.show("valid");
  } else {
    messageIndicator?.show("invalid", "Message is required");
    hasErrors = true;
  }

  if (hasErrors) {
    Notifications.add("Please fix the errors in the form", 0);
    return;
  }

  Loader.show();
  try {
    const response = await fetch("/send-contact", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        name,
        email,
        contactType,
        message,
      }),
    });

    const data = await response.json();

    if (response.ok && data.message === "Message sent successfully") {
      Notifications.add("Message sent successfully!", 1);
      form.reset();
      nameIndicator?.hide();
      emailIndicator?.hide();
      contactTypeIndicator?.hide();
      messageIndicator?.hide();
      void modal.hide();
    } else {
      Notifications.add(
        data.message || "Failed to send message. Please try again.",
        -1
      );
    }
  } catch (error) {
    Notifications.add(
      "An error occurred while sending your message. Please try again later.",
      -1
    );
  } finally {
    Loader.hide();
  }
}

export function show(): void {
  void modal.show({
    beforeAnimation: async (modalEl) => {
      const cancelButton = modalEl.querySelector(".cancelBtn");
      cancelButton?.addEventListener("click", () => {
        void modal.hide();
      });

      // Initialize validation indicators first
      const nameInput = modalEl.querySelector("#name") as HTMLInputElement;
      const emailInput = modalEl.querySelector("#email") as HTMLInputElement;
      const contactTypeSelect = modalEl.querySelector(
        "select[name='contactType']"
      ) as HTMLSelectElement;
      const messageTextarea = modalEl.querySelector(
        "#message"
      ) as HTMLTextAreaElement;

      // Initialize contact type indicator before SlimSelect
      contactTypeIndicator = new InputIndicator($(contactTypeSelect), {
        valid: {
          icon: "fa-check",
          level: 1,
        },
        invalid: {
          icon: "fa-times",
          level: -1,
        },
      });

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
        events: {
          afterChange: (newVal) => {
            const value = newVal[0]?.value as string;
            if (!value || value === "") {
              contactTypeIndicator?.hide();
              return;
            }
            const validationResult = contactTypeSchema.safeParse(value);
            if (!validationResult.success) {
              contactTypeIndicator?.show(
                "invalid",
                validationResult.error.errors
                  .map((err) => err.message)
                  .join(", ")
              );
              return;
            }
            contactTypeIndicator?.show("valid");
          },
        },
      });

      nameIndicator = new InputIndicator($(nameInput), {
        valid: {
          icon: "fa-check",
          level: 1,
        },
        invalid: {
          icon: "fa-times",
          level: -1,
        },
      });

      emailIndicator = new InputIndicator($(emailInput), {
        valid: {
          icon: "fa-check",
          level: 1,
        },
        invalid: {
          icon: "fa-times",
          level: -1,
        },
      });

      messageIndicator = new InputIndicator($(messageTextarea), {
        valid: {
          icon: "fa-check",
          level: 1,
        },
        invalid: {
          icon: "fa-times",
          level: -1,
        },
      });

      // Add validation to inputs
      addValidation(nameInput, nameSchema, nameIndicator);
      addValidation(emailInput, emailSchema, emailIndicator);
      addValidation(messageTextarea, messageSchema, messageIndicator);

      // Handle form submission
      const form = modalEl.querySelector(".contactForm") as HTMLFormElement;
      if (form) {
        form.addEventListener("submit", async (e) => {
          e.preventDefault();
          await submitContactForm(form, modalEl);
        });
      }
    },
  });
}

const modal = new AnimatedModal({
  dialogId: "contactModal",
  cleanup: async (): Promise<void> => {
    select?.destroy();
    select = undefined;
    nameIndicator = undefined;
    emailIndicator = undefined;
    contactTypeIndicator = undefined;
    messageIndicator = undefined;
  },
});
