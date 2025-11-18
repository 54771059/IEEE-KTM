import { initServer } from "@ts-rest/express";
import { contactContract } from "@monkeytype/contracts/contact";
import * as ContactController from "../controllers/contact";
import { callController } from "../ts-rest-adapter";

const s = initServer();

export default s.router(contactContract, {
  send: {
    handler: async (r) =>
      callController(ContactController.sendContactMessage)(r),
  },
});
