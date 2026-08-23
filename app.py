from pathlib import Path
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from dotenv import load_dotenv
import os
import asyncio
import time as time_module
import httpx
import json
from eth_abi import decode, encode
from eth_utils import is_address, keccak, to_checksum_address

ROOT = Path(__file__).resolve().parent
load_dotenv(ROOT / ".env")
DEPLOYMENT_FILE = ROOT / "config" / "deployment.json"


def deployed_contract_address():
    """Use the public deployment record when no explicit web-app override exists."""
    configured = os.getenv("MINT_CONTRACT_ADDRESS", "").strip()
    if configured:
        return configured
    try:
        with DEPLOYMENT_FILE.open("r", encoding="utf-8") as handle:
            return str(json.load(handle).get("address", "")).strip()
    except (OSError, ValueError, TypeError):
        return ""

app = FastAPI(title="CapyCrew / Web3 Voyage", version="1.0.0")
templates = Jinja2Templates(directory=str(ROOT / "templates"))

app.mount("/static", StaticFiles(directory=str(ROOT / "static")), name="static")
for route, folder in (("/media/assets", "assets"), ("/media/videos", "videos"), ("/media/store", "store")):
    path = ROOT / "media" / folder
    if path.exists():
        app.mount(route, StaticFiles(directory=str(path)), name=folder)

def mint_config():
    address = deployed_contract_address()
    try:
        address = to_checksum_address(address) if address else ""
    except ValueError:
        address = ""
    return {
        "contract_address": address,
        "chain_id": int(os.getenv("MINT_CHAIN_ID", "46630")),
        "chain_name": os.getenv("MINT_CHAIN_NAME", "Robinhood Chain Testnet"),
        "native_currency_name": os.getenv("MINT_NATIVE_CURRENCY_NAME", "Ether"),
        "native_currency_symbol": os.getenv("MINT_NATIVE_CURRENCY_SYMBOL", "ETH"),
        "rpc_url": os.getenv("RPC_URL", "https://rpc.testnet.chain.robinhood.com").strip(),
        "explorer_url": os.getenv("EXPLORER_URL", "https://explorer.testnet.chain.robinhood.com").rstrip("/"),
    }

def encode_call(signature: str, argument_types: tuple = (), arguments: tuple = ()) -> str:
    selector = keccak(text=signature)[:4]
    encoded_arguments = encode(list(argument_types), list(arguments)) if argument_types else b""
    return "0x" + (selector + encoded_arguments).hex()

async def rpc_call(method: str, params: list):
    config = mint_config()
    async with httpx.AsyncClient(timeout=8.0) as client:
        response = await client.post(
            config["rpc_url"],
            json={"jsonrpc": "2.0", "id": 1, "method": method, "params": params},
        )
        response.raise_for_status()
        payload = response.json()
    if payload.get("error"):
        raise RuntimeError(payload["error"].get("message", "RPC request failed"))
    return payload.get("result")


# Simple in-memory TTL cache for RPC reads.
_cache = {}
_CACHE_TTL_SECONDS = 15


def _cache_get(key):
    entry = _cache.get(key)
    if entry and (time_module.monotonic() - entry[1]) < _CACHE_TTL_SECONDS:
        return entry[0]
    return None


def _cache_set(key, value):
    _cache[key] = (value, time_module.monotonic())

async def contract_read(signature: str, output_type: str, argument_types: tuple = (), arguments: tuple = ()):
    config = mint_config()
    cache_key = f"{config['contract_address']}:{signature}:{arguments}"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached
    result = await rpc_call("eth_call", [{"to": config["contract_address"], "data": encode_call(signature, argument_types, arguments)}, "latest"])
    if not result or result == "0x":
        raise RuntimeError("No contract result")
    decoded = decode([output_type], bytes.fromhex(result[2:]))[0]
    _cache_set(cache_key, decoded)
    return decoded

def context(request: Request, **kwargs):
    config = mint_config()
    return {
        "request": request,
        "site_name": "CAPYCREW",
        "mint_contract_address": config["contract_address"],
        "mint_chain_id": str(config["chain_id"]),
        "mint_chain_name": config["chain_name"],
        "mint_currency_name": config["native_currency_name"],
        "mint_currency_symbol": config["native_currency_symbol"],
        "mint_price_usd": os.getenv("MINT_PRICE_USD", "5"),
        "mint_rpc_url": config["rpc_url"],
        "mint_explorer_url": config["explorer_url"],
        **kwargs,
    }

@app.get("/", response_class=HTMLResponse)
async def home(request: Request):
    return templates.TemplateResponse(request=request, name="home.html", context=context(request, page="home"))

@app.get("/mint", response_class=HTMLResponse)
async def mint(request: Request):
    return templates.TemplateResponse(request=request, name="mint.html", context=context(request, page="mint"))

@app.get("/whitepaper", response_class=HTMLResponse)
async def whitepaper(request: Request):
    return templates.TemplateResponse(request=request, name="whitepaper.html", context=context(request, page="whitepaper"))

@app.get("/about", response_class=HTMLResponse)
async def about(request: Request):
    return templates.TemplateResponse(request=request, name="about.html", context=context(request, page="about"))

@app.get("/privacy", response_class=HTMLResponse)
async def privacy(request: Request):
    return templates.TemplateResponse(request=request, name="privacy.html", context=context(request, page="privacy"))

@app.get("/store", response_class=HTMLResponse)
async def store(request: Request):
    return templates.TemplateResponse(request=request, name="store.html", context=context(request, page="store"))

@app.get("/health")
async def health():
    return {"status": "ok", "service": "web3voyage"}

@app.get("/api/mint/config")
async def api_mint_config():
    config = mint_config()
    return {**config, "configured": bool(config["contract_address"] and config["rpc_url"])}

@app.get("/api/mint/wallet/{account}")
async def api_wallet_mint_state(account: str):
    if not is_address(account):
        return JSONResponse({"error": "Invalid wallet address."}, status_code=400)
    config = mint_config()
    if not config["contract_address"]:
        return JSONResponse({"error": "Mint contract is not configured."}, status_code=503)
    try:
        code = await rpc_call("eth_getCode", [config["contract_address"], "latest"])
        if not code or code == "0x":
            return JSONResponse({"error": "Mint contract is not deployed."}, status_code=503)
        wallet = to_checksum_address(account)
        minted, limit = await asyncio.gather(
            contract_read("mintedByWallet(address)", "uint256", ("address",), (wallet,)),
            contract_read("maxPerWallet()", "uint256"),
        )
        return {
            "account": wallet,
            "minted": str(minted),
            "limit": str(limit),
        }
    except Exception as exc:
        return JSONResponse({"error": str(exc)}, status_code=502)

@app.get("/api/mint/status")
async def api_mint_status():
    config = mint_config()
    if not config["contract_address"]:
        return JSONResponse({"configured": False, "available": False, "error": "Mint contract is not configured."}, status_code=503)
    try:
        code = await rpc_call("eth_getCode", [config["contract_address"], "latest"])
        if not code or code == "0x":
            raise RuntimeError("No contract bytecode exists at the configured address")
        price, total_supply, max_supply, public_mint_enabled, minting_closed, metadata_revealed = await asyncio.gather(
            contract_read("mintPrice()", "uint256"),
            contract_read("totalSupply()", "uint256"),
            contract_read("maxSupply()", "uint256"),
            contract_read("publicMintEnabled()", "bool"),
            contract_read("mintingClosed()", "bool"),
            contract_read("metadataRevealed()", "bool"),
        )
        return {
            "configured": True,
            "available": bool(public_mint_enabled and not minting_closed and total_supply < max_supply),
            "contract_address": config["contract_address"],
            "chain_id": config["chain_id"],
            "mint_price_wei": str(price),
            "total_supply": int(total_supply),
            "max_supply": int(max_supply),
            "public_mint_enabled": bool(public_mint_enabled),
            "minting_closed": bool(minting_closed),
            "metadata_revealed": bool(metadata_revealed),
        }
    except Exception as exc:
        return JSONResponse({"configured": True, "available": False, "error": str(exc)}, status_code=502)

