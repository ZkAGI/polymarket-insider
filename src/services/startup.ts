// /**
//  * Application Startup Orchestrator (STARTUP-001)
//  *
//  * Manages the lifecycle of all background services in the correct order.
//  * Services are started in dependency order and stopped in reverse order.
//  *
//  * Startup Order:
//  * 1. Database connection (prerequisite for all services)
//  * 2. MarketSyncService - Fetches and syncs market data
//  * 3. TradeStreamService - Connects to WebSocket and processes trades
//  * 4. WalletProfilerService - Profiles wallets as trades come in
//  * 5. AlertGeneratorService - Generates and broadcasts alerts
//  * 6. Telegram Bot - Handles user commands
//  *
//  * Shutdown Order: Reverse of startup to ensure clean disconnection.
//  */

// import { EventEmitter } from "events";
// import {
//   prisma,
//   performHealthCheck,
//   startHealthChecks,
//   stopHealthChecks,
//   disconnectPrisma,
// } from "../db/client";
// import {
//   MarketSyncService,
//   marketSyncService,
//   type MarketSyncConfig,
// } from "./market-sync";
// import {
//   TradeStreamService,
//   tradeStreamService,
//   type TradeStreamServiceConfig,
// } from "./trade-stream";
// import {
//   WalletProfilerService,
//   walletProfilerService,
//   type WalletProfilerServiceConfig,
// } from "./wallet-profiler";
// import {
//   AlertGeneratorService,
//   alertGeneratorService,
//   type AlertGeneratorConfig,
// } from "./alert-generator";
// import {
//   TelegramBotClient,
//   getTelegramBot,
// } from "../telegram/bot";
// import { env, logConfig } from "../../config/env";

// // ============================================================================
// // Types
// // ============================================================================

// /**
//  * Configuration for the startup orchestrator
//  */
// export interface StartupConfig {
//   /** Whether to start MarketSyncService */
//   enableMarketSync?: boolean;

//   /** Whether to start TradeStreamService */
//   enableTradeStream?: boolean;

//   /** Whether to start WalletProfilerService */
//   enableWalletProfiler?: boolean;

//   /** Whether to start AlertGeneratorService */
//   enableAlertGenerator?: boolean;

//   /** Whether to start Telegram bot */
//   enableTelegramBot?: boolean;

//   /** Whether to enable database health checks */
//   enableDbHealthChecks?: boolean;

//   /** Database health check interval in ms (default: 30000) */
//   dbHealthCheckIntervalMs?: number;

//   /** Whether to log configuration on startup */
//   logConfiguration?: boolean;

//   /** Custom service instances (for testing) */
//   services?: {
//     marketSync?: MarketSyncService;
//     tradeStream?: TradeStreamService;
//     walletProfiler?: WalletProfilerService;
//     alertGenerator?: AlertGeneratorService;
//     telegramBot?: TelegramBotClient;
//   };

//   /** Service-specific configuration */
//   marketSyncConfig?: MarketSyncConfig;
//   tradeStreamConfig?: TradeStreamServiceConfig;
//   walletProfilerConfig?: WalletProfilerServiceConfig;
//   alertGeneratorConfig?: AlertGeneratorConfig;

//   /** Logger function */
//   logger?: (message: string, data?: Record<string, unknown>) => void;
// }

// /**
//  * Status of an individual service
//  */
// export type ServiceStatus = "stopped" | "starting" | "running" | "stopping" | "error";

// /**
//  * Individual service status information
//  */
// export interface ServiceInfo {
//   name: string;
//   status: ServiceStatus;
//   startedAt: Date | null;
//   error: string | null;
// }

// /**
//  * Overall startup status
//  */
// export interface StartupStatus {
//   /** Whether all services are running */
//   allRunning: boolean;

//   /** Whether any service failed to start */
//   hasErrors: boolean;

//   /** Overall status */
//   status: "stopped" | "starting" | "running" | "stopping" | "error" | "partial";

//   /** Individual service statuses */
//   services: ServiceInfo[];

//   /** Database health status */
//   databaseHealthy: boolean;

//   /** Time when startup completed */
//   startupCompletedAt: Date | null;

//   /** Total startup time in ms */
//   startupTimeMs: number | null;
// }

// /**
//  * Events emitted by the startup orchestrator
//  */
// export interface StartupEvents {
//   "startup:start": void;
//   "startup:complete": { status: StartupStatus; timeMs: number };
//   "startup:error": { service: string; error: Error };
//   "shutdown:start": void;
//   "shutdown:complete": { timeMs: number };
//   "service:started": { service: string };
//   "service:stopped": { service: string };
//   "service:error": { service: string; error: Error };
// }

// // ============================================================================
// // StartupOrchestrator Class
// // ============================================================================

// /**
//  * Orchestrates the startup and shutdown of all application services.
//  */
// export class StartupOrchestrator extends EventEmitter {
//   private config: Required<
//     Pick<
//       StartupConfig,
//       | "enableMarketSync"
//       | "enableTradeStream"
//       | "enableWalletProfiler"
//       | "enableAlertGenerator"
//       | "enableTelegramBot"
//       | "enableDbHealthChecks"
//       | "dbHealthCheckIntervalMs"
//       | "logConfiguration"
//     >
//   >;

//   private readonly marketSyncService: MarketSyncService;
//   private readonly tradeStreamService: TradeStreamService;
//   private readonly walletProfilerService: WalletProfilerService;
//   private readonly alertGeneratorService: AlertGeneratorService;
//   private readonly telegramBot: TelegramBotClient;
//   private readonly logger: (message: string, data?: Record<string, unknown>) => void;

//   private status: StartupStatus = {
//     allRunning: false,
//     hasErrors: false,
//     status: "stopped",
//     services: [],
//     databaseHealthy: false,
//     startupCompletedAt: null,
//     startupTimeMs: null,
//   };

//   private isStarting = false;
//   private isStopping = false;

//   constructor(config: StartupConfig = {}) {
//     super();

//     this.config = {
//       enableMarketSync: config.enableMarketSync ?? true,
//       enableTradeStream: config.enableTradeStream ?? true,
//       enableWalletProfiler: config.enableWalletProfiler ?? true,
//       enableAlertGenerator: config.enableAlertGenerator ?? true,
//       enableTelegramBot: config.enableTelegramBot ?? !!env.TELEGRAM_BOT_TOKEN,
//       enableDbHealthChecks: config.enableDbHealthChecks ?? env.isProduction,
//       dbHealthCheckIntervalMs: config.dbHealthCheckIntervalMs ?? 30000,
//       logConfiguration: config.logConfiguration ?? true,
//     };

//     // Use provided service instances or defaults
//     this.marketSyncService = config.services?.marketSync ?? marketSyncService;
//     this.tradeStreamService = config.services?.tradeStream ?? tradeStreamService;
//     this.walletProfilerService = config.services?.walletProfiler ?? walletProfilerService;
//     this.alertGeneratorService = config.services?.alertGenerator ?? alertGeneratorService;
//     this.telegramBot = config.services?.telegramBot ?? getTelegramBot();
//     this.logger = config.logger ?? this.defaultLogger.bind(this);

//     // Initialize service status list
//     this.initializeServiceStatus();
//   }

//   /**
//    * Default logger
//    */
//   private defaultLogger(message: string, data?: Record<string, unknown>): void {
//     const timestamp = new Date().toISOString();
//     if (data) {
//       console.log(`[${timestamp}] [StartupOrchestrator] ${message}`, data);
//     } else {
//       console.log(`[${timestamp}] [StartupOrchestrator] ${message}`);
//     }
//   }

//   /**
//    * Initialize service status list
//    */
//   private initializeServiceStatus(): void {
//     this.status.services = [
//       { name: "database", status: "stopped", startedAt: null, error: null },
//       { name: "marketSync", status: "stopped", startedAt: null, error: null },
//       { name: "tradeStream", status: "stopped", startedAt: null, error: null },
//       { name: "walletProfiler", status: "stopped", startedAt: null, error: null },
//       { name: "alertGenerator", status: "stopped", startedAt: null, error: null },
//       { name: "telegramBot", status: "stopped", startedAt: null, error: null },
//     ];
//   }

//   /**
//    * Update the status of a service
//    */
//   private updateServiceStatus(
//     name: string,
//     status: ServiceStatus,
//     error?: string | null
//   ): void {
//     const service = this.status.services.find((s) => s.name === name);
//     if (service) {
//       service.status = status;
//       if (status === "running") {
//         service.startedAt = new Date();
//         service.error = null;
//       } else if (status === "error") {
//         service.error = error ?? "Unknown error";
//       } else if (status === "stopped") {
//         service.startedAt = null;
//         service.error = null;
//       }
//     }
//   }

//   /**
//    * Calculate overall status from individual service statuses
//    */
//   private calculateOverallStatus(): void {
//     const enabledServices = this.getEnabledServiceNames();
//     const enabledStatuses = this.status.services.filter((s) =>
//       enabledServices.includes(s.name)
//     );

//     const allRunning = enabledStatuses.every((s) => s.status === "running");
//     const hasErrors = enabledStatuses.some((s) => s.status === "error");
//     const anyStarting = enabledStatuses.some((s) => s.status === "starting");
//     const anyStopping = enabledStatuses.some((s) => s.status === "stopping");
//     const allStopped = enabledStatuses.every((s) => s.status === "stopped");

//     this.status.allRunning = allRunning;
//     this.status.hasErrors = hasErrors;

//     if (allStopped) {
//       this.status.status = "stopped";
//     } else if (anyStarting) {
//       this.status.status = "starting";
//     } else if (anyStopping) {
//       this.status.status = "stopping";
//     } else if (hasErrors && !allRunning) {
//       this.status.status = "partial";
//     } else if (hasErrors) {
//       this.status.status = "error";
//     } else if (allRunning) {
//       this.status.status = "running";
//     } else {
//       this.status.status = "partial";
//     }
//   }

//   /**
//    * Get list of enabled service names
//    */
//   private getEnabledServiceNames(): string[] {
//     const names: string[] = ["database"];

//     if (this.config.enableMarketSync) {
//       names.push("marketSync");
//     }
//     if (this.config.enableTradeStream) {
//       names.push("tradeStream");
//     }
//     if (this.config.enableWalletProfiler) {
//       names.push("walletProfiler");
//     }
//     if (this.config.enableAlertGenerator) {
//       names.push("alertGenerator");
//     }
//     if (this.config.enableTelegramBot) {
//       names.push("telegramBot");
//     }

//     return names;
//   }

//   /**
//    * Start all services in the correct order.
//    *
//    * @returns The startup status
//    */
//   async startAllServices(): Promise<StartupStatus> {
//     if (this.isStarting) {
//       this.logger("Startup already in progress");
//       return this.status;
//     }

//     if (this.status.status === "running") {
//       this.logger("All services already running");
//       return this.status;
//     }

//     this.isStarting = true;
//     const startTime = Date.now();
//     this.status.status = "starting";
//     this.emit("startup:start");

//     // Log configuration if enabled
//     if (this.config.logConfiguration) {
//       logConfig();
//     }

//     this.logger("Starting all services", {
//       enableMarketSync: this.config.enableMarketSync,
//       enableTradeStream: this.config.enableTradeStream,
//       enableWalletProfiler: this.config.enableWalletProfiler,
//       enableAlertGenerator: this.config.enableAlertGenerator,
//       enableTelegramBot: this.config.enableTelegramBot,
//     });

//     try {
//       // 1. Database connection (critical - must succeed)
//       await this.startDatabase();

//       // 2. MarketSyncService (high priority - provides market data)
//       if (this.config.enableMarketSync) {
//         await this.startService("marketSync", async () => {
//           await this.marketSyncService.start();
//         });
//       }

//       // 3. TradeStreamService (high priority - processes trades)
//       if (this.config.enableTradeStream) {
//         await this.startService("tradeStream", async () => {
//           await this.tradeStreamService.start();
//         });
//       }

//       // 4. WalletProfilerService (depends on TradeStreamService)
//       if (this.config.enableWalletProfiler) {
//         await this.startService("walletProfiler", async () => {
//           this.walletProfilerService.start();
//         });
//       }

//       // 5. AlertGeneratorService (depends on TradeStreamService and WalletProfilerService)
//       if (this.config.enableAlertGenerator) {
//         await this.startService("alertGenerator", async () => {
//           await this.alertGeneratorService.start();
//         });
//       }

//       // 6. Telegram Bot (optional, depends on configuration)
//       if (this.config.enableTelegramBot) {
//         await this.startService("telegramBot", async () => {
//           const result = await this.telegramBot.initialize();
//           if (!result.success) {
//             throw new Error(result.error ?? "Failed to initialize Telegram bot");
//           }
//           await this.telegramBot.start();
//         });
//       }

//       // Calculate final status
//       this.calculateOverallStatus();
//       this.status.startupCompletedAt = new Date();
//       this.status.startupTimeMs = Date.now() - startTime;

//       this.logger("Startup complete", {
//         status: this.status.status,
//         timeMs: this.status.startupTimeMs,
//         runningServices: this.status.services
//           .filter((s) => s.status === "running")
//           .map((s) => s.name),
//       });

//       this.emit("startup:complete", {
//         status: this.status,
//         timeMs: this.status.startupTimeMs,
//       });

//       return this.status;
//     } catch (error) {
//       const err = error instanceof Error ? error : new Error(String(error));
//       this.logger("Startup failed", { error: err.message });
//       this.status.hasErrors = true;
//       this.calculateOverallStatus();
//       throw error;
//     } finally {
//       this.isStarting = false;
//     }
//   }

//   /**
//    * Start the database connection
//    */
//   private async startDatabase(): Promise<void> {
//     this.updateServiceStatus("database", "starting");
//     this.logger("Connecting to database...");

//     try {
//       // Perform initial health check to verify connection
//       const healthResult = await performHealthCheck(prisma);

//       if (!healthResult.healthy) {
//         throw new Error(healthResult.error ?? "Database connection failed");
//       }

//       this.status.databaseHealthy = true;
//       this.updateServiceStatus("database", "running");
//       this.emit("service:started", { service: "database" });

//       // Start periodic health checks if enabled
//       if (this.config.enableDbHealthChecks) {
//         startHealthChecks(prisma, this.config.dbHealthCheckIntervalMs);
//         this.logger("Database health checks started", {
//           intervalMs: this.config.dbHealthCheckIntervalMs,
//         });
//       }

//       this.logger("Database connected", {
//         responseTimeMs: healthResult.responseTimeMs,
//       });
//     } catch (error) {
//       const err = error instanceof Error ? error : new Error(String(error));
//       this.updateServiceStatus("database", "error", err.message);
//       this.status.databaseHealthy = false;
//       this.emit("startup:error", { service: "database", error: err });
//       this.emit("service:error", { service: "database", error: err });

//       // Database is critical - throw to stop startup
//       throw new Error(`Critical: Database connection failed - ${err.message}`);
//     }
//   }

//   /**
//    * Start an individual service with error handling
//    */
//   private async startService(
//     name: string,
//     startFn: () => Promise<void>
//   ): Promise<void> {
//     this.updateServiceStatus(name, "starting");
//     this.logger(`Starting ${name}...`);

//     try {
//       await startFn();
//       this.updateServiceStatus(name, "running");
//       this.emit("service:started", { service: name });
//       this.logger(`${name} started successfully`);
//     } catch (error) {
//       const err = error instanceof Error ? error : new Error(String(error));
//       this.updateServiceStatus(name, "error", err.message);
//       this.emit("startup:error", { service: name, error: err });
//       this.emit("service:error", { service: name, error: err });
//       this.logger(`${name} failed to start`, { error: err.message });

//       // Don't throw - allow other services to continue
//       // The status will reflect the partial failure
//     }
//   }

//   /**
//    * Stop all services in reverse order.
//    */
//   async stopAllServices(): Promise<void> {
//     if (this.isStopping) {
//       this.logger("Shutdown already in progress");
//       return;
//     }

//     if (this.status.status === "stopped") {
//       this.logger("All services already stopped");
//       return;
//     }

//     this.isStopping = true;
//     const startTime = Date.now();
//     this.status.status = "stopping";
//     this.emit("shutdown:start");

//     this.logger("Stopping all services...");

//     try {
//       // Stop in reverse order of startup

//       // 6. Telegram Bot
//       if (this.config.enableTelegramBot) {
//         await this.stopService("telegramBot", async () => {
//           await this.telegramBot.stop();
//         });
//       }

//       // 5. AlertGeneratorService
//       if (this.config.enableAlertGenerator) {
//         await this.stopService("alertGenerator", async () => {
//           this.alertGeneratorService.stop();
//         });
//       }

//       // 4. WalletProfilerService
//       if (this.config.enableWalletProfiler) {
//         await this.stopService("walletProfiler", async () => {
//           this.walletProfilerService.stop();
//         });
//       }

//       // 3. TradeStreamService
//       if (this.config.enableTradeStream) {
//         await this.stopService("tradeStream", async () => {
//           this.tradeStreamService.stop();
//         });
//       }

//       // 2. MarketSyncService
//       if (this.config.enableMarketSync) {
//         await this.stopService("marketSync", async () => {
//           this.marketSyncService.stop();
//         });
//       }

//       // 1. Database connection
//       await this.stopService("database", async () => {
//         stopHealthChecks();
//         await disconnectPrisma();
//         this.status.databaseHealthy = false;
//       });

//       // Reset status
//       this.initializeServiceStatus();
//       this.status.status = "stopped";
//       this.status.allRunning = false;
//       this.status.hasErrors = false;
//       this.status.startupCompletedAt = null;
//       this.status.startupTimeMs = null;

//       const shutdownTimeMs = Date.now() - startTime;
//       this.logger("Shutdown complete", { timeMs: shutdownTimeMs });
//       this.emit("shutdown:complete", { timeMs: shutdownTimeMs });
//     } finally {
//       this.isStopping = false;
//     }
//   }

//   /**
//    * Stop an individual service with error handling
//    */
//   private async stopService(
//     name: string,
//     stopFn: () => Promise<void>
//   ): Promise<void> {
//     const service = this.status.services.find((s) => s.name === name);
//     if (!service || service.status === "stopped") {
//       return;
//     }

//     this.updateServiceStatus(name, "stopping");
//     this.logger(`Stopping ${name}...`);

//     try {
//       await stopFn();
//       this.updateServiceStatus(name, "stopped");
//       this.emit("service:stopped", { service: name });
//       this.logger(`${name} stopped successfully`);
//     } catch (error) {
//       const err = error instanceof Error ? error : new Error(String(error));
//       this.logger(`${name} failed to stop cleanly`, { error: err.message });
//       // Force status to stopped anyway
//       this.updateServiceStatus(name, "stopped");
//     }
//   }

//   /**
//    * Get the current startup status.
//    */
//   getStatus(): StartupStatus {
//     this.calculateOverallStatus();
//     return { ...this.status };
//   }

//   /**
//    * Check if all services are running.
//    */
//   isAllRunning(): boolean {
//     this.calculateOverallStatus();
//     return this.status.allRunning;
//   }

//   /**
//    * Check if any service has errors.
//    */
//   hasErrors(): boolean {
//     return this.status.hasErrors;
//   }

//   /**
//    * Get status of a specific service.
//    */
//   getServiceStatus(name: string): ServiceInfo | undefined {
//     return this.status.services.find((s) => s.name === name);
//   }

//   /**
//    * Get the MarketSyncService instance.
//    */
//   getMarketSyncService(): MarketSyncService {
//     return this.marketSyncService;
//   }

//   /**
//    * Get the TradeStreamService instance.
//    */
//   getTradeStreamService(): TradeStreamService {
//     return this.tradeStreamService;
//   }

//   /**
//    * Get the WalletProfilerService instance.
//    */
//   getWalletProfilerService(): WalletProfilerService {
//     return this.walletProfilerService;
//   }

//   /**
//    * Get the AlertGeneratorService instance.
//    */
//   getAlertGeneratorService(): AlertGeneratorService {
//     return this.alertGeneratorService;
//   }

//   /**
//    * Get the TelegramBotClient instance.
//    */
//   getTelegramBot(): TelegramBotClient {
//     return this.telegramBot;
//   }

//   /**
//    * Perform a graceful shutdown on process signals.
//    *
//    * This sets up handlers for SIGINT and SIGTERM to gracefully
//    * stop all services before the process exits.
//    */
//   setupGracefulShutdown(): void {
//     const shutdown = async (signal: string) => {
//       this.logger(`Received ${signal}, initiating graceful shutdown...`);
//       try {
//         await this.stopAllServices();
//         this.logger("Graceful shutdown complete");
//         process.exit(0);
//       } catch (error) {
//         this.logger("Error during shutdown", {
//           error: error instanceof Error ? error.message : String(error),
//         });
//         process.exit(1);
//       }
//     };

//     process.on("SIGINT", () => shutdown("SIGINT"));
//     process.on("SIGTERM", () => shutdown("SIGTERM"));

//     this.logger("Graceful shutdown handlers registered");
//   }

//   /**
//    * Dispose of the orchestrator and all services.
//    */
//   async dispose(): Promise<void> {
//     await this.stopAllServices();
//     this.removeAllListeners();
//     this.logger("Orchestrator disposed");
//   }
// }

// // ============================================================================
// // Singleton and Factory
// // ============================================================================

// /**
//  * Default startup orchestrator instance.
//  */
// export const startupOrchestrator = new StartupOrchestrator();

// /**
//  * Create a new startup orchestrator instance with custom configuration.
//  */
// export function createStartupOrchestrator(
//   config: StartupConfig = {}
// ): StartupOrchestrator {
//   return new StartupOrchestrator(config);
// }

// /**
//  * Convenience function to start all services with default configuration.
//  */
// export async function startAllServices(
//   config: StartupConfig = {}
// ): Promise<StartupStatus> {
//   const orchestrator = config.services ? createStartupOrchestrator(config) : startupOrchestrator;
//   return orchestrator.startAllServices();
// }

// /**
//  * Convenience function to stop all services.
//  */
// export async function stopAllServices(): Promise<void> {
//   return startupOrchestrator.stopAllServices();
// }


/**
 * Application Startup Orchestrator (Production)
 *
 * Manages the lifecycle of all background services in the correct order.
 * Uses REST polling for trades instead of unstable WebSocket.
 */

import { EventEmitter } from "events";
import {
  prisma,
  performHealthCheck,
  startHealthChecks,
  stopHealthChecks,
  disconnectPrisma,
} from "../db/client";
import {
  MarketSyncService,
  marketSyncService,
  type MarketSyncConfig,
} from "./market-sync";
import {
  TradePollingService,
  createTradePollingService,
  type TradePollingConfig,
} from "./trade-polling";
import {
  WalletProfilerService,
  walletProfilerService,
  type WalletProfilerServiceConfig,
} from "./wallet-profiler";
import {
  AlertGeneratorService,
  alertGeneratorService,
  type AlertGeneratorConfig,
} from "./alert-generator";
import {
  TelegramBotClient,
  getTelegramBot,
} from "../telegram/bot";
import { env, logConfig } from "../../config/env";

// ============================================================================
// Types
// ============================================================================

export interface StartupConfig {
  enableMarketSync?: boolean;
  enableTradePolling?: boolean;
  enableWalletProfiler?: boolean;
  enableAlertGenerator?: boolean;
  enableTelegramBot?: boolean;
  enableDbHealthChecks?: boolean;
  dbHealthCheckIntervalMs?: number;
  logConfiguration?: boolean;
  services?: {
    marketSync?: MarketSyncService;
    tradePolling?: TradePollingService;
    walletProfiler?: WalletProfilerService;
    alertGenerator?: AlertGeneratorService;
    telegramBot?: TelegramBotClient;
  };
  marketSyncConfig?: MarketSyncConfig;
  tradePollingConfig?: TradePollingConfig;
  walletProfilerConfig?: WalletProfilerServiceConfig;
  alertGeneratorConfig?: AlertGeneratorConfig;
  logger?: (message: string, data?: Record<string, unknown>) => void;
}

export type ServiceStatus = "stopped" | "starting" | "running" | "stopping" | "error";

export interface ServiceInfo {
  name: string;
  status: ServiceStatus;
  startedAt: Date | null;
  error: string | null;
}

export interface StartupStatus {
  allRunning: boolean;
  hasErrors: boolean;
  status: "stopped" | "starting" | "running" | "stopping" | "error" | "partial";
  services: ServiceInfo[];
  databaseHealthy: boolean;
  startupCompletedAt: Date | null;
  startupTimeMs: number | null;
}

// ============================================================================
// StartupOrchestrator Class
// ============================================================================

export class StartupOrchestrator extends EventEmitter {
  private config: {
    enableMarketSync: boolean;
    enableTradePolling: boolean;
    enableWalletProfiler: boolean;
    enableAlertGenerator: boolean;
    enableTelegramBot: boolean;
    enableDbHealthChecks: boolean;
    dbHealthCheckIntervalMs: number;
    logConfiguration: boolean;
  };

  private readonly marketSyncService: MarketSyncService;
  private tradePollingService: TradePollingService | null = null;
  private readonly walletProfilerService: WalletProfilerService;
  private readonly alertGeneratorService: AlertGeneratorService;
  private readonly telegramBot: TelegramBotClient;
  private readonly logger: (message: string, data?: Record<string, unknown>) => void;

  private status: StartupStatus = {
    allRunning: false,
    hasErrors: false,
    status: "stopped",
    services: [],
    databaseHealthy: false,
    startupCompletedAt: null,
    startupTimeMs: null,
  };

  private isStarting = false;
  private isStopping = false;

  constructor(config: StartupConfig = {}) {
    super();

    this.config = {
      enableMarketSync: config.enableMarketSync ?? false,
      enableTradePolling: config.enableTradePolling ?? true,
      enableWalletProfiler: config.enableWalletProfiler ?? true,
      enableAlertGenerator: config.enableAlertGenerator ?? true,
      enableTelegramBot: config.enableTelegramBot ?? !!env.TELEGRAM_BOT_TOKEN,
      enableDbHealthChecks: config.enableDbHealthChecks ?? env.isProduction,
      dbHealthCheckIntervalMs: config.dbHealthCheckIntervalMs ?? 30000,
      logConfiguration: config.logConfiguration ?? true,
    };

    this.marketSyncService = config.services?.marketSync ?? marketSyncService;
    this.walletProfilerService = config.services?.walletProfiler ?? walletProfilerService;
    this.alertGeneratorService = config.services?.alertGenerator ?? alertGeneratorService;
    this.telegramBot = config.services?.telegramBot ?? getTelegramBot();
    this.logger = config.logger ?? this.defaultLogger.bind(this);

    this.initializeServiceStatus();
  }

  private defaultLogger(message: string, data?: Record<string, unknown>): void {
    const timestamp = new Date().toISOString();
    if (data) {
      console.log(`[${timestamp}] [StartupOrchestrator] ${message}`, data);
    } else {
      console.log(`[${timestamp}] [StartupOrchestrator] ${message}`);
    }
  }

  private initializeServiceStatus(): void {
    this.status.services = [
      { name: "database", status: "stopped", startedAt: null, error: null },
      { name: "marketSync", status: "stopped", startedAt: null, error: null },
      { name: "tradePolling", status: "stopped", startedAt: null, error: null },
      { name: "walletProfiler", status: "stopped", startedAt: null, error: null },
      { name: "alertGenerator", status: "stopped", startedAt: null, error: null },
      { name: "telegramBot", status: "stopped", startedAt: null, error: null },
    ];
  }

  private updateServiceStatus(name: string, status: ServiceStatus, error?: string | null): void {
    const service = this.status.services.find((s) => s.name === name);
    if (service) {
      service.status = status;
      if (status === "running") {
        service.startedAt = new Date();
        service.error = null;
      } else if (status === "error") {
        service.error = error ?? "Unknown error";
      } else if (status === "stopped") {
        service.startedAt = null;
        service.error = null;
      }
    }
  }

  private calculateOverallStatus(): void {
    const enabledServices = this.getEnabledServiceNames();
    const enabledStatuses = this.status.services.filter((s) =>
      enabledServices.includes(s.name)
    );

    const allRunning = enabledStatuses.every((s) => s.status === "running");
    const hasErrors = enabledStatuses.some((s) => s.status === "error");
    const anyStarting = enabledStatuses.some((s) => s.status === "starting");
    const anyStopping = enabledStatuses.some((s) => s.status === "stopping");
    const allStopped = enabledStatuses.every((s) => s.status === "stopped");

    this.status.allRunning = allRunning;
    this.status.hasErrors = hasErrors;

    if (allStopped) {
      this.status.status = "stopped";
    } else if (anyStarting) {
      this.status.status = "starting";
    } else if (anyStopping) {
      this.status.status = "stopping";
    } else if (hasErrors && !allRunning) {
      this.status.status = "partial";
    } else if (hasErrors) {
      this.status.status = "error";
    } else if (allRunning) {
      this.status.status = "running";
    } else {
      this.status.status = "partial";
    }
  }

  private getEnabledServiceNames(): string[] {
    const names: string[] = ["database"];
    if (this.config.enableMarketSync) names.push("marketSync");
    if (this.config.enableTradePolling) names.push("tradePolling");
    if (this.config.enableWalletProfiler) names.push("walletProfiler");
    if (this.config.enableAlertGenerator) names.push("alertGenerator");
    if (this.config.enableTelegramBot) names.push("telegramBot");
    return names;
  }

  async startAllServices(): Promise<StartupStatus> {
    if (this.isStarting) {
      this.logger("Startup already in progress");
      return this.status;
    }

    if (this.status.status === "running") {
      this.logger("All services already running");
      return this.status;
    }

    this.isStarting = true;
    const startTime = Date.now();
    this.status.status = "starting";
    this.emit("startup:start");

    if (this.config.logConfiguration) {
      logConfig();
    }

    this.logger("Starting all services", {
      enableMarketSync: this.config.enableMarketSync,
      enableTradePolling: this.config.enableTradePolling,
      enableWalletProfiler: this.config.enableWalletProfiler,
      enableAlertGenerator: this.config.enableAlertGenerator,
      enableTelegramBot: this.config.enableTelegramBot,
    });

    try {
      // 1. Database connection
      await this.startDatabase();

      // 2. MarketSyncService
      if (this.config.enableMarketSync) {
        await this.startService("marketSync", async () => {
          await this.marketSyncService.start();
        });
      }

      // 3. TradePollingService (REST polling - more reliable than WebSocket)
      if (this.config.enableTradePolling) {
        await this.startService("tradePolling", async () => {
          this.tradePollingService = createTradePollingService({
            pollIntervalMs: 30000,
            whaleThreshold: env.WHALE_THRESHOLD_USD,
            autoCreateWallets: true,
          });

          // Log whale trades
          this.tradePollingService.on("trade:whale", (event) => {
            this.logger("🐋 Whale trade detected!", {
              usdValue: event.usdValue,
              wallet: event.walletAddress,
            });
          });

          await this.tradePollingService.start();
        });
      }

      // 4. WalletProfilerService
      if (this.config.enableWalletProfiler) {
        await this.startService("walletProfiler", async () => {
          this.walletProfilerService.start();
        });
      }

      // 5. AlertGeneratorService
      if (this.config.enableAlertGenerator) {
        await this.startService("alertGenerator", async () => {
          await this.alertGeneratorService.start();
        });
      }

      // 6. Telegram Bot
      if (this.config.enableTelegramBot) {
        await this.startService("telegramBot", async () => {
          const result = await this.telegramBot.initialize();
          if (!result.success) {
            throw new Error(result.error ?? "Failed to initialize Telegram bot");
          }
          await this.telegramBot.start();
        });
      }

      this.calculateOverallStatus();
      this.status.startupCompletedAt = new Date();
      this.status.startupTimeMs = Date.now() - startTime;

      this.logger("Startup complete", {
        status: this.status.status,
        timeMs: this.status.startupTimeMs,
        runningServices: this.status.services
          .filter((s) => s.status === "running")
          .map((s) => s.name),
      });

      this.emit("startup:complete", {
        status: this.status,
        timeMs: this.status.startupTimeMs,
      });

      return this.status;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger("Startup failed", { error: err.message });
      this.status.hasErrors = true;
      this.calculateOverallStatus();
      throw error;
    } finally {
      this.isStarting = false;
    }
  }

  private async startDatabase(): Promise<void> {
    this.updateServiceStatus("database", "starting");
    this.logger("Connecting to database...");

    try {
      const healthResult = await performHealthCheck(prisma);

      if (!healthResult.healthy) {
        throw new Error(healthResult.error ?? "Database connection failed");
      }

      this.status.databaseHealthy = true;
      this.updateServiceStatus("database", "running");
      this.emit("service:started", { service: "database" });

      if (this.config.enableDbHealthChecks) {
        startHealthChecks(prisma, this.config.dbHealthCheckIntervalMs);
        this.logger("Database health checks started", {
          intervalMs: this.config.dbHealthCheckIntervalMs,
        });
      }

      this.logger("Database connected", {
        responseTimeMs: healthResult.responseTimeMs,
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.updateServiceStatus("database", "error", err.message);
      this.status.databaseHealthy = false;
      this.emit("startup:error", { service: "database", error: err });
      throw new Error(`Critical: Database connection failed - ${err.message}`);
    }
  }

  private async startService(name: string, startFn: () => Promise<void>): Promise<void> {
    this.updateServiceStatus(name, "starting");
    this.logger(`Starting ${name}...`);

    try {
      await startFn();
      this.updateServiceStatus(name, "running");
      this.emit("service:started", { service: name });
      this.logger(`${name} started successfully`);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.updateServiceStatus(name, "error", err.message);
      this.emit("startup:error", { service: name, error: err });
      this.logger(`${name} failed to start`, { error: err.message });
    }
  }

  async stopAllServices(): Promise<void> {
    if (this.isStopping) {
      this.logger("Shutdown already in progress");
      return;
    }

    if (this.status.status === "stopped") {
      this.logger("All services already stopped");
      return;
    }

    this.isStopping = true;
    const startTime = Date.now();
    this.status.status = "stopping";
    this.emit("shutdown:start");

    this.logger("Stopping all services...");

    try {
      if (this.config.enableTelegramBot) {
        await this.stopService("telegramBot", async () => {
          await this.telegramBot.stop();
        });
      }

      if (this.config.enableAlertGenerator) {
        await this.stopService("alertGenerator", async () => {
          this.alertGeneratorService.stop();
        });
      }

      if (this.config.enableWalletProfiler) {
        await this.stopService("walletProfiler", async () => {
          this.walletProfilerService.stop();
        });
      }

      if (this.config.enableTradePolling && this.tradePollingService) {
        await this.stopService("tradePolling", async () => {
          this.tradePollingService?.stop();
          this.tradePollingService = null;
        });
      }

      if (this.config.enableMarketSync) {
        await this.stopService("marketSync", async () => {
          this.marketSyncService.stop();
        });
      }

      await this.stopService("database", async () => {
        stopHealthChecks();
        await disconnectPrisma();
        this.status.databaseHealthy = false;
      });

      this.initializeServiceStatus();
      this.status.status = "stopped";
      this.status.allRunning = false;
      this.status.hasErrors = false;
      this.status.startupCompletedAt = null;
      this.status.startupTimeMs = null;

      const shutdownTimeMs = Date.now() - startTime;
      this.logger("Shutdown complete", { timeMs: shutdownTimeMs });
      this.emit("shutdown:complete", { timeMs: shutdownTimeMs });
    } finally {
      this.isStopping = false;
    }
  }

  private async stopService(name: string, stopFn: () => Promise<void>): Promise<void> {
    const service = this.status.services.find((s) => s.name === name);
    if (!service || service.status === "stopped") return;

    this.updateServiceStatus(name, "stopping");
    this.logger(`Stopping ${name}...`);

    try {
      await stopFn();
      this.updateServiceStatus(name, "stopped");
      this.emit("service:stopped", { service: name });
      this.logger(`${name} stopped successfully`);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger(`${name} failed to stop cleanly`, { error: err.message });
      this.updateServiceStatus(name, "stopped");
    }
  }

  getStatus(): StartupStatus {
    this.calculateOverallStatus();
    return { ...this.status };
  }

  isAllRunning(): boolean {
    this.calculateOverallStatus();
    return this.status.allRunning;
  }

  hasErrors(): boolean {
    return this.status.hasErrors;
  }

  getServiceStatus(name: string): ServiceInfo | undefined {
    return this.status.services.find((s) => s.name === name);
  }

  getMarketSyncService(): MarketSyncService {
    return this.marketSyncService;
  }

  getTradePollingService(): TradePollingService | null {
    return this.tradePollingService;
  }

  getWalletProfilerService(): WalletProfilerService {
    return this.walletProfilerService;
  }

  getAlertGeneratorService(): AlertGeneratorService {
    return this.alertGeneratorService;
  }

  getTelegramBot(): TelegramBotClient {
    return this.telegramBot;
  }

  setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      this.logger(`Received ${signal}, initiating graceful shutdown...`);
      try {
        await this.stopAllServices();
        this.logger("Graceful shutdown complete");
        process.exit(0);
      } catch (error) {
        this.logger("Error during shutdown", {
          error: error instanceof Error ? error.message : String(error),
        });
        process.exit(1);
      }
    };

    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));

    this.logger("Graceful shutdown handlers registered");
  }

  async dispose(): Promise<void> {
    await this.stopAllServices();
    this.removeAllListeners();
    this.logger("Orchestrator disposed");
  }
}

// ============================================================================
// Exports
// ============================================================================

export const startupOrchestrator = new StartupOrchestrator();

export function createStartupOrchestrator(config: StartupConfig = {}): StartupOrchestrator {
  return new StartupOrchestrator(config);
}

export async function startAllServices(config: StartupConfig = {}): Promise<StartupStatus> {
  const orchestrator = config.services ? createStartupOrchestrator(config) : startupOrchestrator;
  return orchestrator.startAllServices();
}

export async function stopAllServices(): Promise<void> {
  return startupOrchestrator.stopAllServices();
}