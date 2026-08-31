async function main() {
  const usdTarget = Number(process.env.MINT_PRICE_USD || "5");
  const response = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd");
  if (!response.ok) throw new Error(`ETH price request failed: ${response.status}`);
  const ethUsd = (await response.json()).ethereum.usd;
  const wei = BigInt(Math.round((usdTarget / ethUsd) * 1e18));
  console.log(`ETH/USD: $${ethUsd}`);
  console.log(`Target: $${usdTarget}`);
  console.log(`MINT_PRICE_WEI=${wei}`);
  console.log(`ETH per NFT: ${Number(wei) / 1e18}`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
