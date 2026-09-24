import type {Metadata, Viewport} from "next";
import type {ReactNode} from "react";
import SiteNav from "./SiteNav";
import {WalletProvider} from "./WalletProvider";
import "./globals.css";

export const metadata: Metadata = {
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
  return (
    <html lang="en">
      <body>
        <WalletProvider>
          <div className="aurora" aria-hidden="true" />
          <SiteNav />
          {children}
        </WalletProvider>
      </body>
    </html>
  );
}
