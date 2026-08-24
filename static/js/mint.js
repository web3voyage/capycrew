(() => {
  const configNode = document.getElementById("mint-config");
  const form = document.getElementById("mint-form");
  if (!configNode || !form) return;

  const config = JSON.parse(configNode.textContent || "{}");
  const ethereum = window.ethereum;
  const contractAddress = String(config.contractAddress || "");
  const chainId = BigInt(config.chainId || "46630");
  const chainName = config.chainName || "Robinhood Chain Testnet";
  const currencyName = config.currencyName || "Ether";
  const currencySymbol = config.currencySymbol || "ETH";
  const rpcUrl = String(config.rpcUrl || "");
  const explorerUrl = String(config.explorerUrl || "").replace(/\/$/, "");

  const abi = [
    "function mint(uint256 quantity) payable",
    "function mintPrice() view returns (uint256)",
    "function publicMintEnabled() view returns (bool)",
    "function mintingClosed() view returns (bool)",
    "function totalSupply() view returns (uint256)",
    "function maxSupply() view returns (uint256)",
    "function maxPerWallet() view returns (uint256)",
    "function mintedByWallet(address account) view returns (uint256)",
    "function metadataRevealed() view returns (bool)",
    "error PublicMintDisabled()",
    "error MintingClosed()",
    "error ExceedsWalletLimit()",
    "error ExceedsMaxSupply()",
    "error IncorrectPayment()"
  ];

  const elements = {
    mint: document.getElementById("mint-button"),
    refresh: document.getElementById("refresh-mint"),
    switchNetwork: document.getElementById("switch-network"),
    disconnect: document.getElementById("disconnect-wallet"),
    quantity: document.getElementById("mint-quantity"),
    wallet: document.getElementById("wallet-address"),
    status: document.getElementById("wallet-status"),
    network: document.getElementById("network-status"),
    price: document.getElementById("mint-price"),
    supply: document.getElementById("minted-supply"),
    walletMinted: document.getElementById("wallet-minted"),
    metadata: document.getElementById("metadata-status"),
    explorer: document.getElementById("explorer-link"),
    contract: document.getElementById("contract-link"),
    preview: document.getElementById("collection-preview")
  };

  let account = "";
  let walletVerified = false;
  const SESSION_KEY = "capycrew_verified_wallet";
  let busy = false;
  let collection = null;
  let walletState = null;
  let networkReady = false;

  const shorten = (value) => value ? value.slice(0, 6) + "..." + value.slice(-4) : "";
  const networkHex = () => "0x" + chainId.toString(16);

  function setStatus(message, tone = "") {
    elements.status.textContent = message;
    elements.status.dataset.tone = tone;
    elements.status.setAttribute("role", tone === "error" ? "alert" : "status");
  }

  function setNetwork(message, tone = "neutral") {
    elements.network.textContent = message;
    elements.network.dataset.tone = tone;
  }

  function explainError(error) {
    const code = error && error.code;
    const raw = [
      error && error.shortMessage,
      error && error.reason,
      error && error.info && error.info.error && error.info.error.message,
      error && error.message
    ].filter(Boolean).join(" ").toLowerCase();

    if (code === 4001 || code === "ACTION_REJECTED" || raw.includes("user rejected")) return "Transaction rejected in your wallet. You can safely try again.";
    if (code === 4100 || raw.includes("unauthorized") || raw.includes("request rejected")) return "Wallet permission was not granted. Approve this site in your wallet, then try again.";
    if (raw.includes("already processing") || raw.includes("-32002")) return "Your wallet already has a pending request. Complete it there, then try again.";
    if (code === 4902 || raw.includes("unrecognized chain") || raw.includes("unknown chain")) return "Robinhood Chain Testnet is not configured in your wallet. Approve adding it, then try again.";
    if (code === "INSUFFICIENT_FUNDS" || raw.includes("insufficient funds")) return "Insufficient testnet funds for the mint and gas.";
    if (raw.includes("publicmintdisabled")) return "Public minting is not active yet.";
    if (raw.includes("mintingclosed")) return "Minting is closed for this collection.";
    if (raw.includes("exceedswalletlimit")) return "This wallet has reached its 5-NFT public limit.";
    if (raw.includes("exceedsmaxsupply")) return "The collection is sold out.";
    if (raw.includes("incorrectpayment")) return "The mint price changed. Refresh the collection state and try again.";
    if (raw.includes("paused") || raw.includes("enforcedpause")) return "Minting is temporarily paused.";
    if (raw.includes("chain") || raw.includes("wrong network") || raw.includes("network") || raw.includes("rpc") || raw.includes("fetch")) return "Switch your wallet to Robinhood Chain Testnet, then try again.";
    return "The action could not be completed. Check your wallet and try again.";
  }

  function updateControls() {
    const soldOut = collection && collection.totalSupply >= collection.maxSupply;
    const available = collection && collection.publicMintEnabled && !collection.mintingClosed && !soldOut;
    const remaining = walletState ? walletState.remaining : Infinity;
    const canConnect = !account && Boolean(ethereum) && Boolean(contractAddress);

    elements.refresh.disabled = busy;
    elements.disconnect.hidden = !account;
    elements.disconnect.disabled = busy;
    elements.switchNetwork.disabled = busy;
    elements.quantity.disabled = busy;
    elements.mint.disabled = busy || !contractAddress || (!account && !canConnect) || (Boolean(account) && !networkReady) ||
      (Boolean(account) && (!available || remaining === 0));
    elements.mint.setAttribute("aria-busy", busy ? "true" : "false");
    elements.disconnect.setAttribute("aria-busy", busy ? "true" : "false");

    if (!busy) {
      if (!account) elements.mint.textContent = ethereum ? "Connect wallet" : "Wallet unavailable";
      else if (!networkReady) elements.mint.textContent = "Switch network";
      else if (!available) elements.mint.textContent = soldOut ? "Sold out" : "Mint closed";
      else if (remaining === 0) elements.mint.textContent = "Wallet limit reached";
      else elements.mint.textContent = "Mint now";
    }
  }

  function setBusy(value, label = "") {
    busy = value;
    if (value && label) elements.mint.textContent = label;
    updateControls();
  }

  async function loadCollectionState() {
    const response = await fetch("/api/mint/status", { headers: { Accept: "application/json" } });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Mint status unavailable");
    return {
      mintPrice: BigInt(data.mint_price_wei),
      totalSupply: BigInt(data.total_supply),
      maxSupply: BigInt(data.max_supply),
      publicMintEnabled: Boolean(data.public_mint_enabled),
      mintingClosed: Boolean(data.minting_closed),
      metadataRevealed: Boolean(data.metadata_revealed)
    };
  }

  async function loadWalletState() {
    if (!account || !contractAddress) return null;
    const response = await fetch("/api/mint/wallet/" + encodeURIComponent(account), { headers: { Accept: "application/json" } });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Wallet state unavailable");
    const minted = BigInt(data.minted);
    const limit = BigInt(data.limit);
    const remainingValue = minted >= limit ? 0 : Number(limit - minted);
    return { minted: Number(minted), limit: Number(limit), remaining: remainingValue };
  }

  function resetTransactionState() {
    elements.explorer.removeAttribute("href");
    elements.explorer.hidden = true;
  }

  function setContractVisibility() {
    if (!contractAddress) {
      elements.contract.removeAttribute("href");
      elements.contract.hidden = true;
      return;
    }
    elements.contract.href = explorerUrl + "/address/" + contractAddress;
    elements.contract.hidden = !account;
  }

  function renderCollection() {
    if (!collection) return;
    elements.price.textContent = ethers.formatEther(collection.mintPrice) + " " + currencySymbol;
    elements.supply.textContent = Number(collection.totalSupply).toLocaleString() + " / " + Number(collection.maxSupply).toLocaleString();
    elements.metadata.textContent = collection.metadataRevealed
      ? "Revealed"
      : collection.mintingClosed ? "Ready to reveal" : "Hidden";
    setContractVisibility();
  }

  function renderWallet() {
    if (!account || !walletState) {
      elements.walletMinted.textContent = "-- / 5";
      return;
    }
    elements.walletMinted.textContent = walletState.minted + " / " + walletState.limit;
  }

  async function refreshState(options = {}) {
    const quiet = Boolean(options.quiet);
    if (!quiet) setStatus("Refreshing collection state...");
    try {
      collection = await loadCollectionState();
      renderCollection();
      walletState = await loadWalletState();
      renderWallet();

      if (!collection.publicMintEnabled) setStatus(collection.mintingClosed ? "Minting is closed. Metadata can now be revealed." : "Public minting is not active yet.");
      else if (collection.totalSupply >= collection.maxSupply) setStatus("The collection is sold out.");
      else if (!account) setStatus("Connect a wallet to begin.");
      else if (walletState && walletState.remaining > 0) setStatus("Ready to mint. Confirm one transaction in your wallet.", "success");
      else setStatus("This wallet has reached its public mint limit.", "error");
    } catch (error) {
      collection = null;
      walletState = null;
      setStatus(explainError(error), "error");
      elements.price.textContent = "Unavailable";
      elements.supply.textContent = "--";
    }
    updateControls();
  }

  async function ensureNetwork() {
    if (!ethereum) return false;
    const current = BigInt(await ethereum.request({ method: "eth_chainId" }));
    if (current === chainId) {
      networkReady = true;
      setNetwork(chainName, "success");
      elements.switchNetwork.hidden = true;
      return true;
    }
    networkReady = false;
    setNetwork("Switch to " + chainName, "error");
    elements.switchNetwork.hidden = false;
    updateControls();
    return false;
  }

  async function switchNetwork() {
    if (!ethereum) throw new Error("No browser wallet detected.");
    try {
      await ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: networkHex() }] });
    } catch (error) {
      if (error && error.code !== 4902) throw error;
      await ethereum.request({
        method: "wallet_addEthereumChain",
        params: [{
          chainId: networkHex(),
          chainName,
          nativeCurrency: { name: currencyName, symbol: currencySymbol, decimals: 18 },
          rpcUrls: [rpcUrl],
          blockExplorerUrls: [explorerUrl]
        }]
      });
    }
    return ensureNetwork();
  }

  async function disconnectWallet() {
    account = "";
    walletState = null;
    walletVerified = false;
    resetTransactionState();
    elements.wallet.textContent = "No wallet connected";
    if (ethereum) {
      try {
        await ethereum.request({ method: "wallet_revokePermissions", params: [{ eth_accounts: {} }] });
      } catch (_) {}
    }
    await refreshState({ quiet: true });
    setStatus("Wallet disconnected from this page.");
  }

  async function connectWallet(prompt = true) {
    if (!ethereum) throw new Error("No browser wallet detected.");
    if (!contractAddress) throw new Error("Mint contract is not configured.");
    if (!prompt) {
      await refreshState({ quiet: true });
      return false;
    }

    try {
      const accounts = await ethereum.request({ method: "eth_requestAccounts" });
      account = accounts && accounts[0] ? ethers.getAddress(accounts[0]) : "";
      elements.wallet.textContent = account ? shorten(account) : "No wallet connected";
      if (!account) {
        await refreshState({ quiet: true });
        return false;
      }

      if (!(await ensureNetwork())) {
        setStatus("Switch to " + chainName + " before verifying this wallet.", "error");
        return false;
      }
      setStatus("Please sign the message in your wallet to verify ownership...");
      const message = "Sign to verify you own this wallet.\n\nSite: CapyCrew\nAddress: " + account;
      await ethereum.request({ method: "personal_sign", params: [message, account] });
      walletVerified = true;
      try { sessionStorage.setItem(SESSION_KEY, account); } catch (_) {}
      await refreshState({ quiet: true });
      return true;
    } catch (error) {
      account = "";
      walletState = null;
      walletVerified = false;
      elements.wallet.textContent = "No wallet connected";
      resetTransactionState();
      setContractVisibility();
      await refreshState({ quiet: true });
      setStatus(error && error.code === 4001 ? "Signature or connection rejected. Wallet is not verified." : explainError(error), "error");
      return false;
    }
  }

  async function signerContract() {
    const browserProvider = new ethers.BrowserProvider(ethereum);
    const signer = await browserProvider.getSigner();
    if ((await signer.getAddress()).toLowerCase() !== account.toLowerCase()) throw new Error("The active wallet account changed.");
    return new ethers.Contract(contractAddress, abi, signer);
  }

  async function submitMint() {
    if (!walletVerified && !(await connectWallet(true))) return;
    if (!(await ensureNetwork()) && !(await switchNetwork())) return;
    await refreshState({ quiet: true });
    if (!collection || !walletState) throw new Error("Mint state is unavailable.");
    if (!collection.publicMintEnabled || collection.mintingClosed) throw new Error("MintingClosed");
    if (walletState.remaining === 0) throw new Error("ExceedsWalletLimit");

    const quantity = BigInt(elements.quantity.value);
    if (quantity < 1n || BigInt(walletState.remaining) < quantity) throw new Error("ExceedsWalletLimit");

    const contract = await signerContract();
    const totalCost = (await contract.mintPrice()) * quantity;
    setBusy(true, "Confirm mint...");
    setStatus("Confirm one mint transaction and " + ethers.formatEther(totalCost) + " " + currencySymbol + " payment in your wallet.");
    const tx = await contract.mint(quantity, { value: totalCost });
    elements.explorer.href = explorerUrl + "/tx/" + tx.hash;
    elements.explorer.hidden = false;
    setStatus("Mint submitted. Waiting for confirmation...");
    await tx.wait();
    setStatus("Mint confirmed. Your Capy is onchain.", "success");
    await refreshState({ quiet: true });
  }

  elements.disconnect.addEventListener("click", async () => {
    if (busy) return;
    setBusy(true, "Disconnecting...");
    try { await disconnectWallet(); } catch (error) { setStatus(explainError(error), "error"); } finally { setBusy(false); }
  });

  elements.switchNetwork.addEventListener("click", async () => {
    try {
      setBusy(true);
      setStatus("Approve the network switch in your wallet.");
      await switchNetwork();
      await refreshState({ quiet: true });
    } catch (error) {
      setStatus(explainError(error), "error");
    } finally { setBusy(false); }
  });

  elements.refresh.addEventListener("click", async () => {
    setBusy(true);
    await refreshState();
    setBusy(false);
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (busy) return;
    try {
      await submitMint();
    } catch (error) {
      setStatus(explainError(error), "error");
      if (account && !walletVerified) {
        account = "";
        walletState = null;
        elements.wallet.textContent = "No wallet connected";
        resetTransactionState();
        setContractVisibility();
      }
    } finally {
      setBusy(false);
    }
  });

  if (elements.preview) {
    elements.preview.addEventListener("error", () => {
      elements.preview.src = "/media/assets/CapyCrew_042_cutout.png";
      elements.preview.alt = "CapyCrew Genesis character preview";
    }, { once: true });
  }

  if (!window.ethers) {
    setStatus("The wallet library failed to load. Refresh the page.", "error");
    setNetwork("Unavailable", "error");
    updateControls();
    return;
  }

  if (!contractAddress) {
    setStatus("Mint contract is not configured. Add MINT_CONTRACT_ADDRESS to the server environment.", "error");
    setNetwork(chainName, "neutral");
    updateControls();
    return;
  }

  if (!ethereum) {
    setNetwork("Wallet unavailable", "error");
    setStatus("Install MetaMask or open this page in a wallet-enabled browser. Live collection data remains visible.", "error");
  } else {
    ethereum.on && ethereum.on("accountsChanged", async (accounts) => {
      const previous = account;
      account = accounts && accounts[0] ? ethers.getAddress(accounts[0]) : "";
      walletVerified = account && account === previous ? walletVerified : false;
      networkReady = false;
      elements.wallet.textContent = account ? shorten(account) : "No wallet connected";
      if (!account) {
        walletState = null;
        resetTransactionState();
      }
      await ensureNetwork().catch(() => false);
      await refreshState({ quiet: true });
    });
    ethereum.on && ethereum.on("chainChanged", async () => {
      networkReady = false;
      await ensureNetwork().catch(() => false);
      await refreshState({ quiet: true });
    });

    (async () => {
      try {
        const accounts = await ethereum.request({ method: "eth_accounts" });
        if (accounts && accounts[0]) {
          account = ethers.getAddress(accounts[0]);
          elements.wallet.textContent = shorten(account);
          await ensureNetwork();
        }
      } catch (_) {
        networkReady = false;
      }
      await refreshState({ quiet: true });
    })();
  }

  resetTransactionState();
  setContractVisibility();
  refreshState();
})();
