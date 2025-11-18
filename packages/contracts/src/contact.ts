import { z } from "zod";
import { initContract } from "@ts-rest/core";
import {
  CommonResponses,
  meta,
  MonkeyClientError,
  responseWithData,
} from "./schemas/api";

/**
 * You should define the valid options for `contactType`
 * to make the schema more robust. For example:
 * z.enum(['support', 'sales', 'general'])
 */
export const SendContactRequestSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  // 🆕 Added 'contactType' field
  contactType: z.string().min(1, { message: "Contact type is required" }),
  message: z.string().min(1),
});
export type SendContactRequest = z.infer<typeof SendContactRequestSchema>;

// Schema for the response of /send (remains unchanged)
export const SendContactResponseSchema = responseWithData(
  z.object({ success: z.boolean() })
);
export type SendContactResponse = z.infer<typeof SendContactResponseSchema>;

// Contract
const c = initContract();

export const contactContract = c.router(
  {
    send: {
      summary: "Send a contact message",
      description: "Submit a contact form message.",
      method: "POST",
      path: "/send",
      // --- Uses the updated schema ---
      body: SendContactRequestSchema,
      responses: {
        200: SendContactResponseSchema,
        400: MonkeyClientError,
        422: MonkeyClientError,
      },
      metadata: meta({
        authenticationOptions: { isPublic: true },
        rateLimit: "contactSend",
      }),
    },
  },
  {
    pathPrefix: "/contact",
    strictStatusCodes: true,
    commonResponses: CommonResponses,
  }
);
