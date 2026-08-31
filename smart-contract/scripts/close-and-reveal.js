 const { ethers } = require("hardhat");

  async function main() {
    const address = "0xEA7A25ca2e74851de09c8a6e82f2393Fdb966260";
    const [signer] = await ethers.getSigners();
    const contract = await ethers.getContractAt("CapyCrewGenesis", address, signer);

    if (!(await contract.mintingClosed())) {
      const tx = await contract.closeMinting();
      await tx.wait();
      console.log("Minting closed:", tx.hash);
    } else {
      console.log("Minting was already closed");
    }

    if (!(await contract.metadataRevealed())) {
      const tx = await contract.revealMetadata();
      await tx.wait();
      console.log("Metadata revealed:", tx.hash);
    } else {
      console.log("Metadata was already revealed");
    }
  }

  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });