import { Suspense } from "react";
import { MaintenanceConsole } from "@/features/operations/maintenance-console";

/**
 * The console reads `?id=` and `?status=` from the URL so a link can land on one
 * record. useSearchParams needs a Suspense boundary during prerendering, so it
 * is declared here rather than inside the console.
 */
export default function MaintenancePage() {
  return (
    <Suspense fallback={null}>
      <MaintenanceConsole />
    </Suspense>
  );
}
