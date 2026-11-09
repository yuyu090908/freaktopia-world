/** EIP-4361 style sign-in message (shared by browser and server). */
export function buildSignInMessage(p: { domain: string; uri: string; address: string; chainId: number; nonce: string; issuedAt: string; expirationTime: string }) {
  return [
    `${p.domain} wants you to sign in with your Ethereum account:`,
    p.address,
    "",
    "Sign in to FREAKTOPIA FESTIVAL DAO. This signature proves wallet control only and does not move any assets.",
    "",
    `URI: ${p.uri}`,
    "Version: 1",
    `Chain ID: ${p.chainId}`,
    `Nonce: ${p.nonce}`,
    `Issued At: ${p.issuedAt}`,
    `Expiration Time: ${p.expirationTime}`,
  ].join("\n");
}

