const { expect } = require("chai");

describe("CapyCrewGenesis", function () {
  const PRICE = ethers.parseEther("0.01");

  async function deploy() {
    const [owner, alice, bob] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("CapyCrewGenesis");
    const nft = await Factory.deploy(
      "CapyCrew Genesis",
      "CAPY",
      PRICE,
      "ipfs://shuffled-cid/",
      "ipfs://hidden-cid/hidden.json"
    );
    return { nft, owner, alice, bob };
  }

  async function mintToSellout(nft, owner) {
    for (let minted = 0; minted < 10000; minted += 500) {
      await nft.ownerMint(owner.address, 500);
    }
  }

  it("starts disabled with hidden metadata", async function () {
    const { nft } = await deploy();
    expect(await nft.maxSupply()).to.equal(10000n);
    expect(await nft.maxPerWallet()).to.equal(5n);
    expect(await nft.publicMintEnabled()).to.equal(false);
    expect(await nft.mintingClosed()).to.equal(false);
    expect(await nft.metadataRevealed()).to.equal(false);
  });

  it("mints in one payable transaction and assigns sequential token IDs", async function () {
    const { nft, alice } = await deploy();
    await expect(nft.connect(alice).mint(1, { value: PRICE }))
      .to.be.revertedWithCustomError(nft, "PublicMintDisabled");

    await nft.setPublicMintEnabled(true);
    await nft.connect(alice).mint(5, { value: PRICE * 5n });
    expect(await nft.ownerOf(1)).to.equal(alice.address);
    expect(await nft.ownerOf(5)).to.equal(alice.address);
    expect(await nft.mintedByWallet(alice.address)).to.equal(5n);
    expect(await nft.tokenURI(1)).to.equal("ipfs://hidden-cid/hidden.json");

    await expect(nft.connect(alice).mint(1, { value: PRICE }))
      .to.be.revertedWithCustomError(nft, "ExceedsWalletLimit");
  });

  it("rejects incorrect payment and pause blocks minting", async function () {
    const { nft, alice } = await deploy();
    await nft.setPublicMintEnabled(true);
    await expect(nft.connect(alice).mint(1, { value: 0 }))
      .to.be.revertedWithCustomError(nft, "IncorrectPayment");

    await nft.pause();
    await expect(nft.connect(alice).mint(1, { value: PRICE }))
      .to.be.revertedWithCustomError(nft, "EnforcedPause");
  });

  it("closes minting and allows anyone to reveal the pre-shuffled URI sequence", async function () {
    const { nft, owner, alice } = await deploy();
    await nft.setPublicMintEnabled(true);
    await nft.connect(alice).mint(1, { value: PRICE });

    await expect(nft.connect(alice).revealMetadata())
      .to.be.revertedWithCustomError(nft, "MintingNotClosed");

    await nft.connect(owner).closeMinting();
    expect(await nft.mintingClosed()).to.equal(true);
    expect(await nft.publicMintEnabled()).to.equal(false);

    await nft.connect(alice).revealMetadata();
    expect(await nft.metadataRevealed()).to.equal(true);
    expect(await nft.tokenURI(1)).to.equal("ipfs://shuffled-cid/1.json");

    await expect(nft.connect(owner).revealMetadata())
      .to.be.revertedWithCustomError(nft, "MetadataAlreadyRevealed");
    await expect(nft.connect(alice).mint(1, { value: PRICE }))
      .to.be.revertedWithCustomError(nft, "PublicMintDisabled");
  });

  it("automatically closes public minting at sellout", async function () {
    this.timeout(180000);
    const { nft, owner, alice } = await deploy();
    await nft.setPublicMintEnabled(true);
    await mintToSellout(nft, owner);

    expect(await nft.totalSupply()).to.equal(10000n);
    expect(await nft.mintingClosed()).to.equal(true);
    expect(await nft.publicMintEnabled()).to.equal(false);
    await expect(nft.connect(alice).revealMetadata()).not.to.be.reverted;
  });

  it("keeps owner allocations outside public wallet allowance", async function () {
    const { nft, owner, alice } = await deploy();
    await nft.setPublicMintEnabled(true);
    await nft.connect(alice).mint(5, { value: PRICE * 5n });
    await nft.ownerMint(owner.address, 2);
    expect(await nft.totalSupply()).to.equal(7n);
    expect(await nft.mintedByWallet(owner.address)).to.equal(0n);
    expect(await nft.ownerOf(6)).to.equal(owner.address);
  });

  it("supports royalties, withdrawals, and protected ownership", async function () {
    const { nft, owner, alice, bob } = await deploy();
    await nft.setPublicMintEnabled(true);
    await nft.connect(alice).mint(1, { value: PRICE });

    const [receiver, amount] = await nft.royaltyInfo(1, 10000);
    expect(receiver).to.equal(owner.address);
    expect(amount).to.equal(500n);

    await expect(nft.connect(bob).withdraw())
      .to.be.revertedWithCustomError(nft, "OwnableUnauthorizedAccount");
    await nft.withdraw();
    expect(await ethers.provider.getBalance(await nft.getAddress())).to.equal(0n);

    await expect(nft.renounceOwnership())
      .to.be.revertedWithCustomError(nft, "OwnershipRenunciationDisabled");
  });
});


