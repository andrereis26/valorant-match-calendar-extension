import { mountMatchListView } from "./ui/matchListView";
import { pwaStorage } from "./platform/pwa/storage";
import { openLink, openSettings } from "./platform/pwa/links";
import { registerServiceWorker } from "./platform/pwa/registerServiceWorker";

registerServiceWorker();

mountMatchListView({
  storage: pwaStorage,
  openLink,
  openSettings
});
