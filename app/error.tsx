"use client";

import { useTranslations } from "next-intl";
import { ErrorState } from "@/components/ui/States";
import { Button } from "@/components/ui/primitives";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  const tu = useTranslations("pages");
  return <ErrorState retry={<Button onClick={reset}>{tu("tryAgain")}</Button>} />;
}
