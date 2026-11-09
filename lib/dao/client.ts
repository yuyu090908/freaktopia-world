"use client";

/**
 * Browser helpers for the FESTIVAL DAO: API calls, a query hook and the DEMO WALLET.
 * The demo wallet is a throwaway key generated in this browser. It is not connected to
 * any blockchain, holds no tokens and is only used to sign the sign-in message.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { buildSignInMessage } from "./auth-message";

export interface ApiError {
  code: string;
  message: string;
  issues?: { path: string; message: string }[];
  [k: string]: unknown;
}

export async function daoApi<T = Record<string, unknown>>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<{ ok: true; data: T; status: number } | { ok: false; error: ApiError; status: number }> {
  const { json, ...rest } = init;
  try {
    const res = await fetch(`/api/dao/${path}`, {
      ...rest,
      credentials: "same-origin",
      headers: json !== undefined ? { "content-type": "application/json", ...(rest.headers ?? {}) } : rest.headers,
      body: json !== undefined ? JSON.stringify(json) : rest.body,
    });
    const body = (await res.json().catch(() => ({}))) as { error?: ApiError };
    if (!res.ok) return { ok: false, error: body.error ?? { code: "HTTP_" + res.status, message: "Request failed." }, status: res.status };
    return { ok: true, data: body as T, status: res.status };
  } catch {
    return { ok: false, error: { code: "NETWORK", message: "Network error. Check your connection." }, status: 0 };
  }
}

export function useDaoQuery<T>(path: string | null) {
  const [state, setState] = useState<{ status: "loading" } | { status: "ok"; data: T } | { status: "error"; error: ApiError; httpStatus: number }>({ status: "loading" });
  const seq = useRef(0);
  const load = useCallback(
    async (quiet = false) => {
      if (path === null) return;
      const n = ++seq.current;
      if (!quiet) setState({ status: "loading" });
      const r = await daoApi<T>(path);
      if (n !== seq.current) return;
      setState(r.ok ? { status: "ok", data: r.data } : { status: "error", error: r.error, httpStatus: r.status });
    },
    [path],
  );
  useEffect(() => {
    void load();
  }, [load]);
  return { state, reload: load };
}

/* ---------------- demo wallet ---------------- */

const KEY = "fk-demo-wallet-v1";

export function demoWallet() {
  let pk: `0x${string}` | null = null;
  try {
    pk = (localStorage.getItem(KEY) as `0x${string}` | null) ?? null;
  } catch {
    pk = null;
  }
  if (!pk) {
    pk = generatePrivateKey();
    try {
      localStorage.setItem(KEY, pk);
    } catch {
      /* private mode: wallet lives for this page only */
    }
  }
  return privateKeyToAccount(pk);
}

export function forgetDemoWallet() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/** Sign in with the demo wallet: nonce → sign EIP-4361 message → server verification. */
export async function signInWithDemoWallet() {
  const account = demoWallet();
  const n = await daoApi<{ nonce: string; nonceToken: string; chainId: number; domain: string }>("auth/nonce", { method: "POST" });
  if (!n.ok) return n;
  const now = new Date();
  const message = buildSignInMessage({
    domain: window.location.host,
    uri: window.location.origin,
    address: account.address,
    chainId: n.data.chainId,
    nonce: n.data.nonce,
    issuedAt: now.toISOString(),
    expirationTime: new Date(now.getTime() + 4 * 60_000).toISOString(),
  });
  const signature = await account.signMessage({ message });
  return daoApi<{ session: { uid: string; wallet: string; chainId: number } }>("auth/verify", { method: "POST", json: { message, signature, nonceToken: n.data.nonceToken } });
}
