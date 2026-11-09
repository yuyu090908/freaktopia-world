import { ErrorState } from "@/components/ui/States";

export default function NotFound() {
  return <ErrorState title="Lost in space" body="このページは見つかりませんでした。別の惑星に移動したのかも。" />;
}
