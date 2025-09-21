import { nextJoke } from "@/lib/jokes";

export function UnderConstruction() {
  const jokeLine = nextJoke("under-construction");

  return (
    <div className="flex items-center justify-center h-full min-h-[400px]">
      <div className="text-center">
        <div className="text-6xl mb-4" aria-hidden="true">
          🚧
        </div>
        <h1 className="text-2xl font-heading font-semibold text-foreground mb-4">
          Under Construction
        </h1>
        <img
          src="/logo__lockup__horizontal__blackmagic.png"
          alt="SkyShare"
          className="mx-auto mt-4 mb-2 h-10 w-auto opacity-80"
          loading="lazy"
        />
        <p className="text-sm text-muted-foreground mb-4">{jokeLine}</p>
        <p className="text-muted-foreground">
          Our SkyShare crew is busy teaching clouds to carpool—this feature will
          be cleared for takeoff before you can say "in-flight Wi-Fi." Thanks
          for cruising with us!
        </p>
      </div>
    </div>
  );
}
