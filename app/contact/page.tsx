import type { Metadata } from "next";
import { InfoPage } from "@/components/layout/InfoPage";
import { ContactForm } from "./ContactForm";

export const metadata: Metadata = { title: "Contact", description: "Get in touch with the FREAKTOPIA team." };

export default function Page() {
  return (
    <InfoPage kicker="Contact" title="Say hello" sub="お問い合わせフォーム（デモ）。送信内容は実際には送られません。">
      <ContactForm />
    </InfoPage>
  );
}
