const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  if (hre.network.name !== "robinhoodTestnet") throw new Error("Testnet-only.");
  const deployment = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "deployment", "robinhoodTestnet.json"), "utf8"));
  const contract = await hre.ethers.getContractAt("CapyCrewGenesis", deployment.address);
  const tx = await contract.setPublicMintEnabled(true);
  await tx.wait();
  console.log("Public mint enabled at " + deployment.address);
  console.log("Transaction: " + tx.hash);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });

