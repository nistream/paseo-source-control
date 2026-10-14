import { defineSettings } from "@getpaseo/plugin";
import { sourceControlSettingsSchema } from "./source-control.js";

export const sourceControlSettings = defineSettings({
  id: "source-control",
  scope: "host",
  version: 1,
  schema: sourceControlSettingsSchema,
});
