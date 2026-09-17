import localFont from "next/font/local";

export const mileast = localFont({
  src: [
    {
      path: "../../public/fonts/Mileast Italic.otf",
      weight: "400",
      style: "italic",
    },
    {
      path: "../../public/fonts/Mileast.otf",
      weight: "400",
      style: "normal",
    },
  ],
  variable: "--font-mileast",
  display: "swap",
});
