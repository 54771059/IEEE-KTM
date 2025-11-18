/* eslint-disable @typescript-eslint/strict-boolean-expressions */
import { MonkeyRequest } from "../types";
import { MonkeyResponse } from "../../utils/monkey-response";
import MonkeyError from "../../utils/error";
import {
  SendContactRequest,
  SendContactResponse,
} from "@monkeytype/contracts/contact";
import { Resend } from "resend";

// Initialize Resend client
const resendApiKey = process.env["RESEND_API_KEY"];
// eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
if (!resendApiKey || resendApiKey.trim() === "") {
  throw new Error("RESEND_API_KEY is not set");
}
const resend = new Resend(resendApiKey);

export async function sendContactMessage(
  req: MonkeyRequest<undefined, SendContactRequest>
): Promise<SendContactResponse> {
  const { name, email, contactType, message } = req.body;

  const receiverEmail = process.env["CONTACT_RECEIVER_EMAIL"];
  // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
  const fromEmail = process.env["RESEND_FROM_EMAIL"] || receiverEmail;

  if (!receiverEmail || receiverEmail.trim() === "") {
    throw new MonkeyError(
      500,
      "Contact receiver email is not configured on the server"
    );
  }

  if (!fromEmail || fromEmail.trim() === "") {
    throw new MonkeyError(
      500,
      "Resend from email is not configured on the server"
    );
  }

  // Format contactType
  const formattedContactType =
    contactType.charAt(0).toUpperCase() + contactType.slice(1);
  const subjectPrefix = `[${formattedContactType}]`;

  // Email HTML
  const htmlMessage = `
  <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f9f9f9;">
    <div style="max-width: 600px; margin: auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
      <div style="background-color: #00629b; color: #ffffff; padding: 16px; text-align: center; font-size: 20px; font-weight: bold;">
        New Contact Message
      </div>
      <div style="padding: 16px; color: #333333; line-height: 1.5;">
        <p><strong style="color: #55943a;">Name:</strong> ${name}</p>
        <p><strong style="color: #55943a;">Email:</strong> ${email}</p>
        <p><strong style="color: #55943a;">Contact Type:</strong> ${formattedContactType}</p>
        <p style="margin-top: 12px; white-space: pre-wrap;">${message}</p>
      </div>
      <div style="background-color: #f0f0f0; text-align: center; padding: 12px; font-size: 12px; color: #666666;">
        &copy; 2025 Your Company. All rights reserved.
      </div>
    </div>
  </div>
`;

  try {
    const sendResult = await resend.emails.send({
      from: `IEEE Contact Form <${fromEmail}>`,
      to: receiverEmail,
      subject: `${subjectPrefix} New Contact Form Submission`,
      html: htmlMessage,
      replyTo: email,
    });

    // Handle Resend errors explicitly
    if (sendResult.error) {
      const errorDetails = sendResult.error as {
        message?: string;
        name?: string;
      };
      // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
      const errorMessage =
        errorDetails.message || errorDetails.name || "Unknown Resend error";

      if (
        errorMessage.toLowerCase().includes("rate limit") ||
        errorMessage.toLowerCase().includes("too many requests")
      ) {
        throw new MonkeyError(
          429,
          "Too many requests. Please wait a moment before submitting again."
        );
      }

      throw new MonkeyError(
        500,
        `Failed to send contact email: ${errorMessage}`
      );
    }

    return new MonkeyResponse("Contact message sent", { success: true });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    console.error("Resend error:", err);
    throw new MonkeyError(
      500,
      `Failed to send contact message: ${errorMessage}`
    );
  }
}
