"use client";

import { useCallback, useState } from "react";

let initialized = false;

async function ensureInit() {
  if (initialized) return;
  const { StellarWalletsKit, Networks } = await import(
    "@creit.tech/stellar-wallets-kit"
  );
  const { FreighterModule, FREIGHTER_ID } = await import(
    "@creit.tech/stellar-wallets-kit/modules/freighter"
  );
  StellarWalletsKit.init({
    modules: [new FreighterModule()],
    selectedWalletId: FREIGHTER_ID,
    network: Networks.TESTNET,
  });
  initialized = true;
}

export default function WalletButton() {
  const [address, setAddress] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  const connect = useCallback(async () => {
    setConnecting(true);
    try {
      await ensureInit();
      const { StellarWalletsKit } = await import(
        "@creit.tech/stellar-wallets-kit"
      );
      const { address: addr } = await StellarWalletsKit.authModal();
      setAddress(addr);
    } catch {
      // user closed modal
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    try {
      const { StellarWalletsKit } = await import(
        "@creit.tech/stellar-wallets-kit"
      );
      await StellarWalletsKit.disconnect();
    } catch {
      // ignore
    }
    setAddress(null);
  }, []);

  const display = address
    ? `${address.slice(0, 4)}...${address.slice(-4)}`
    : null;

  return (
    <button
      onClick={address ? disconnect : connect}
      disabled={connecting}
      className="px-4 py-1.5 rounded border border-border text-sm font-mono
                 hover:border-accent hover:text-accent transition-colors
                 disabled:opacity-50 cursor-pointer"
    >
      {connecting
        ? "Connecting..."
        : address
          ? display
          : "Connect Wallet"}
    </button>
  );
}
