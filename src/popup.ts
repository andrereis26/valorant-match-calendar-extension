import { mountMatchListView } from "./ui/matchListView";
import { extensionStorage } from "./platform/extension/storage";
import { openLink, openSettings } from "./platform/extension/links";

mountMatchListView({
  storage: extensionStorage,
  openLink,
  openSettings
});
