import type { PluginServerContext } from "@getpaseo/plugin/server";
import { sourceControlSettings } from "./shared/settings.js";
import { cancelRequestRpc, getDiffRpc, getHistoryRpc, getRevisionRpc, getStatusRpc, listRepositoriesRpc } from "./shared/source-control.js";
import { Requests } from "./server/process.js";
import { discover, validateRepository } from "./server/discovery.js";
import { diff, history, revision, status } from "./server/adapters.js";

export default function contribute(server: PluginServerContext) {
  server.registerSettings(sourceControlSettings);
  const requests = new Requests();
  server.handle(cancelRequestRpc, ({ requestKey }) => ({ cancelled: requests.cancel(requestKey) }));
  server.handle(listRepositoriesRpc, (input) => requests.execute(input.requestKey, (signal) => discover(input, signal)));
  server.handle(getStatusRpc, (input) => requests.execute(input.requestKey, async (signal) => status(await validateRepository(input.repository, signal), signal)));
  server.handle(getDiffRpc, (input) => requests.execute(input.requestKey, async (signal) => diff(await validateRepository(input.repository, signal), input.path, input.mode, signal)));
  server.handle(getHistoryRpc, (input) => requests.execute(input.requestKey, async (signal) => history(await validateRepository(input.repository, signal), input.limit, input.cursor, signal)));
  server.handle(getRevisionRpc, (input) => requests.execute(input.requestKey, async (signal) => revision(await validateRepository(input.repository, signal), input.revision, signal)));
  return () => requests.dispose();
}
