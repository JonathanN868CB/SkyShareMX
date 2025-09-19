export function UnderConstruction() {
  return (
    <div className="flex items-center justify-center h-full min-h-[400px]">
      <div className="text-center">
        <div className="text-6xl mb-4">🚧</div>
        <h1 className="text-2xl font-heading font-semibold text-foreground mb-2">
          Under Construction
        </h1>
        <p className="text-muted-foreground">
          This page is coming soon. We're working hard to bring you something amazing! 😅
        </p>
      </div>
    </div>
  );
}