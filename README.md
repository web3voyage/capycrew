<div align="center">
  <img src=".github/banner.png" alt="CapyCrew banner" width="100%">
</div>

# CapyCrew

**NFT minting dApp — FastAPI + vanilla JS frontend on Robinhood Chain Testnet**

## Quick start

```powershell
cd web3voyage
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app:app --reload --port 8000
```

## Routes

/, /mint, /whitepaper, /store, /privacy and /health.

Copy .env.example to .env and set MINT_CONTRACT_ADDRESS to the address written by smart-contract/deployment/robinhoodTestnet.json. The backend exposes only public chain configuration and read-only contract state; wallet-signed commit/reveal transactions run in the browser.

## Tests

```powershell
python -m unittest -v test_app.py
```
