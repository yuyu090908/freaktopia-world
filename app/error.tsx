"use client";

import { ErrorState } from "@/components/ui/States";
import { Button } from "@/components/ui/primitives";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return <ErrorState retry={<Button onClick={reset}>Try again</Button>} />;
}
