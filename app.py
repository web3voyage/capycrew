from pathlib import Path
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.responses import HTMLResponse, PlainTextResponse, Response
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

def env_flag(name: str, default: bool) -> bool:
    """Read a boolean switch from the environment; an unset or blank value keeps the default."""
    raw = os.getenv(name, "").strip().lower()
    if not raw:
        return default
    return raw not in {"0", "false", "no", "off"}


def mint_enabled() -> bool:
    """Site-level switch for the mint portal.

    Independent of the contract's own publicMintEnabled flag: that one decides whether a
    transaction would succeed, this one decides whether the page and its API exist at all.
    Set MINT_ENABLED=false to hold the portal back, then remove it to open the mint.
    """
    return env_flag("MINT_ENABLED", True)


def public_site_url(request: Request) -> str:
    """Absolute origin for canonical links, share images, robots.txt, and the sitemap.

    PUBLIC_SITE_URL wins. Render injects RENDER_EXTERNAL_URL into every service, so it is a
    safe second choice on the deployed host. The request origin is the local fallback.
    """
    for name in ("PUBLIC_SITE_URL", "RENDER_EXTERNAL_URL"):
        candidate = os.getenv(name, "").strip().rstrip("/")
        if candidate:
            return candidate if "://" in candidate else f"https://{candidate}"
    return str(request.base_url).rstrip("/")


# The interactive docs stay off by default: this app serves a public marketing site, and the
# only API surface is three read-only mint endpoints already documented in the README.
app = FastAPI(
    title="CapyCrew",
    version="1.0.0",
    docs_url="/docs" if env_flag("ENABLE_API_DOCS", False) else None,
    redoc_url="/redoc" if env_flag("ENABLE_API_DOCS", False) else None,
    openapi_url="/openapi.json" if env_flag("ENABLE_API_DOCS", False) else None,
)
templates = Jinja2Templates(directory=str(ROOT / "templates"))

# Everything the pages need is same-origin except the Google Fonts stylesheet and its font
# files. mint.js talks only to /api/mint/*; the RPC URL is handed to the wallet extension,
# never fetched by the page, so connect-src stays on 'self'.
CONTENT_SECURITY_POLICY = "; ".join(
    (
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com",
        "img-src 'self' data:",
        "media-src 'self'",
        "connect-src 'self'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
    )
)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers.setdefault("Content-Security-Policy", CONTENT_SECURITY_POLICY)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    response.headers.setdefault("Permissions-Policy", "geolocation=(), microphone=(), camera=()")
    return response

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
    page = kwargs.get("page", "home")
    mint_open = mint_enabled()
    site_url = public_site_url(request)
    share_titles = {
        "home": "CAPYCREW | A softer internet",
        "hub": "Crew Hub | CAPYCREW",
        "mint": "Mint a Capy | CAPYCREW",
        "about": "About CapyCrew | A softer internet",
        "whitepaper": "CapyCrew Whitepaper",
        "store": "CapyCrew Store",
        "privacy": "CapyCrew Privacy",
        "404": "Page not found | CAPYCREW",
    }
    share_descriptions = {
        "home": "CapyCrew is a 10,000-piece collectible character project building a relaxed, creative world on the Robinhood Chain.",
        "hub": "Your CapyCrew membership home: missions, rewards, and the next CapyCity signal.",
        "mint": "Claim a CapyCrew Genesis NFT on Robinhood Chain Testnet.",
        "about": "Meet CapyCrew: a 10,000-piece collectible character project and evolving digital world.",
        "whitepaper": "Read the CapyCrew project direction, collection details, and roadmap.",
        "store": "Explore CapyCrew goods and future drops.",
        "privacy": "CapyCrew privacy policy.",
        "404": "That CapyCity address does not exist. Head back to a district that does.",
    }
    if not mint_open:
        share_titles["mint"] = "Mint / Coming soon | CAPYCREW"
        share_descriptions["mint"] = "The CapyCrew Genesis mint is not open yet. Follow the official channels for the launch signal."
    return {
        "request": request,
        "site_name": "CAPYCREW",
        "site_url": site_url,
        "mint_enabled": mint_open,
        "canonical_url": site_url + request.url.path,
        "og_title": share_titles.get(page, "CAPYCREW | A softer internet"),
        "og_description": share_descriptions.get(page, share_descriptions["home"]),
        "og_image_url": site_url + "/static/og-capycrew-042.jpg",
        "og_image_type": "image/jpeg",
        "og_image_alt": "CapyCrew #042 collectible character in streetwear on a mint green card",
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

@app.get("/hub", response_class=HTMLResponse)
async def hub(request: Request):
    return templates.TemplateResponse(request=request, name="hub.html", context=context(request, page="hub"))

@app.get("/mint", response_class=HTMLResponse)
async def mint(request: Request):
    # The URL stays live either way so shared links and the whitepaper reference keep working.
    name = "mint.html" if mint_enabled() else "mint-soon.html"
    return templates.TemplateResponse(request=request, name=name, context=context(request, page="mint"))

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

# Public page paths, in the order they should be crawled. Also the sitemap source, so a new
# page only has to be added here once.
PUBLIC_PAGES = ("/", "/hub", "/mint", "/whitepaper", "/about", "/store", "/privacy")


@app.get("/robots.txt", response_class=PlainTextResponse)
async def robots(request: Request):
    lines = [
        "User-agent: *",
        "Allow: /",
        "Disallow: /api/",
        "Disallow: /health",
        "",
        f"Sitemap: {public_site_url(request)}/sitemap.xml",
        "",
    ]
    return PlainTextResponse("\n".join(lines))


@app.get("/sitemap.xml")
async def sitemap(request: Request):
    site_url = public_site_url(request)
    urls = "".join(
        f"<url><loc>{site_url}{path}</loc><changefreq>weekly</changefreq></url>"
        for path in PUBLIC_PAGES
        if mint_enabled() or path != "/mint"
    )
    body = (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
        f"{urls}</urlset>"
    )
    return Response(content=body, media_type="application/xml")


@app.exception_handler(404)
async def not_found(request: Request, exc):
    """Keep wrong URLs inside the site: JSON for the API, the branded page for everything else."""
    if request.url.path.startswith("/api/"):
        return JSONResponse({"error": "Not found."}, status_code=404)
    return templates.TemplateResponse(
        request=request,
        name="404.html",
        context=context(request, page="404"),
        status_code=404,
    )


@app.get("/health")
async def health():
    return {"status": "ok", "service": "capycrew"}

def mint_closed_response():
    """503 for every mint API while MINT_ENABLED is off, so the switch is authoritative
    rather than cosmetic: a cached page or a direct request cannot reach the contract."""
    return JSONResponse(
        {"enabled": False, "configured": False, "available": False, "error": "The mint portal is not open yet."},
        status_code=503,
    )

@app.get("/api/mint/config")
async def api_mint_config():
    if not mint_enabled():
        return mint_closed_response()
    config = mint_config()
    return {**config, "enabled": True, "configured": bool(config["contract_address"] and config["rpc_url"])}

@app.get("/api/mint/wallet/{account}")
async def api_wallet_mint_state(account: str):
    if not mint_enabled():
        return mint_closed_response()
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
    if not mint_enabled():
        return mint_closed_response()
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
            "enabled": True,
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

