"use client";

import { NewReadingWorkspace } from "@/components/new-reading/NewReadingWorkspace";

/** @deprecated The /new page now composes its manuscript workspace from focused components. */
export default function RitualInitializer() {
  return <NewReadingWorkspace />;
}
