# Web3 Voyage / CapyCrew production shell

```powershell
cd web3voyage
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app:app --reload --port 8000
```

Routes: `/`, `/mint`, `/whitepaper`, `/store`, `/privacy` and `/health`.

Copy `.env.example` to `.env` and set `MINT_CONTRACT_ADDRESS` to the address written by `smart-contract/deployment/robinhoodTestnet.json`. The backend exposes only public chain configuration and read-only contract state; wallet-signed commit/reveal transactions run in the browser.

Run the launch checks with:

```powershell
python -m unittest -v test_app.py
cd ..\smart-contract
npm.cmd test
```

The verified local development URL is `http://127.0.0.1:8003/` for the currently running server. The app uses a persistent, low-contrast Three.js scene behind readable DOM sections, with mobile and reduced-motion fallbacks.

The app mounts the existing project `assets`, `videos`, and `store` folders as read-only media routes. Replace placeholder social links before launch.
