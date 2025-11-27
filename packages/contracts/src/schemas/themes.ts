import { z } from "zod";
import { customEnumErrorHandler } from "./util";

export const ThemeNameSchema = z.enum(["dark"], {
  errorMap: customEnumErrorHandler("Must be a known theme"),
});
