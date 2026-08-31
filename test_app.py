import os
import re
import unittest
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient

import app as webapp


class WebAppTests(unittest.TestCase):
    def setUp(self):
        self.environment = patch.dict(os.environ, {
            "MINT_CONTRACT_ADDRESS": "0x0000000000000000000000000000000000000001",
            "MINT_CHAIN_ID": "46630",
            "RPC_URL": "https://rpc.test.invalid",
            "EXPLORER_URL": "https://explorer.test.invalid",
        })
        self.environment.start()
        self.addCleanup(self.environment.stop)
        self.client = TestClient(webapp.app)

    def static_source(self, path):
        """Static files are served byte-for-byte, so normalise the line endings of a
        CRLF checkout before matching multi-line source snippets."""
        response = self.client.get(path)
        self.assertEqual(response.status_code, 200, path)
        return response.text.replace("\r\n", "\n")

    def test_pages_and_static_mint_client_load(self):
        for path in ("/", "/hub", "/mint", "/about", "/whitepaper", "/store", "/privacy"):
            response = self.client.get(path)
            self.assertEqual(response.status_code, 200, path)
        about = self.client.get("/about")
        self.assertIn("Give holders a reason to return", about.text)
        self.assertIn("Wallet + Capy profile", about.text)
        self.assertIn('href="/about"', about.text)
        self.assertIn('property="og:image"', about.text)
        self.assertIn("/static/og-capycrew-042.jpg", about.text)
        self.assertIn('name="twitter:card" content="summary_large_image"', about.text)
        mint = self.client.get("/mint")
        self.assertIn("mint-button", mint.text)
        self.assertIn("/static/js/mint.js", mint.text)
        self.assertEqual(self.client.get("/static/js/mint.js").status_code, 200)
        self.assertEqual(self.client.get("/static/vendor/ethers.umd.min.js").status_code, 200)
        self.assertEqual(self.client.get("/static/og-capycrew-042.jpg").status_code, 200)
        hub = self.client.get("/hub")
        self.assertIn("YOUR CAPY", hub.text)
        self.assertIn("Useful things", hub.text)
        self.assertIn("/static/js/hub.js", hub.text)

    def test_mint_client_blocks_minting_on_the_wrong_network(self):
        mint_client = self.static_source("/static/js/mint.js")
        self.assertIn("let networkReady = false", mint_client)
        self.assertIn("Boolean(account) && !networkReady", mint_client)
        self.assertIn('setNetwork("Switch to " + chainName', mint_client)

    def test_mint_client_keeps_connect_verify_and_mint_as_separate_actions(self):
        mint_client = self.static_source("/static/js/mint.js")
        self.assertIn('elements.mint.textContent = "Verify wallet"', mint_client)
        self.assertIn("await connectWallet(true);\n      return;", mint_client)
        self.assertIn("await verifyWallet();\n      return;", mint_client)
        self.assertIn('setStatus("Wallet verified. Click Mint now to continue."', mint_client)
        self.assertIn("refreshState({ quiet: true, preserveStatus: true })", mint_client)

    def test_whitepaper_navigation_reading_aids_and_legal_block(self):
        page = self.client.get("/whitepaper")
        self.assertEqual(page.status_code, 200)
        anchors = re.findall(r'<a href="#([^"]+)">', page.text)
        self.assertIn("legal", anchors)
        for anchor in anchors:
            self.assertIn('id="%s"' % anchor, page.text, anchor)
        self.assertIn("/static/css/whitepaper.css", page.text)
        self.assertIn("/static/js/whitepaper.js", page.text)
        self.assertIn('class="paper-progress"', page.text)
        self.assertIn('href="/privacy"', page.text)
        self.assertIn("https://t.me/capycrew", page.text)
        self.assertIn("Published before any sale", page.text)
        reading_aids = self.static_source("/static/js/whitepaper.js")
        self.assertIn("prefers-reduced-motion", reading_aids)
        self.assertIn("aria-current", reading_aids)
        self.assertIn("IntersectionObserver", reading_aids)

    def test_config_endpoint_exposes_public_chain_configuration_only(self):
        response = self.client.get("/api/mint/config")
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertTrue(payload["configured"])
        self.assertEqual(payload["chain_id"], 46630)
        self.assertNotIn("private_key", payload)

    def test_wallet_endpoint_reports_direct_mint_state(self):
        with patch.object(webapp, "rpc_call", AsyncMock(return_value="0x6080")), patch.object(webapp, "contract_read", AsyncMock(side_effect=[2, 2])):
            response = self.client.get("/api/mint/wallet/0x0000000000000000000000000000000000000002")
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["minted"], "2")
        self.assertEqual(payload["limit"], "2")
        self.assertNotIn("commitment", payload)

    def test_status_endpoint_decodes_direct_mint_state(self):
        reads = [10**16, 42, 10000, True, False, False]
        with patch.object(webapp, "rpc_call", AsyncMock(return_value="0x6000")), patch.object(
            webapp, "contract_read", AsyncMock(side_effect=reads)
        ):
            response = self.client.get("/api/mint/status")
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertTrue(payload["available"])
        self.assertEqual(payload["total_supply"], 42)
        self.assertEqual(payload["mint_price_wei"], str(10**16))
        self.assertFalse(payload["minting_closed"])
        self.assertFalse(payload["metadata_revealed"])

    def test_mint_switch_holds_the_portal_back_without_breaking_the_url(self):
        with patch.dict(os.environ, {"MINT_ENABLED": "false"}):
            mint = self.client.get("/mint")
            self.assertEqual(mint.status_code, 200, "the URL stays live so shared links keep working")
            self.assertIn("THE MINT", mint.text)
            self.assertIn("IS NOT OPEN", mint.text)
            self.assertNotIn("mint-button", mint.text)
            self.assertNotIn("/static/js/mint.js", mint.text)
            self.assertIn("Mint / soon", mint.text)
            self.assertIn("Mint / coming soon", self.client.get("/").text)
            for path in ("/api/mint/config", "/api/mint/status", "/api/mint/wallet/0x0000000000000000000000000000000000000002"):
                response = self.client.get(path)
                self.assertEqual(response.status_code, 503, path)
                self.assertFalse(response.json()["enabled"], path)

    def test_mint_switch_defaults_to_open(self):
        with patch.dict(os.environ, {}, clear=False):
            os.environ.pop("MINT_ENABLED", None)
            mint = self.client.get("/mint")
        self.assertEqual(mint.status_code, 200)
        self.assertIn("mint-button", mint.text)
        self.assertNotIn("IS NOT OPEN", mint.text)

    def test_health_identifies_the_service(self):
        payload = self.client.get("/health").json()
        self.assertEqual(payload, {"status": "ok", "service": "capycrew"})

    def test_unknown_paths_render_the_branded_page_and_api_paths_return_json(self):
        page = self.client.get("/no-such-district")
        self.assertEqual(page.status_code, 404)
        self.assertIn("WRONG BLOCK", page.text)
        self.assertIn('href="/whitepaper"', page.text)
        api = self.client.get("/api/mint/nothing-here")
        self.assertEqual(api.status_code, 404)
        self.assertEqual(api.json(), {"error": "Not found."})

    def test_crawler_files_use_the_public_site_url(self):
        with patch.dict(os.environ, {"PUBLIC_SITE_URL": "https://capycrew.test"}):
            robots = self.client.get("/robots.txt")
            sitemap = self.client.get("/sitemap.xml")
        self.assertEqual(robots.status_code, 200)
        self.assertIn("Disallow: /api/", robots.text)
        self.assertIn("Sitemap: https://capycrew.test/sitemap.xml", robots.text)
        self.assertEqual(sitemap.status_code, 200)
        self.assertIn("application/xml", sitemap.headers["content-type"])
        for path in webapp.PUBLIC_PAGES:
            self.assertIn("<loc>https://capycrew.test%s</loc>" % path, sitemap.text, path)

    def test_public_site_url_falls_back_to_the_render_origin(self):
        with patch.dict(os.environ, {"RENDER_EXTERNAL_URL": "capycrew.onrender.com"}):
            os.environ.pop("PUBLIC_SITE_URL", None)
            page = self.client.get("/about")
        self.assertIn('href="https://capycrew.onrender.com/about"', page.text)

    def test_every_response_carries_the_security_headers(self):
        response = self.client.get("/")
        self.assertEqual(response.headers["x-content-type-options"], "nosniff")
        self.assertEqual(response.headers["x-frame-options"], "DENY")
        self.assertEqual(response.headers["referrer-policy"], "strict-origin-when-cross-origin")
        policy = response.headers["content-security-policy"]
        self.assertIn("default-src 'self'", policy)
        self.assertIn("frame-ancestors 'none'", policy)
        # The one third-party origin the pages need: the Google Fonts stylesheet in site.css.
        self.assertIn("https://fonts.googleapis.com", policy)

    def test_interactive_api_docs_are_off_by_default(self):
        for path in ("/docs", "/redoc", "/openapi.json"):
            self.assertEqual(self.client.get(path).status_code, 404, path)

    def test_holder_airdrop_models_ten_percent_of_supply(self):
        page = self.client.get("/whitepaper").text
        self.assertIn("100M tokens, weighted by tier", page)
        self.assertIn("<strong>100,000,000 tokens</strong>", page)
        self.assertIn("10% of the illustrative genesis supply", page)
        self.assertIn("4,345.9365", page)
        self.assertNotIn("200,000,000", page)
        self.assertIn("$CAPY", page)
        self.assertNotIn("$MELLOW", page)
        # The eight tier allocations must still add up to the pool exactly.
        allocations = [17383746, 21729683, 19556714, 17383746, 13037810, 7822686, 2737940, 347675]
        self.assertEqual(sum(allocations), 100_000_000)
        for amount in allocations:
            self.assertIn("<td>{:,}</td>".format(amount), page)

    def test_hub_ships_without_demo_state_or_invented_metrics(self):
        page = self.client.get("/hub").text
        for fragment in ("connect-demo", "Preview member state", "UNCONNECTED", "vote-submit",
                         "data-vote", "data-mission", "68%", "42%", "TODAY /", "YESTERDAY /"):
            self.assertNotIn(fragment, page, fragment)
        self.assertIn("Build log", page)
        self.assertIn("Opens with member accounts", page)
        hub_script = self.static_source("/static/js/hub.js")
        self.assertNotIn("startCharacterScene", hub_script)
        self.assertNotIn("startCharacterShowcase", hub_script)
        self.assertIn("startCollectionShowcase();", hub_script)

    def test_home_links_to_a_section_that_exists(self):
        home = self.client.get("/").text
        self.assertIn('href="/hub#collection-studio"', home)
        self.assertIn("$CAPY", home)
        self.assertIn('id="collection-studio"', self.client.get("/hub").text)


if __name__ == "__main__":
    unittest.main()

