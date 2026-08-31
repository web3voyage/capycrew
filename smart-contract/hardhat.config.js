require("dotenv").config();
require("@nomicfoundation/hardhat-toolbox");

const privateKey = process.env.PRIVATE_KEY || process.env.MINT_PRIVATE_KEY;
const rpcUrl = process.env.RH_TESTNET_RPC_URL || process.env.RPC_URL || "https://rpc.testnet.chain.robinhood.com";

module.exports = {
  solidity: { version: "0.8.24", settings: { optimizer: { enabled: true, runs: 200 } } },
  networks: {
    hardhat: {},
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337,
    },
    robinhoodTestnet: {
      url: rpcUrl,
      chainId: 46630,
      accounts: privateKey ? [privateKey] : [],
    },
  },
};
