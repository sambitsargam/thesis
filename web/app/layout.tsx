import type {Metadata, Viewport} from "next";
import type {ReactNode} from "react";
import SiteNav from "./SiteNav";
import {WalletProvider} from "./WalletProvider";
import "./globals.css";

const SITE_URL = process.env.SITE_URL ?? "https://thesisindex.vercel.app";

export const metadata: Metadata = {
  // Pins social card URLs to one canonical host. Without it Next derives them from
  // whichever deployment URL served the request, so a link shared from one alias
  // advertises an image on another.
  metadataBase: new URL(SITE_URL),
  title: "Thesis — index launchpad for tokenized equities",
  description:
    "Describe an investment theme and deploy a fully backed basket of tokenized equities on X Layer in one transaction.",
  openGraph: {
    title: "Thesis — index launchpad for tokenized equities",
    description:
      "Turn a theme into one holdable asset. Fully backed baskets of tokenized equities on X Layer.",
    type: "website"
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    {media: "(prefers-color-scheme: dark)", color: "#08090b"},
    {media: "(prefers-color-scheme: light)", color: "#fcfcfb"}
  ]
};

export default function RootLayout({children}: {children: ReactNode}) {
  // Read on the server at request time. A NEXT_PUBLIC_ variable is inlined at build
  // time instead, which silently does nothing if it is set after the last deploy.
  const builderCode = process.env.BUILDER_CODE ?? process.env.NEXT_PUBLIC_BUILDER_CODE;

  return (
    <html lang="en">
      <body>
        <WalletProvider builderCode={builderCode}>
          <div className="aurora" aria-hidden="true" />
          <SiteNav />
          {children}
        </WalletProvider>
      </body>
    </html>
  );
}
