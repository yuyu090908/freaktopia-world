import { Noto_Sans } from "next/font/google";
const font = Noto_Sans({ subsets: ["cyrillic", "vietnamese", "latin-ext"], variable: "--font-noto", display: "swap", preload: false });
export default font;
