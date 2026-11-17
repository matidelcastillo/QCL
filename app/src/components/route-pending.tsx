import { BrandHeader } from "./brand-header";
import { LoadingPage } from "./feedback";

export function RoutePending() {
  return (
    <main className="page-pb-nav">
      <BrandHeader />
      <div className="feed app-gutter">
        <LoadingPage />
      </div>
    </main>
  );
}
