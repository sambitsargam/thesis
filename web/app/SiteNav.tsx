"use client";

import Link from "next/link";
import WalletButton from "./WalletButton";

export default function SiteNav() {
  return (
    <nav className="nav">
      <div className="nav-inner">
        <Link className="wordmark" href="/">
          Thesis
        </Link>
        <div className="nav-right">
          <span className="chip live">X Layer · 196</span>
          <WalletButton />
        </div>
      </div>
    </nav>
  );
}
