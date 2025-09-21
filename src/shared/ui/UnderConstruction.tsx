import logoAsset from "@/shared/assets/skyshare-logo.png";

export function UnderConstruction() {
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
          src={logoAsset}
          alt="SkyShare logo"
          className="mx-auto mb-4 h-20 w-20"
        />
        <p className="text-muted-foreground">
          Our SkyShare crew is busy teaching clouds to carpool—this feature will be
          cleared for takeoff before you can say "in-flight Wi-Fi." Thanks for cruising with us!
        </p>
      </div>
    </div>
  );
}
