import type {Metadata, Viewport} from "next";
import {Public_Sans, Source_Serif_4} from "next/font/google";
import type {ReactNode} from "react";
import SiteNav from "./SiteNav";
import {WalletProvider} from "./WalletProvider";
import "./globals.css";

const SITE_URL = process.env.SITE_URL ?? "https://thesisindex.vercel.app";

/*
 * Two faces, each with a job.
 *
 * The serif carries words and the figures that matter — it is what makes this read as a
 * published instrument rather than a dashboard. The sans carries labels and tables, and
 * is here for one technical reason: real tabular figures, so a column of NAVs aligns.
 */
const serif = Source_Serif_4({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-serif"
});

const sans = Public_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans"
});

export const metadata: Metadata = {
  // Pins social card URLs to one canonical host. Without it Next derives them from
  // whichever deployment URL served the request, so a link shared from one alias
  // advertises an image on another.
  metadataBase: new URL(SITE_URL),
  title: "Thesis — index launchpad for tokenized equities",
  description:
    "Anyone can launch an index. Describe a theme, deploy it as a fully backed basket of tokenized equities on X Layer, and earn a share of every mint.",
  openGraph: {
    title: "Thesis — index launchpad for tokenized equities",
    description:
      "Anyone can launch an index. Fully backed baskets of tokenized equities on X Layer, deployed by anyone, in one transaction.",
    type: "website"
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // One ground, light. The design does not have a dark variant to switch to.
  themeColor: "#f7f2ea"
};

export default function RootLayout({children}: {children: ReactNode}) {
  // Read on the server at request time. A NEXT_PUBLIC_ variable is inlined at build
  // time instead, which silently does nothing if it is set after the last deploy.
  const builderCode = process.env.BUILDER_CODE ?? process.env.NEXT_PUBLIC_BUILDER_CODE;

  return (
    <html lang="en" className={`${serif.variable} ${sans.variable}`}>
      <body>
        <WalletProvider builderCode={builderCode}>
          <SiteNav />
          {children}
        </WalletProvider>
      </body>
    </html>
  );
}
