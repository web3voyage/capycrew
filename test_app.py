import os
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

    def test_pages_and_static_mint_client_load(self):
        for path in ("/", "/hub", "/mint", "/about", "/whitepaper", "/store", "/privacy"):
            response = self.client.get(path)
            self.assertEqual(response.status_code, 200, path)
        about = self.client.get("/about")
        self.assertIn("Digital membership", about.text)
        self.assertIn('href="/about"', about.text)
        self.assertIn('property="og:image"', about.text)
        self.assertIn("/static/og-image.png", about.text)
        self.assertIn('name="twitter:card" content="summary_large_image"', about.text)
        mint = self.client.get("/mint")
        self.assertIn("mint-button", mint.text)
        self.assertIn("/static/js/mint.js", mint.text)
        self.assertEqual(self.client.get("/static/js/mint.js").status_code, 200)
        self.assertEqual(self.client.get("/static/vendor/ethers.umd.min.js").status_code, 200)
        self.assertEqual(self.client.get("/static/og-image.png").status_code, 200)
        hub = self.client.get("/hub")
        self.assertIn("YOUR CAPY", hub.text)
        self.assertIn("Useful things", hub.text)
        self.assertIn("/static/js/hub.js", hub.text)

    def test_mint_client_blocks_minting_on_the_wrong_network(self):
        mint_client = self.client.get("/static/js/mint.js")
        self.assertIn("let networkReady = false", mint_client.text)
        self.assertIn("Boolean(account) && !networkReady", mint_client.text)
        self.assertIn('setNetwork("Switch to " + chainName', mint_client.text)

    def test_mint_client_keeps_connect_verify_and_mint_as_separate_actions(self):
        mint_client = self.client.get("/static/js/mint.js")
        self.assertIn('elements.mint.textContent = "Verify wallet"', mint_client.text)
        self.assertIn("await connectWallet(true);\n      return;", mint_client.text)
        self.assertIn("await verifyWallet();\n      return;", mint_client.text)
        self.assertIn('setStatus("Wallet verified. Click Mint now to continue."', mint_client.text)
        self.assertIn("refreshState({ quiet: true, preserveStatus: true })", mint_client.text)

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


if __name__ == "__main__":
    unittest.main()

