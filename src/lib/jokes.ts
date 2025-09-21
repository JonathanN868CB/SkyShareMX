export const JOKES: string[] = [
  "This page’s in the hangar for a quick turn—back in service before the coffee cools.",
  "We’re torqueing a few bolts on this feature. Taxi back shortly.",
  "Crew’s refueling the Wi-Fi and cleaning the windscreen. Wheels up soon.",
  "This module’s on a short maintenance hold—consider it MEL’d for a minute.",
  "Teaching the clouds to carpool was harder than briefed. Back after a quick pit stop.",
  "On jacks for a fast inspection—expect a green light any moment.",
  "We filed a flight plan for this page; just waiting on a pushback.",
  "Brief delay while we swap a virtual tire. Snacks and progress coming right up.",
  "Avionics are rebooting—someone pressed “CTRL+Alt+Autopilot” again.",
  "Quick oil top-off on the code. No leaks, just vibes.",
  "Our A&P says it’s a five-minute fix. You know what that means—about five minutes.",
  "Holding short while Dispatch argues with the loading spinner.",
  "Doing a logbook entry so the FAA bots stay happy.",
  "We’re de-icing a few pixels. Expect a smooth departure.",
  "This page failed the pocket-check—repacking and relaunching.",
  "Cabin crew is reseating the buttons by the windows. Much better UX coming up.",
];

const STORAGE_KEY_PREFIX = "mx:joke:";

const dayOfYear = () => {
  const d = new Date();
  const start = new Date(d.getFullYear(), 0, 0);
  return Math.floor((d.getTime() - start.getTime()) / 86400000);
};

const getStorage = () => {
  if (
    typeof window === "undefined" ||
    typeof window.localStorage === "undefined"
  ) {
    return null;
  }

  try {
    return window.localStorage;
  } catch (error) {
    return null;
  }
};

export function nextJoke(moduleKey: string): string {
  const storage = getStorage();

  if (!storage) {
    return JOKES[dayOfYear() % JOKES.length];
  }

  const key = `${STORAGE_KEY_PREFIX}${moduleKey}`;
  const base = Number(storage.getItem(key) || "0");
  const index = (base + dayOfYear()) % JOKES.length;

  try {
    storage.setItem(key, String((base + 1) % JOKES.length));
  } catch (error) {
    // Ignore storage write failures (e.g., Safari private mode)
  }

  return JOKES[index];
}
