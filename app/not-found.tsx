import { useTranslations } from "next-intl";
import { ErrorState } from "@/components/ui/States";

export default function NotFound() {
  const tu = useTranslations("pages");
  return <ErrorState title={tu("lostInSpace")} body={tu("text5")} />;
}
