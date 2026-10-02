/**
 * Key manifests for every response type, used by `assertShape`. Each `satisfies Shape<T>` makes tsc keep the manifest's
 * keys identical to the type's, so a type change that isn't mirrored here fails `bun run typecheck`.
 */
import type {
  AffiliateFeeBreakdown,
  ChainsResponse,
  CosmosBankSendSwapExecution,
  CosmosMsgDepositSwapExecution,
  CosmosMsgExecuteSwapExecution,
  CreateSwapResponse,
  EvmApproval,
  EvmSwapExecution,
  ExpectedAffiliateEntry,
  GetSwapResponse,
  HealthResponse,
  InstaswapFeeLine,
  InstaswapSwapLiteSnapshot,
  JsonSwapExecution,
  NamedDepositSwapExecution,
  OpenOceanRouteMeta,
  OtherDepositSwapExecution,
  PingResponse,
  ProviderFeeStructure,
  ProviderHealth,
  ProviderInfo,
  ProviderStatusInfo,
  ProvidersResponse,
  QuoteFees,
  QuoteResponse,
  QuoteRoute,
  RefundInfo,
  RouteInfo,
  RouteWarning,
  SerializedSwapExecution,
  StreamingProgress,
  SubmitTxHashResponse,
  SwapEventsResponse,
  SwapExecution,
  SwapFailure,
  SwapInput,
  SwapOutput,
  SwapProviderInfo,
  SwapTimestamps,
  TokenAmount,
  TokensResponse,
  Transaction,
  TransactionsResponse,
  UtxoSwapExecution,
} from "../../src/index.js";
import type { FieldShape, Shape } from "./assert-shape.js";

// ─── Shared ───

const tokenAmountShape = { display: true, baseUnits: true } satisfies Shape<TokenAmount>;

const quoteFeesShape = {
  affiliate: true,
  liquidity: true,
  outbound: true,
  total: true,
  unit: true,
  subAffiliate: true,
  totalBps: true,
  slippageBps: true,
} satisfies Shape<QuoteFees>;

const openOceanRouteShape = {
  dexId: true,
  dexCode: true,
  dexes: [{ dexId: true, dexCode: true }],
} satisfies Shape<OpenOceanRouteMeta>;

const routeInfoShape = {
  provider: true,
  subprovider: true,
  private: true,
  expectedOutput: true,
  fees: quoteFeesShape,
  estimatedTimeSeconds: true,
  openOceanRoute: openOceanRouteShape,
} satisfies Shape<RouteInfo>;

const affiliateFeeBreakdownShape = {
  configuredPegasusShareBps: true,
  configuredIntegratorFeeBps: true,
  providerAffiliateCapBps: true,
  effectiveAffiliateFeeBps: true,
  realizedPegasusFeeBps: true,
  realizedIntegratorFeeBps: true,
  feeSource: true,
  pegasusNetBps: true,
  pegasusNetUsd: true,
} satisfies Shape<AffiliateFeeBreakdown>;

const refundShape = {
  status: true,
  txHash: true,
  chain: true,
  amount: true,
  originalAmount: true,
  feeDeducted: true,
  feeDescription: true,
  refundAddress: true,
  completedAt: true,
} satisfies Shape<RefundInfo>;

const streamingProgressShape = {
  completedSubSwaps: true,
  totalSubSwaps: true,
  lastSubSwapTimestamp: true,
  partialOutput: true,
  partialRefund: { amount: true, chain: true, token: true },
} satisfies Shape<StreamingProgress>;

// ─── Discovery ───

export const pingResponseShape: FieldShape = {
  response: true,
  timestamp: true,
  service: true,
} satisfies Shape<PingResponse>;

export const chainsResponseShape: FieldShape = {
  chains: [{ id: true, name: true, chainId: true }],
} satisfies Shape<ChainsResponse>;

export const tokensResponseShape: FieldShape = {
  chain: true,
  tokens: [{ id: true, symbol: true }],
} satisfies Shape<TokensResponse>;

const feeStructureShape = {
  affiliateFee: {
    minBps: true,
    minPercent: true,
    minBpsWhenSet: true,
    minPercentWhenSet: true,
    maxBps: true,
    maxPercent: true,
    defaultBps: true,
    defaultPercent: true,
  },
  providerTake: { bpsOfAffiliateFee: true, percentOfAffiliateFee: true },
} satisfies Shape<ProviderFeeStructure>;

const providerHealthShape = {
  name: true,
  type: true,
  available: true,
  routingEnabled: true,
  circuitState: true,
  latencyMs: true,
  haltedChains: true,
  lastChecked: true,
  maxAffiliateBps: true,
  feeStructure: feeStructureShape,
} satisfies Shape<ProviderHealth>;

export const providersResponseShape: FieldShape = {
  providers: [
    { ...providerHealthShape, supportedChains: true, configuredReferral: true } satisfies Shape<ProviderInfo>,
  ],
} satisfies Shape<ProvidersResponse>;

export const healthResponseShape: FieldShape = {
  status: true,
  timestamp: true,
  db: { connected: true, latencyMs: true },
  wal: { pendingEntries: true },
  providers: [providerHealthShape],
} satisfies Shape<HealthResponse>;

// ─── Quotes ───

const quoteRouteShape = {
  provider: true,
  subprovider: true,
  private: true,
  providerType: true,
  expectedOutput: true,
  estimatedTimeSeconds: true,
  fees: quoteFeesShape,
  expiry: true,
  memo: true,
  inboundAddress: true,
  router: true,
  gasRate: true,
  minAmount: true,
  resolvedFee: { feeBps: true },
  openOceanRoute: openOceanRouteShape,
} satisfies Shape<QuoteRoute>;

const routeWarningShape = {
  provider: true,
  code: true,
  message: true,
  userMessage: true,
} satisfies Shape<RouteWarning>;

export const quoteResponseShape: FieldShape = {
  quoteId: true,
  expiresAt: true,
  routes: [quoteRouteShape],
  warnings: [routeWarningShape],
} satisfies Shape<QuoteResponse>;

// ─── Execution (one manifest per variant) ───

const evmApprovalShape = { spender: true, tokenAddress: true, amount: tokenAmountShape } satisfies Shape<EvmApproval>;

const evmExecutionShape = {
  family: true,
  mode: true,
  signature: { method: true, message: true },
  chainId: true,
  to: true,
  data: true,
  value: tokenAmountShape,
  gasLimit: true,
  memo: true,
  approval: evmApprovalShape,
  transferAmount: tokenAmountShape,
} satisfies Shape<EvmSwapExecution>;

const utxoExecutionShape = {
  family: true,
  mode: true,
  to: true,
  amount: tokenAmountShape,
  memo: true,
  gasRate: true,
} satisfies Shape<UtxoSwapExecution>;

const bankSendExecutionShape = {
  family: true,
  mode: true,
  to: true,
  amount: tokenAmountShape,
  memo: true,
} satisfies Shape<CosmosBankSendSwapExecution>;

const msgDepositExecutionShape = {
  family: true,
  mode: true,
  to: true,
  asset: true,
  assetDecimals: true,
  amount: tokenAmountShape,
  memo: true,
} satisfies Shape<CosmosMsgDepositSwapExecution>;

const msgExecuteExecutionShape = {
  family: true,
  mode: true,
  messageJson: true,
  memo: true,
  gasPrice: true,
  gasMultiplier: true,
} satisfies Shape<CosmosMsgExecuteSwapExecution>;

const serializedExecutionShape = {
  family: true,
  mode: true,
  serializedTransaction: true,
  minOut: tokenAmountShape,
} satisfies Shape<SerializedSwapExecution>;

const jsonExecutionShape = {
  family: true,
  mode: true,
  to: true,
  transactionJson: true,
} satisfies Shape<JsonSwapExecution>;

const namedDepositExecutionShape = {
  family: true,
  mode: true,
  to: true,
  amount: tokenAmountShape,
  memo: true,
} satisfies Shape<NamedDepositSwapExecution>;

const otherDepositExecutionShape = {
  family: true,
  mode: true,
  chain: true,
  to: true,
  amount: tokenAmountShape,
  memo: true,
} satisfies Shape<OtherDepositSwapExecution>;

/** Picks the manifest for an execution variant from its `family` and `mode`. */
function executionShape(execution: SwapExecution): FieldShape {
  if (execution.family === "other") return otherDepositExecutionShape;

  switch (execution.mode) {
    case "contract-call":
    case "native-transfer":
    case "erc20-transfer":
      return evmExecutionShape;
    case "payment-with-memo":
      return utxoExecutionShape;
    case "bank-send":
      return bankSendExecutionShape;
    case "msg-deposit":
      return msgDepositExecutionShape;
    case "msg-execute":
      return msgExecuteExecutionShape;
    case "serialized-tx":
      return serializedExecutionShape;
    case "transaction-json":
      return jsonExecutionShape;
    case "deposit-transfer":
      return namedDepositExecutionShape;
  }
}

// ─── Swaps ───

const swapProviderShape = { name: true, referenceId: true, details: true } satisfies Shape<SwapProviderInfo>;

export const createSwapResponseShape: FieldShape = {
  transactionId: true,
  status: true,
  providerType: true,
  route: routeInfoShape,
  execution: executionShape,
  provider: swapProviderShape,
} satisfies Shape<CreateSwapResponse>;

const instaswapFeeLineShape = {
  type: true,
  name: true,
  amountUsd: true,
  asset: true,
  amount: true,
} satisfies Shape<InstaswapFeeLine>;

const instaswapSwapLiteShape = {
  txid: true,
  estimatedOut: true,
  estimatedOutUsd: true,
  depositAmount: true,
  depositAmountExact: true,
  depositAmountUsd: true,
  feeBreakdown: [instaswapFeeLineShape],
  etaSeconds: true,
  depositAddress: true,
  depositTokenSymbol: true,
  expiresAt: true,
  instructions: true,
} satisfies Shape<InstaswapSwapLiteSnapshot>;

const swapInputShape = {
  chain: true,
  token: true,
  amount: true,
  address: true,
  refundAddress: true,
  txHash: true,
  providerReferenceId: true,
  providerStatus: {
    status: true,
    actionRequired: true,
    message: true,
    explorerUrl: true,
  } satisfies Shape<ProviderStatusInfo>,
  instaswapSwapLite: instaswapSwapLiteShape,
} satisfies Shape<SwapInput>;

const swapOutputShape = {
  chain: true,
  token: true,
  address: true,
  amount: true,
  txHash: true,
} satisfies Shape<SwapOutput>;

const swapTimestampsShape = {
  created: true,
  submitted: true,
  confirmed: true,
  completed: true,
} satisfies Shape<SwapTimestamps>;

const swapFailureShape = { code: true, message: true, userMessage: true, provider: true } satisfies Shape<SwapFailure>;

export const getSwapResponseShape: FieldShape = {
  transactionId: true,
  status: true,
  internalStatus: true,
  route: routeInfoShape,
  input: swapInputShape,
  output: swapOutputShape,
  fees: quoteFeesShape,
  affiliateFeeBreakdown: affiliateFeeBreakdownShape,
  timestamps: swapTimestampsShape,
  error: swapFailureShape,
  refund: refundShape,
  streamingProgress: streamingProgressShape,
  execution: executionShape,
  provider: swapProviderShape,
} satisfies Shape<GetSwapResponse>;

export const swapEventsResponseShape: FieldShape = {
  transactionId: true,
  events: [{ id: true, fromStatus: true, toStatus: true, timestamp: true, metadata: true }],
} satisfies Shape<SwapEventsResponse>;

export const submitTxHashResponseShape: FieldShape = {
  transactionId: true,
  status: true,
  txHash: true,
} satisfies Shape<SubmitTxHashResponse>;

// ─── Transactions ───

const expectedAffiliateEntryShape = {
  position: true,
  name: true,
  bps: true,
  bpsSource: true,
  affiliateId: true,
  scope: true,
} satisfies Shape<ExpectedAffiliateEntry>;

const transactionShape = {
  id: true,
  integrationId: true,
  status: true,
  internalStatus: true,
  source: swapInputShape,
  destination: swapOutputShape,
  route: routeInfoShape,
  fees: quoteFeesShape,
  affiliateFeeBreakdown: affiliateFeeBreakdownShape,
  error: swapFailureShape,
  refund: refundShape,
  timestamps: swapTimestampsShape,
  expectedMemo: true,
  expectedAffiliateEntries: [expectedAffiliateEntryShape],
  expectedReferrerAddress: true,
  selectedProviderAffiliateCompositionId: true,
  memoVerifiedAt: true,
} satisfies Shape<Transaction>;

export const transactionsResponseShape: FieldShape = {
  transactions: [transactionShape],
  pagination: { nextCursor: true, hasMore: true },
} satisfies Shape<TransactionsResponse>;
