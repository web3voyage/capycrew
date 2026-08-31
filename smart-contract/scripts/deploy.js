const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  if (hre.network.name !== "robinhoodTestnet") throw new Error("This script is testnet-only.");
  const env = process.env;
  if (!env.MINT_PRICE_WEI) throw new Error("Set MINT_PRICE_WEI to the current $5 ETH quote before deployment.");

  const Factory = await hre.ethers.getContractFactory("CapyCrewGenesis");
  const contract = await Factory.deploy(
    env.NFT_NAME || "CapyCrew Genesis",
    env.NFT_SYMBOL || "CAPY",
    BigInt(env.MINT_PRICE_WEI),
    env.BASE_TOKEN_URI || "ipfs://REPLACE_WITH_METADATA_CID/",
    env.UNREVEALED_TOKEN_URI || "ipfs://REPLACE_WITH_HIDDEN_METADATA_CID/hidden.json"
  );
  await contract.waitForDeployment();
  const address = await contract.getAddress();
  const deployment = {
    network: hre.network.name,
    chainId: Number((await hre.ethers.provider.getNetwork()).chainId),
    address,
    deployer: (await hre.ethers.getSigners())[0].address,
    transactionHash: contract.deploymentTransaction()?.hash || null,
    deployedAt: new Date().toISOString(),
  };
  const outputDir = path.join(__dirname, "..", "deployment");
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(
    path.join(outputDir, hre.network.name + ".json"),
    JSON.stringify(deployment, null, 2) + "\n"
  );
  console.log("CapyCrewGenesis deployed to " + address);
  console.log("Deployment record: deployment/" + hre.network.name + ".json");
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
