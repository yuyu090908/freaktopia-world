/** The text a wallet signs to prove ownership. It can never authorize a transaction or token approval. */
export function walletMessage(host: string, nonce: string) {
  return [
    `${host} wants you to link this wallet to your FREAKTOPIA WORLD account.`,
    "",
    "This signature only proves you own the wallet. It does not authorize any transaction, approval or token transfer.",
    "",
    `Nonce: ${nonce}`,
  ].join("\n");
}
