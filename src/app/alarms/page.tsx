import { Suspense } from "react";
import { AlarmConsole } from "@/features/operations/alarm-console";

/**
 * The console reads `?id=` and `?status=` from the URL so a notification can
 * link straight to a record. useSearchParams needs a Suspense boundary during
 * prerendering, so it is declared here rather than inside the console.
 */
export default function AlarmsPage() {
  return (
    <Suspense fallback={null}>
      <AlarmConsole />
    </Suspense>
  );
}
