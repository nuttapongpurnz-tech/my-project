import { Suspense } from "react";
import { MachineConsole } from "@/features/operations/machine-console";

/**
 * The console reads `?q=` and `?status=` from the URL so a machine on the
 * dashboard can be a link rather than a label. useSearchParams needs a Suspense
 * boundary during prerendering, so it is declared here.
 */
export default function MachinesPage() {
  return (
    <Suspense fallback={null}>
      <MachineConsole />
    </Suspense>
  );
}
