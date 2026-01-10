# Database Schema Documentation

This document describes the database schema for the Polymarket Insider/Whale Tracker application.

## Overview

The schema is designed to support:
- Real-time tracking of Polymarket prediction markets
- Wallet profiling and whale/insider detection
- Trade history and analysis
- Alert generation and notification management
- Historical snapshots for time-series analysis

## Entity Relationship Diagram

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│     Market      │────<│     Outcome     │────<│  PriceHistory   │
│                 │     │                 │     │                 │
│ - id (PK)       │     │ - id (PK)       │     │ - id (PK)       │
│ - slug (UK)     │     │ - marketId (FK) │     │ - marketId (FK) │
│ - question      │     │ - name          │     │ - outcomeId(FK) │
│ - category      │     │ - price         │     │ - price         │
│ - volume        │     │ - probability   │     │ - volume        │
│ - ...           │     │ - ...           │     │ - timestamp     │
└────────┬────────┘     └────────┬────────┘     └─────────────────┘
         │                       │
         │                       │
         ├───────────────────────┤
         │                       │
         ▼                       ▼
┌─────────────────┐     ┌─────────────────┐
│      Trade      │     │      Alert      │
│                 │     │                 │
│ - id (PK)       │     │ - id (PK)       │
│ - marketId (FK) │     │ - type          │
│ - outcomeId(FK) │     │ - severity      │
│ - walletId (FK) │     │ - marketId (FK) │
│ - side          │     │ - walletId (FK) │
│ - amount        │     │ - message       │
│ - price         │     │ - ...           │
│ - usdValue      │     └────────┬────────┘
│ - timestamp     │              │
└────────┬────────┘              │
         │                       │
         │                       │
         ▼                       ▼
┌─────────────────────────────────────────┐
│                 Wallet                   │
│                                         │
│ - id (PK)                               │
│ - address (UK)                          │
│ - walletType                            │
│ - isWhale, isInsider, isFresh           │
│ - suspicionScore, riskLevel             │
│ - totalVolume, tradeCount, winRate      │
│ - ...                                   │
└────────┬──────────────────┬─────────────┘
         │                  │
         ▼                  ▼
┌─────────────────┐ ┌─────────────────────┐
│WalletFunding    │ │ WalletClusterMember │
│Source           │ │                     │
│                 │ │ - clusterId (FK)    │
│ - walletId (FK) │ │ - walletId (FK)     │
│ - sourceAddress │ │ - role              │
│ - sourceType    │ │ - confidence        │
│ - riskLevel     │ └─────────┬───────────┘
└─────────────────┘           │
                              ▼
                    ┌─────────────────┐
                    │  WalletCluster  │
                    │                 │
                    │ - id (PK)       │
                    │ - clusterType   │
                    │ - confidence    │
                    │ - totalVolume   │
                    └─────────────────┘
```

## Models

### Core Entities

#### Market
Represents a prediction market event on Polymarket.

| Field | Type | Description |
|-------|------|-------------|
| id | String (PK) | Polymarket market ID |
| slug | String (UK) | URL-friendly identifier |
| question | String | The prediction question |
| description | String? | Detailed description |
| category | String? | Category (politics, crypto, etc.) |
| subcategory | String? | More specific classification |
| tags | String[] | Additional filtering tags |
| imageUrl | String? | Market banner image |
| iconUrl | String? | Market icon |
| resolutionSource | String? | Source for resolution |
| resolvedBy | String? | Who resolved the market |
| resolution | String? | Resolution outcome |
| endDate | DateTime? | When trading closes |
| resolvedAt | DateTime? | When resolved |
| active | Boolean | Currently active for trading |
| closed | Boolean | Market has been closed |
| archived | Boolean | Market has been archived |
| volume | Float | Total trading volume (USD) |
| volume24h | Float | 24-hour volume (USD) |
| liquidity | Float | Available liquidity (USD) |
| tradeCount | Int | Total number of trades |
| uniqueTraders | Int | Number of unique wallets |

#### Outcome
Represents possible outcomes for a market (Yes/No or multiple choice).

| Field | Type | Description |
|-------|------|-------------|
| id | String (PK) | Auto-generated CUID |
| marketId | String (FK) | Reference to Market |
| name | String | Outcome name (e.g., "Yes") |
| clobTokenId | String? | CLOB token ID for trading |
| price | Float | Current price (0-1) |
| probability | Float | Probability percentage (0-100) |
| priceChange24h | Float | 24-hour price change % |
| volume | Float | Outcome trading volume |
| winner | Boolean? | Whether this outcome won |
| payout | Float? | Payout amount if winner |
| displayOrder | Int | Display ordering |

#### Wallet
Tracked wallet addresses with comprehensive profiling.

| Field | Type | Description |
|-------|------|-------------|
| id | String (PK) | Auto-generated CUID |
| address | String (UK) | Ethereum/Polygon address |
| label | String? | Human-readable label |
| walletType | WalletType | Classification (EOA, Exchange, etc.) |
| isWhale | Boolean | High volume trader flag |
| isInsider | Boolean | Potential insider flag |
| isFresh | Boolean | Fresh/new wallet flag |
| isMonitored | Boolean | Active monitoring flag |
| isFlagged | Boolean | Suspicious activity flag |
| isSanctioned | Boolean | OFAC sanctioned flag |
| suspicionScore | Float | Suspicion score (0-100) |
| riskLevel | RiskLevel | Risk classification |
| totalVolume | Float | Total trading volume (USD) |
| totalPnl | Float | Total profit/loss (USD) |
| tradeCount | Int | Total trades |
| winCount | Int | Winning trades |
| winRate | Float? | Win rate percentage |
| avgTradeSize | Float? | Average trade size (USD) |
| maxTradeSize | Float? | Largest single trade (USD) |
| firstTradeAt | DateTime? | First Polymarket trade |
| lastTradeAt | DateTime? | Most recent trade |
| walletCreatedAt | DateTime? | First on-chain activity |
| onChainTxCount | Int | Blockchain transaction count |
| walletAgeDays | Int? | Wallet age in days |
| primaryFundingSource | FundingSourceType? | Primary funding type |

#### Trade
Individual trades executed on Polymarket.

| Field | Type | Description |
|-------|------|-------------|
| id | String (PK) | Auto-generated CUID |
| marketId | String (FK) | Reference to Market |
| outcomeId | String (FK) | Reference to Outcome |
| walletId | String (FK) | Reference to Wallet |
| clobTradeId | String? (UK) | CLOB API trade ID |
| matchId | String? | Match ID for maker/taker |
| side | TradeSide | BUY or SELL |
| amount | Float | Share amount traded |
| price | Float | Execution price (0-1) |
| usdValue | Float | Trade value in USD |
| feeUsd | Float | Fee amount in USD |
| makerAddress | String? | Maker wallet address |
| takerAddress | String? | Taker wallet address |
| isMaker | Boolean? | Was wallet the maker |
| timestamp | DateTime | Execution timestamp |
| txHash | String? | On-chain transaction hash |
| blockNumber | BigInt? | Block number |
| isWhale | Boolean | Whale trade flag |
| isInsider | Boolean | Insider activity flag |
| flags | String[] | Additional flags |

### Supporting Entities

#### WalletFundingSource
Tracks where wallet funds originated from.

| Field | Type | Description |
|-------|------|-------------|
| id | String (PK) | Auto-generated CUID |
| walletId | String (FK) | Reference to Wallet |
| sourceAddress | String | Source wallet address |
| sourceType | FundingSourceType | Type of source |
| sourceLabel | String? | Source name (e.g., "Binance") |
| amount | Float | Amount transferred |
| txHash | String? | Transaction hash |
| depth | Int | Depth in funding chain |
| riskLevel | RiskLevel | Risk level of source |
| isSanctioned | Boolean | Sanctioned source flag |
| transferredAt | DateTime | Transfer timestamp |

#### WalletCluster
Groups of related wallets (same entity, coordinated, etc.).

| Field | Type | Description |
|-------|------|-------------|
| id | String (PK) | Auto-generated CUID |
| name | String? | Cluster name/label |
| clusterType | ClusterType | Type of relationship |
| confidence | Float | Confidence score (0-100) |
| totalVolume | Float | Combined volume |
| memberCount | Int | Number of wallets |
| metadata | Json? | Additional data |
| notes | String? | Notes |

#### WalletClusterMember
Many-to-many relationship between wallets and clusters.

#### Alert
Generated alerts and notifications for suspicious activity.

| Field | Type | Description |
|-------|------|-------------|
| id | String (PK) | Auto-generated CUID |
| type | AlertType | Type of alert |
| severity | AlertSeverity | Severity level |
| marketId | String? (FK) | Related market |
| walletId | String? (FK) | Related wallet |
| title | String | Alert title |
| message | String | Detailed message |
| data | Json? | Structured data |
| tags | String[] | Filtering tags |
| read | Boolean | Read status |
| acknowledged | Boolean | Acknowledged status |
| dismissed | Boolean | Dismissed status |

### Time-Series Entities

#### PriceHistory
Price snapshots for charting at various intervals.

| Field | Type | Description |
|-------|------|-------------|
| id | String (PK) | Auto-generated CUID |
| marketId | String (FK) | Reference to Market |
| outcomeId | String (FK) | Reference to Outcome |
| price | Float | Price at timestamp |
| volume | Float | Interval volume |
| tradeCount | Int | Interval trades |
| bestBid | Float? | Best bid price |
| bestAsk | Float? | Best ask price |
| spread | Float? | Bid-ask spread |
| interval | TimeInterval | Time bucket size |
| timestamp | DateTime | Data point time |

#### MarketSnapshot
Periodic full snapshots of market state.

#### WalletSnapshot
Periodic snapshots of wallet metrics.

### System Entities

#### SystemConfig
Key-value configuration store.

#### SyncLog
Tracks data synchronization operations.

#### JobQueue
Background job processing queue.

## Enumerations

### WalletType
- `UNKNOWN` - Unknown wallet type
- `EOA` - Externally Owned Account
- `CONTRACT` - Smart contract wallet
- `EXCHANGE` - Centralized exchange
- `DEFI` - DeFi protocol
- `MARKET_MAKER` - Market maker
- `INSTITUTIONAL` - Institutional/fund
- `BOT` - Automated trading

### RiskLevel
- `NONE` - No risk detected
- `LOW` - Low risk
- `MEDIUM` - Medium risk
- `HIGH` - High risk
- `CRITICAL` - Critical (sanctioned, mixers)

### FundingSourceType
- `EXCHANGE` - Centralized exchange
- `MIXER` - Privacy tool/mixer
- `DEFI` - DeFi protocol
- `CONTRACT` - Smart contract
- `EOA` - Regular wallet
- `UNKNOWN` - Unknown source

### ClusterType
- `UNKNOWN` - Unknown relationship
- `SAME_ENTITY` - Same entity
- `SAME_FUNDING` - Same funding source
- `SIMILAR_TRADING` - Similar patterns
- `COORDINATED` - Coordinated activity
- `BOT_NETWORK` - Bot network

### AlertType
- `WHALE_TRADE` - Large trade detected
- `PRICE_MOVEMENT` - Significant price move
- `INSIDER_ACTIVITY` - Potential insider
- `FRESH_WALLET` - Fresh wallet large trade
- `WALLET_REACTIVATION` - Dormant wallet active
- `COORDINATED_ACTIVITY` - Coordinated wallets
- `UNUSUAL_PATTERN` - Unusual pattern
- `MARKET_RESOLVED` - Market resolution
- `NEW_MARKET` - New high-volume market
- `SUSPICIOUS_FUNDING` - Suspicious funding source
- `SANCTIONED_ACTIVITY` - Sanctioned address
- `SYSTEM` - System alerts

### AlertSeverity
- `INFO` - Informational
- `LOW` - Low priority
- `MEDIUM` - Medium priority
- `HIGH` - High priority
- `CRITICAL` - Critical

### TradeSide
- `BUY` - Buy order
- `SELL` - Sell order

### TimeInterval
- `MINUTE_1` - 1 minute
- `MINUTE_5` - 5 minutes
- `MINUTE_15` - 15 minutes
- `HOUR_1` - 1 hour
- `HOUR_4` - 4 hours
- `DAY_1` - 1 day
- `WEEK_1` - 1 week

### SyncStatus
- `RUNNING` - In progress
- `COMPLETED` - Completed successfully
- `FAILED` - Failed
- `CANCELLED` - Cancelled

### JobStatus
- `PENDING` - Waiting to run
- `RUNNING` - Currently running
- `COMPLETED` - Completed
- `FAILED` - Failed
- `CANCELLED` - Cancelled
- `SCHEDULED` - Scheduled for later

## Indexing Strategy

### Primary Indexes
All `id` fields are primary keys with automatic indexing.

### Unique Indexes
- `Market.slug` - Quick lookup by slug
- `Wallet.address` - Quick lookup by address
- `Trade.clobTradeId` - Deduplication
- `Outcome.clobTokenId` - Token lookup
- `(Outcome.marketId, Outcome.name)` - Unique outcome per market
- `(WalletClusterMember.clusterId, WalletClusterMember.walletId)` - Unique membership

### Foreign Key Indexes
All foreign key fields are indexed for join performance.

### Query Pattern Indexes
- Time-range queries: `timestamp` indexes on Trade, PriceHistory
- Status filtering: `active`, `closed`, `read`, `acknowledged`
- Category filtering: `category`, `type`
- Metric sorting: `volume`, `totalVolume`, `suspicionScore`

### Composite Indexes
Optimized for common query patterns:
- `(marketId, timestamp)` - Market trade history
- `(walletId, timestamp)` - Wallet trade history
- `(isWhale, timestamp)` - Whale trade feeds
- `(type, severity)` - Alert filtering
- `(status, scheduledFor)` - Job scheduling

## Partitioning Strategy

For large-scale deployments, the following tables are candidates for time-based partitioning:

### Trade Table
- Partition by `timestamp` monthly
- Oldest partitions can be archived to cold storage
- Keep recent data (e.g., 6 months) in hot storage

### PriceHistory Table
- Partition by `timestamp` and `interval`
- Fine-grained intervals (MINUTE_1, MINUTE_5) archived more aggressively
- Coarse intervals (DAY_1, WEEK_1) retained longer

### Alert Table
- Partition by `createdAt` monthly
- Old, dismissed alerts can be archived

### MarketSnapshot / WalletSnapshot
- Partition by `timestamp` monthly
- Implement retention policy for cleanup

## Data Retention

Recommended retention periods:
- **Trades**: 2 years (older archived to analytics warehouse)
- **PriceHistory (minute intervals)**: 30 days
- **PriceHistory (hourly intervals)**: 1 year
- **PriceHistory (daily intervals)**: Forever
- **Alerts (acknowledged/dismissed)**: 90 days
- **Snapshots**: 1 year
- **SyncLog**: 30 days
- **JobQueue (completed)**: 7 days
