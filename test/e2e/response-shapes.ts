/**
 * Key manifests for every response type, used by `assertShape`. Each `satisfies Shape<T>` makes tsc keep the manifest's
 * keys identical to the type's, each marked `optional(…)` / `nullable(…)` exactly as the type declares it, so a type
 * change that isn't mirrored here fails `bun run typecheck`.
 */
import type {
  AdditionalFee,
  AffiliateFeeBreakdown,
  ChainsResponse,
  CosmosBankSendSwapExecution,
  CosmosMsgDepositSwapExecution,
  CosmosMsgExecuteSwapExecution,
  CreateSwapResponse,
  EvmApproval,
  EvmSwapExecution,
  ExpectedAffiliateEntry,
  FeeAmount,
  GetSwapResponse,
  HealthResponse,
  InstaswapFeeLine,
  InstaswapSwapLiteSnapshot,
  JsonSwapExecution,
  NamedDepositSwapExecution,
  NoQuoteRouteFees,
  OpenOceanRouteMeta,
  OtherDepositSwapExecution,
  PingResponse,
  ProviderFeeStructure,
  ProviderHealth,
  ProviderInfo,
  ProviderStatusInfo,
  ProvidersResponse,
  QuoteResponse,
  QuoteRoute,
  QuoteRouteFees,
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
  TestWebhookEvent,
  TokenAmount,
  TokensResponse,
  Transaction,
  TransactionsResponse,
  TransactionWebhookData,
  TransactionWebhookEvent,
  UtxoSwapExecution,
  WebhookEvent,
  WebhookStreamingProgress,
} from "../../src/index.js";
import { type FieldShape, nullable, optional, type Shape } from "./assert-shape.js";

// ─── Shared ───

const tokenAmountShape = { display: true, baseUnits: true } satisfies Shape<TokenAmount>;

const openOceanRouteShape = {
  dexId: optional(),
  dexCode: optional(),
  dexes: optional([{ dexId: optional(), dexCode: optional() }]),
} satisfies Shape<OpenOceanRouteMeta>;

const routeInfoShape = {
  provider: true,
  subprovider: optional(),
  private: optional(),
  expectedOutput: true,
  estimatedTimeSeconds: true,
  openOceanRoute: optional(openOceanRouteShape),
} satisfies Shape<RouteInfo>;

const affiliateFeeBreakdownShape = {
  configuredPegasusShareBps: true,
  configuredIntegratorFeeBps: true,
  providerAffiliateCapBps: true,
  effectiveAffiliateFeeBps: true,
  realizedPegasusFeeBps: true,
  realizedIntegratorFeeBps: true,
  feeSource: true,
  pegasusNetBps: optional(),
  pegasusNetUsd: optional(),
} satisfies Shape<AffiliateFeeBreakdown>;

const refundShape = {
  status: true,
  txHash: optional(),
  chain: true,
  amount: true,
  originalAmount: true,
  feeDeducted: true,
  feeDescription: true,
  refundAddress: true,
  completedAt: optional(),
} satisfies Shape<RefundInfo>;

const streamingProgressShape = {
  completedSubSwaps: true,
  totalSubSwaps: true,
  lastSubSwapTimestamp: optional(),
  partialOutput: optional(),
  partialRefund: optional({ amount: true, chain: true, token: true }),
} satisfies Shape<StreamingProgress>;

// ─── Discovery ───

export const pingResponseShape: FieldShape = {
  response: true,
  timestamp: true,
  service: true,
} satisfies Shape<PingResponse>;

export const chainsResponseShape: FieldShape = {
  chains: [{ id: true, name: true, chainId: nullable() }],
} satisfies Shape<ChainsResponse>;

export const tokensResponseShape: FieldShape = {
  chain: true,
  tokens: [{ id: true, symbol: true }],
} satisfies Shape<TokensResponse>;

const feeStructureShape = {
  affiliateFee: {
    minBps: optional(),
    minPercent: optional(),
    minBpsWhenSet: optional(),
    minPercentWhenSet: optional(),
    maxBps: true,
    maxPercent: true,
    defaultBps: optional(),
    defaultPercent: optional(),
  },
  providerTake: nullable({ bpsOfAffiliateFee: true, percentOfAffiliateFee: true }),
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
  maxAffiliateBps: nullable(),
  feeStructure: nullable(feeStructureShape),
} satisfies Shape<ProviderHealth>;

export const providersResponseShape: FieldShape = {
  providers: [
    { ...providerHealthShape, supportedChains: true, configuredReferral: nullable() } satisfies Shape<ProviderInfo>,
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

const feeAmountShape = { usd: true, bps: true } satisfies Shape<FeeAmount>;

const quoteRouteFeesShape = {
  totalBps: true,
  totalUsd: true,
  breakdown: { affiliate: feeAmountShape, route: feeAmountShape, gas: feeAmountShape },
} satisfies Shape<QuoteRouteFees>;

const additionalFeeShape = { token: true, amount: true } satisfies Shape<AdditionalFee>;

/**
 * A route's `fees`: all fields, or `{}` when Pegaroute has no fee data for the route. A partial object fails either
 * way: its keys are undeclared in `{}`, or the full shape reports the missing ones.
 */
function routeFeesShape(fees: QuoteRouteFees | NoQuoteRouteFees): FieldShape {
  return fees.totalUsd === undefined ? {} : quoteRouteFeesShape;
}

const quoteRouteShape = {
  provider: true,
  subprovider: optional(),
  private: optional(),
  providerType: true,
  expectedOutput: true,
  estimatedTimeSeconds: true,
  fees: routeFeesShape,
  additionalFee: nullable(additionalFeeShape),
  expiry: nullable(),
  memo: nullable(),
  inboundAddress: nullable(),
  router: nullable(),
  gasRate: nullable(),
  minAmount: nullable(),
  openOceanRoute: optional(openOceanRouteShape),
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
  signature: optional({ method: true, message: true }),
  chainId: true,
  to: true,
  data: nullable(),
  value: nullable(tokenAmountShape),
  gasLimit: nullable(),
  memo: nullable(),
  approval: nullable(evmApprovalShape),
  transferAmount: nullable(tokenAmountShape),
} satisfies Shape<EvmSwapExecution>;

const utxoExecutionShape = {
  family: true,
  mode: true,
  to: true,
  amount: tokenAmountShape,
  memo: nullable(),
  gasRate: nullable(),
} satisfies Shape<UtxoSwapExecution>;

const bankSendExecutionShape = {
  family: true,
  mode: true,
  to: true,
  amount: tokenAmountShape,
  memo: nullable(),
} satisfies Shape<CosmosBankSendSwapExecution>;

const msgDepositExecutionShape = {
  family: true,
  mode: true,
  to: true,
  asset: true,
  assetDecimals: true,
  amount: tokenAmountShape,
  memo: nullable(),
} satisfies Shape<CosmosMsgDepositSwapExecution>;

const msgExecuteExecutionShape = {
  family: true,
  mode: true,
  messageJson: true,
  memo: nullable(),
  gasPrice: nullable(),
  gasMultiplier: nullable(),
} satisfies Shape<CosmosMsgExecuteSwapExecution>;

const serializedExecutionShape = {
  family: true,
  mode: true,
  serializedTransaction: true,
  minOut: nullable(tokenAmountShape),
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
  memo: nullable(),
} satisfies Shape<NamedDepositSwapExecution>;

const otherDepositExecutionShape = {
  family: true,
  mode: true,
  chain: true,
  to: true,
  amount: tokenAmountShape,
  memo: nullable(),
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

const swapProviderShape = {
  name: true,
  referenceId: nullable(),
  details: nullable(),
} satisfies Shape<SwapProviderInfo>;

export const createSwapResponseShape: FieldShape = {
  transactionId: true,
  status: true,
  providerType: true,
  route: routeInfoShape,
  execution: executionShape,
  provider: swapProviderShape,
} satisfies Shape<CreateSwapResponse>;

const instaswapFeeLineShape = {
  type: optional(),
  name: optional(),
  amountUsd: optional(),
  asset: optional(),
  amount: optional(),
} satisfies Shape<InstaswapFeeLine>;

const instaswapSwapLiteShape = {
  txid: true,
  estimatedOut: optional(),
  estimatedOutUsd: optional(),
  depositAmount: optional(),
  depositAmountExact: optional(),
  depositAmountUsd: optional(),
  feeBreakdown: optional([instaswapFeeLineShape]),
  etaSeconds: optional(),
  depositAddress: true,
  depositTokenSymbol: optional(),
  expiresAt: optional(nullable()),
  instructions: optional(),
} satisfies Shape<InstaswapSwapLiteSnapshot>;

const swapInputShape = {
  chain: true,
  token: true,
  amount: true,
  address: optional(),
  refundAddress: optional(),
  txHash: optional(),
  providerReferenceId: optional(),
  providerStatus: optional({
    status: true,
    actionRequired: true,
    message: true,
    explorerUrl: optional(),
  } satisfies Shape<ProviderStatusInfo>),
  instaswapSwapLite: optional(instaswapSwapLiteShape),
} satisfies Shape<SwapInput>;

const swapOutputShape = {
  chain: true,
  token: true,
  address: true,
  amount: optional(),
  txHash: optional(),
} satisfies Shape<SwapOutput>;

const swapTimestampsShape = {
  created: true,
  submitted: optional(),
  confirmed: optional(),
  completed: optional(),
} satisfies Shape<SwapTimestamps>;

const swapFailureShape = {
  code: true,
  message: true,
  userMessage: true,
  provider: optional(),
} satisfies Shape<SwapFailure>;

export const getSwapResponseShape: FieldShape = {
  transactionId: true,
  status: true,
  internalStatus: true,
  route: routeInfoShape,
  input: swapInputShape,
  output: swapOutputShape,
  affiliateFeeBreakdown: optional(affiliateFeeBreakdownShape),
  timestamps: swapTimestampsShape,
  error: nullable(swapFailureShape),
  refund: nullable(refundShape),
  streamingProgress: nullable(streamingProgressShape),
  execution: optional(executionShape),
  provider: optional(swapProviderShape),
} satisfies Shape<GetSwapResponse>;

export const swapEventsResponseShape: FieldShape = {
  transactionId: true,
  events: [{ id: true, fromStatus: true, toStatus: true, timestamp: true, metadata: nullable() }],
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
  bps: nullable(),
  bpsSource: true,
  affiliateId: optional(),
  scope: optional(),
} satisfies Shape<ExpectedAffiliateEntry>;

const transactionShape = {
  id: true,
  integrationId: true,
  status: true,
  internalStatus: true,
  source: swapInputShape,
  destination: swapOutputShape,
  route: routeInfoShape,
  affiliateFeeBreakdown: optional(affiliateFeeBreakdownShape),
  error: optional(swapFailureShape),
  refund: optional(refundShape),
  timestamps: swapTimestampsShape,
  expectedMemo: optional(),
  expectedAffiliateEntries: [expectedAffiliateEntryShape],
  expectedReferrerAddress: optional(),
  selectedProviderAffiliateCompositionId: optional(),
  memoVerifiedAt: optional(),
} satisfies Shape<Transaction>;

export const transactionsResponseShape: FieldShape = {
  transactions: [transactionShape],
  pagination: { nextCursor: nullable(), hasMore: true },
} satisfies Shape<TransactionsResponse>;

// ─── Webhooks ───

const webhookStreamingProgressShape = {
  ...streamingProgressShape,
  failureContext: nullable(),
} satisfies Shape<WebhookStreamingProgress>;

const transactionWebhookEventShape = {
  event: true,
  timestamp: true,
  data: {
    transactionId: true,
    status: true,
    internalStatus: true,
    previousStatus: true,
    internalPreviousStatus: true,
    route: { provider: true, subprovider: optional(), private: optional() },
    input: {
      chain: true,
      token: true,
      amount: true,
      address: optional(),
      refundAddress: optional(),
      txHash: optional(),
    },
    output: swapOutputShape,
    timestamps: swapTimestampsShape,
    error: nullable(swapFailureShape),
    refund: nullable(refundShape),
    streamingProgress: nullable(webhookStreamingProgressShape),
  } satisfies Shape<TransactionWebhookData>,
} satisfies Shape<TransactionWebhookEvent>;

const testWebhookEventShape = {
  event: true,
  timestamp: true,
  data: { integrationId: true, message: true, generatedBy: true },
} satisfies Shape<TestWebhookEvent>;

/** Any webhook event, picking the manifest by its `event`. */
export const webhookEventShape: FieldShape = (event: WebhookEvent) =>
  event.event === "webhook.test" ? testWebhookEventShape : transactionWebhookEventShape;
