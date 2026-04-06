"use server";

import * as path from "path";
import * as fs from "fs";
import { pathToFileURL } from "url";
import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { findDeployedContract } from "@midnight-ntwrk/midnight-js-contracts";
import { NodeZkConfigProvider } from "@midnight-ntwrk/midnight-js-node-zk-config-provider";
import { httpClientProofProvider } from "@midnight-ntwrk/midnight-js-http-client-proof-provider";
import { indexerPublicDataProvider } from "@midnight-ntwrk/midnight-js-indexer-public-data-provider";
import { CompiledContract } from "@midnight-ntwrk/compact-js";

// ─── Paths ───────────────────────────────────────────────────────────────────

const ROOT_DIR = path.resolve(process.cwd(), "..");
const STATE_FILE = path.join(ROOT_DIR, "local-state.json");
const DEPLOYMENT_FILE = path.join(ROOT_DIR, "deployment.json");

// Path to your compiled Compact contract — adjust if your build output differs
// CONTRACT_DIR is where keys/ and zkir/ live (used by CompiledContract.withCompiledFileAssets)
const CONTRACT_DIR = path.join(
  ROOT_DIR,
  "contracts/managed/collection"
);
// CONTRACT_MODULE_DIR is where the JS module (index.js) lives
const CONTRACT_MODULE_DIR = path.join(CONTRACT_DIR, "contract");

// ─── Network config ──────────────────────────────────────────────────────────

// These should ideally come from env vars; hardcoded for preprod here
const PROOF_SERVER_URL =
  process.env.PROOF_SERVER_URL ?? "http://localhost:6300";
const INDEXER_URL =
  process.env.INDEXER_URL ?? "https://indexer.preprod.midnight.network/api/v3/graphql";
const INDEXER_WS_URL =
  process.env.INDEXER_WS_URL ?? "wss://indexer.preprod.midnight.network/api/v3/graphql/ws";

setNetworkId("preprod");

// ─── State helpers ───────────────────────────────────────────────────────────

function loadState() {
  if (fs.existsSync(STATE_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(STATE_FILE, "utf-8"));
    } catch {
      return { ownedTokens: {}, collections: [] };
    }
  }
  return { ownedTokens: {}, collections: [] };
}

function saveState(state: any) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

export async function getDeployment() {
  if (fs.existsSync(DEPLOYMENT_FILE)) {
    return JSON.parse(fs.readFileSync(DEPLOYMENT_FILE, "utf-8"));
  }
  return null;
}

// ─── Read-only queries (no wallet needed) ───────────────────────────────────

export async function fetchOwnedNFTs(userAddress?: string) {
  const state = loadState();
  const allTokens = Object.values(state.ownedTokens || {});
  if (userAddress) {
    return (allTokens as any[]).filter(
      (t: any) =>
        t.ownerAddress === userAddress || t.creatorAddress === userAddress
    );
  }
  return allTokens;
}

export async function fetchCollections() {
  const state = loadState();
  return state.collections || [];
}

export async function registerCollectionWithMetadata(collection: any) {
  const state = loadState();
  if (!state.collections) state.collections = [];
  state.collections.push({ ...collection, createdAt: new Date().toISOString() });
  saveState(state);
  return { success: true };
}

export async function registerNFTWithMetadata(token: any) {
  const state = loadState();
  state.ownedTokens[token.tokenId || token.txId] = {
    ...token,
    registeredAt: new Date().toISOString(),
  };
  saveState(state);
  return { success: true };
}

// ─── Contract ────────────────────────────────────────────────────────────────
// It does NOT execute contracts. Contract transactions must be built and
// ZK-proved server-side using the Midnight.js SDK, then handed to the wallet
// as an UnsealedTransaction for balancing + submission.
//
// Flow:
//   1. Load compiled contract (index.cjs)
//   2. Build a ContractCallTx via contract.call(method, args)  [proves locally]
//   3. Serialize and return to client
//   4. Client calls api.balanceUnsealedTransaction → api.submitTransaction
//
// NOTE: Private state (witnesses) for a pure mint with no private inputs is
// empty — we use a no-op private state provider.

/**
 * Hashes a metadata string with SHA-256 and returns a Uint8Array (32 bytes).
 * The Compact Bytes<32> type maps to Uint8Array in the JS runtime.
 */
async function hashToBytes32(metadata: string): Promise<Uint8Array> {
  const { createHash } = await import("crypto");
  const hash = createHash("sha256").update(metadata, "utf8").digest();
  return new Uint8Array(hash);
}

/**
 * Builds a CompiledContract the same way the CLI does.
 * findDeployedContract needs this — NOT the raw Contract export.
 */
async function getCompiledContract(callerAddressBytes: Uint8Array) {
  const contractPath = path.join(CONTRACT_MODULE_DIR, "index.js");
  if (!fs.existsSync(contractPath)) {
    throw new Error(`Compiled contract not found at ${contractPath}`);
  }
  const module = await eval(`import("${pathToFileURL(contractPath).href}")`);

  return CompiledContract.make(
    'collection',
    module.Contract
  ).pipe(
    CompiledContract.withWitnesses({
      callerAddress: (context: any) => [context.privateState as never, callerAddressBytes]
    }),
    CompiledContract.withCompiledFileAssets(CONTRACT_DIR),
  ) as any;
}

/**
 * In-memory PrivateStateProvider implementation.
 * LevelDB can't be used in Next.js (native bindings incompatible with Turbopack).
 * This satisfies the full PrivateStateProvider interface the SDK expects.
 */
function createInMemoryPrivateStateProvider() {
  const states = new Map<string, any>();
  const signingKeys = new Map<string, any>();
  let currentAddress: string = '';

  return {
    setContractAddress(address: any) { currentAddress = String(address); },
    async get(privateStateId: any) { return states.get(`${currentAddress}:${privateStateId}`) ?? null; },
    async set(privateStateId: any, state: any) { states.set(`${currentAddress}:${privateStateId}`, state); },
    async remove(privateStateId: any) { states.delete(`${currentAddress}:${privateStateId}`); },
    async clear() { states.clear(); },
    async getSigningKey(address: any) { return signingKeys.get(String(address)) ?? null; },
    async setSigningKey(address: any, key: any) { signingKeys.set(String(address), key); },
    async removeSigningKey(address: any) { signingKeys.delete(String(address)); },
    async clearSigningKeys() { signingKeys.clear(); },
    async exportPrivateStates() { return { data: '', tag: '' }; },
    async importPrivateStates() { return { privateStatesImported: 0, errors: [] }; },
    async exportSigningKeys() { return { data: '', tag: '' }; },
    async importSigningKeys() { return { signingKeysImported: 0, errors: [] }; },
  };
}

/**
 * Creates the standard providers object for findDeployedContract.
 */
function createContractProviders() {
  const zkConfigProvider = new NodeZkConfigProvider(CONTRACT_DIR);
  const proofProvider = httpClientProofProvider(
    PROOF_SERVER_URL,
    zkConfigProvider
  );
  const publicDataProvider = indexerPublicDataProvider(
    INDEXER_URL,
    INDEXER_WS_URL
  );

  // The wallet provider is needed by callTx to construct the transaction
  // even though the browser wallet will do the actual coin balancing.
  // We provide dummy keys — the wallet extension replaces them during balancing.
  const dummyKey = '0'.repeat(64);
  const walletProvider = {
    getCoinPublicKey: () => dummyKey,
    getEncryptionPublicKey: () => dummyKey,
    balanceTx: async (tx: any) => tx,
    submitTx: async (tx: any) => tx,
  };

  return {
    zkConfigProvider,
    proofProvider,
    publicDataProvider,
    privateStateProvider: createInMemoryPrivateStateProvider(),
    walletProvider,
    midnightProvider: walletProvider,
  } as any;
}

/**
 * Builds a proved, unsealed mint transaction.
 * Returns a serialized UnsealedTransaction (hex string) ready for the wallet
 * to balance and submit.
 */
export async function buildMintTransaction(
  collectionAddress: string,
  metadata: string
): Promise<{ unsealedTx: string; metadataHash: string }> {
  // 1. Hash metadata → Bytes<32>
  const tokenMetaHash = await hashToBytes32(metadata);
  const metadataHashHex = Buffer.from(tokenMetaHash).toString("hex");

  // 2. Build a dummy caller address (sha256 of "browser-user")
  const { createHash } = await import("crypto");
  const callerAddressBytes = createHash("sha256").update("browser-user").digest();

  // 3. Build CompiledContract + providers (same as CLI)
  const compiledContract = await getCompiledContract(callerAddressBytes);
  const providers = createContractProviders();

  // 4. Attach to deployed contract
  const contract = await findDeployedContract(providers, {
    contractAddress: collectionAddress,
    compiledContract,
  } as any);

  // 5. Call mint — this builds + ZK-proves the transaction server-side.
  //    The result is an UnsealedTransaction (no coin balancing yet).
  const unsealedTx = await contract.callTx.mint(tokenMetaHash);

  // 6. Serialize for transport to the client.
  //    UnsealedTransaction has a toHex() / serialize() depending on SDK version.
  //    In midnight-js-contracts 4.x the transaction object is directly serializable.
  const serialized = JSON.stringify(unsealedTx);

  return { unsealedTx: serialized, metadataHash: metadataHashHex };
}

/**
 * Builds a proved, unsealed transfer transaction.
 */
export async function buildTransferTransaction(
  collectionAddress: string,
  tokenId: number,
  recipientAddress: string,
  metadata: string
): Promise<{ unsealedTx: string }> {
  const tokenMetaHash = await hashToBytes32(metadata);

  const { createHash } = await import("crypto");
  const callerAddressBytes = createHash("sha256").update("browser-user").digest();

  const compiledContract = await getCompiledContract(callerAddressBytes);
  const providers = createContractProviders();

  const contract = await findDeployedContract(providers, {
    contractAddress: collectionAddress,
    compiledContract,
  } as any);

  // Compact: transfer(tokenId: Uint, newOwner: Bytes<32>, tokenMetaHash: Bytes<32>)
  // newOwner as Bytes<32>: encode the address string to bytes
  const ownerBytes = new TextEncoder().encode(recipientAddress).slice(0, 32);
  const ownerPadded = new Uint8Array(32);
  ownerPadded.set(ownerBytes);

  const unsealedTx = await contract.callTx.transfer(
    BigInt(tokenId),
    ownerPadded,
    tokenMetaHash
  );

  const serialized = JSON.stringify(unsealedTx);

  return { unsealedTx: serialized };
}

/**
 * Builds a proved, unsealed verifyOwnership transaction.
 */
export async function buildVerifyTransaction(
  collectionAddress: string,
  tokenId: number,
  metadata: string
): Promise<{ unsealedTx: string }> {
  const tokenMetaHash = await hashToBytes32(metadata);

  const { createHash } = await import("crypto");
  const callerAddressBytes = createHash("sha256").update("browser-user").digest();

  const compiledContract = await getCompiledContract(callerAddressBytes);
  const providers = createContractProviders();

  const contract = await findDeployedContract(providers, {
    contractAddress: collectionAddress,
    compiledContract,
  } as any);

  const unsealedTx = await contract.callTx.verifyOwnership(
    BigInt(tokenId),
    tokenMetaHash
  );

  const serialized = JSON.stringify(unsealedTx);

  return { unsealedTx: serialized };
}