const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  if (hre.network.name !== "localhost") throw new Error("This script is for the local Hardhat node only.");
  const [deployer] = await hre.ethers.getSigners();
  const Factory = await hre.ethers.getContractFactory("CapyCrewGenesis");
  const contract = await Factory.deploy(
    "CapyCrew Genesis Local",
    "CAPY",
    hre.ethers.parseEther("0.01"),
    "ipfs://local-metadata/",
    "ipfs://local-hidden/hidden.json"
  );
  await contract.waitForDeployment();
  await (await contract.setPublicMintEnabled(true)).wait();
  const output = {
    network: "localhost",
    chainId: 31337,
    address: await contract.getAddress(),
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
  };
  const outputDir = path.join(__dirname, "..", "deployment");
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, "localhost.json"), JSON.stringify(output, null, 2) + "\n");
  console.log(JSON.stringify(output, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
