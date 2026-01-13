#!/usr/bin/env node
/**
 * E2E test for Telegram bot setup, alert formatting, and notification service
 * Tests that the Telegram module can be imported and used correctly
 */

async function runTelegramE2ETest() {
  console.log("Running Telegram E2E test...");

  try {
    // Dynamic import of the Telegram module
    const {
      TelegramClient,
      TelegramClientError,
      createTelegramClient,
      getTelegramClient,
      resetTelegramClient,
      TelegramParseMode,
      TelegramMessageStatus,
      isValidBotToken,
      isValidChatId,
      escapeMarkdownV2,
      escapeHtml,
      formatChatId,
      // Alert formatter
      formatTelegramAlert,
      createAlertMessage,
      formatAlertSummary,
      createAlertButtons,
      getSeverityEmoji,
      getAlertTypeEmoji,
      getAlertTypeLabel,
      validateAlertData,
      ALERT_TYPE_CONFIG,
      SEVERITY_CONFIG,
      // Notification Service
      TelegramNotificationService,
      createNotificationService,
      getNotificationService,
      resetNotificationService,
      sendInstantAlert,
      sendInstantAlertToMany,
    } = await import("../src/notifications/telegram/index.ts");

    console.log("1. Module imports successful");

    // Test helper functions
    console.log("2. Testing helper functions...");

    // Test token validation
    if (!isValidBotToken("123456789:ABCdefGHIjklMNOpqrsTUVwxyz1234567890")) {
      throw new Error("isValidBotToken failed for valid token");
    }
    if (isValidBotToken("invalid")) {
      throw new Error("isValidBotToken should return false for invalid token");
    }
    console.log("   - isValidBotToken: OK");

    // Test chat ID validation
    if (!isValidChatId(123456789)) {
      throw new Error("isValidChatId failed for valid numeric ID");
    }
    if (!isValidChatId("@testchannel")) {
      throw new Error("isValidChatId failed for valid username");
    }
    if (isValidChatId(0)) {
      throw new Error("isValidChatId should return false for zero");
    }
    console.log("   - isValidChatId: OK");

    // Test escape functions
    const mdEscaped = escapeMarkdownV2("Hello *world*!");
    if (!mdEscaped.includes("\\*")) {
      throw new Error("escapeMarkdownV2 failed to escape asterisks");
    }
    console.log("   - escapeMarkdownV2: OK");

    const htmlEscaped = escapeHtml("<script>alert('xss')</script>");
    if (!htmlEscaped.includes("&lt;")) {
      throw new Error("escapeHtml failed to escape less than");
    }
    console.log("   - escapeHtml: OK");

    // Test formatChatId
    if (formatChatId("@channel") !== "@channel") {
      throw new Error("formatChatId failed for username");
    }
    if (formatChatId(123456789) !== "123456789") {
      throw new Error("formatChatId failed for number");
    }
    console.log("   - formatChatId: OK");

    // Test client creation in dev mode
    console.log("3. Testing TelegramClient creation...");

    const client = createTelegramClient({
      botToken: "test-token-for-testing",
      devMode: true,
    });

    if (!client.isDevMode()) {
      throw new Error("Client should be in dev mode");
    }
    console.log("   - Client created in dev mode: OK");

    // Test getConfig
    const config = client.getConfig();
    if (!config.botToken.includes("****")) {
      throw new Error("getConfig should mask the token");
    }
    console.log("   - getConfig masks token: OK");

    // Test getStats
    const stats = client.getStats();
    if (stats.sent !== 0 || stats.failed !== 0 || stats.total !== 0) {
      throw new Error("Initial stats should all be 0");
    }
    console.log("   - getStats initial values: OK");

    // Test sending a message in dev mode
    console.log("4. Testing message sending in dev mode...");

    const result = await client.sendMessage({
      chatId: 123456789,
      text: "Hello, World! This is a test message.",
    });

    if (result.status !== TelegramMessageStatus.SENT) {
      throw new Error("Message should be marked as sent in dev mode");
    }
    if (!result.messageId) {
      throw new Error("Message should have an ID");
    }
    console.log("   - Message send result: OK");

    // Test stats after sending
    const statsAfter = client.getStats();
    if (statsAfter.sent !== 1 || statsAfter.total !== 1) {
      throw new Error("Stats should reflect sent message");
    }
    console.log("   - Stats updated after send: OK");

    // Test batch sending
    console.log("5. Testing batch message sending...");

    const batchResult = await client.sendBatch([
      { chatId: 1, text: "Message 1" },
      { chatId: 2, text: "Message 2" },
      { chatId: 3, text: "Message 3" },
    ]);

    if (batchResult.total !== 3 || batchResult.sent !== 3) {
      throw new Error("Batch send should send all 3 messages");
    }
    console.log("   - Batch send: OK");

    // Test getMe
    console.log("6. Testing getMe...");
    const me = await client.getMe();
    if (!me.is_bot || !me.first_name) {
      throw new Error("getMe should return bot info");
    }
    console.log("   - getMe: OK");

    // Test setCommands
    console.log("7. Testing setCommands...");
    const setResult = await client.setCommands([
      { command: "start", description: "Start the bot" },
      { command: "help", description: "Get help" },
    ]);
    if (!setResult) {
      throw new Error("setCommands should return true");
    }
    console.log("   - setCommands: OK");

    // Test event handlers
    console.log("8. Testing event handlers...");
    let eventReceived = false;
    const unsubscribe = client.on("message:sent", () => {
      eventReceived = true;
    });

    await client.sendMessage({
      chatId: 123456789,
      text: "Event test message",
    });

    if (!eventReceived) {
      throw new Error("Event handler should have been called");
    }
    unsubscribe();
    console.log("   - Event handlers: OK");

    // Test command handler registration
    console.log("9. Testing command handler registration...");
    let commandHandlerRegistered = false;
    const unsubscribeCmd = client.onCommand("test", () => {
      commandHandlerRegistered = true;
    });
    if (typeof unsubscribeCmd !== "function") {
      throw new Error("onCommand should return unsubscribe function");
    }
    unsubscribeCmd();
    console.log("   - Command handler registration: OK");

    // Test singleton pattern
    console.log("10. Testing singleton pattern...");
    resetTelegramClient();
    const singleton1 = getTelegramClient();
    const singleton2 = getTelegramClient();
    if (singleton1 !== singleton2) {
      throw new Error("getTelegramClient should return singleton");
    }
    console.log("   - Singleton pattern: OK");

    // Test polling
    console.log("11. Testing polling state...");
    if (singleton1.isPolling()) {
      throw new Error("Should not be polling initially");
    }
    await singleton1.startPolling();
    if (!singleton1.isPolling()) {
      throw new Error("Should be polling after startPolling");
    }
    await singleton1.stopPolling();
    if (singleton1.isPolling()) {
      throw new Error("Should not be polling after stopPolling");
    }
    console.log("   - Polling state: OK");

    // Test TelegramClientError
    console.log("12. Testing TelegramClientError...");
    const error = new TelegramClientError("Test error", "TEST_CODE", {
      statusCode: 400,
      retryable: true,
    });
    if (error.code !== "TEST_CODE" || error.statusCode !== 400 || !error.retryable) {
      throw new Error("TelegramClientError properties not set correctly");
    }
    console.log("   - TelegramClientError: OK");

    // === ALERT FORMATTER TESTS ===
    console.log("\n=== Alert Formatter Tests ===\n");

    // Test alert data structure
    console.log("13. Testing alert formatter...");
    const sampleAlert = {
      alertId: "e2e-test-123",
      alertType: "whale_trade",
      severity: "high",
      title: "E2E Test Alert",
      message: "This is a test alert for E2E testing.",
      timestamp: new Date(),
      walletAddress: "0x1234567890abcdef1234567890abcdef12345678",
      marketId: "test-market",
      marketTitle: "Test Market Title",
      tradeSize: 50000,
      priceChange: 5.5,
      suspicionScore: 75,
      actionUrl: "https://example.com/alert",
      dashboardUrl: "https://example.com/dashboard",
    };

    // Test formatTelegramAlert
    const formatted = formatTelegramAlert(sampleAlert);
    if (!formatted.text || !formatted.text.includes("E2E Test Alert")) {
      throw new Error("formatTelegramAlert should include alert title");
    }
    if (!formatted.text.includes("HIGH")) {
      throw new Error("formatTelegramAlert should include severity");
    }
    if (!formatted.text.includes("Whale Trade")) {
      throw new Error("formatTelegramAlert should include alert type");
    }
    console.log("   - formatTelegramAlert: OK");

    // Test createAlertMessage
    const alertMessage = createAlertMessage(123456789, sampleAlert);
    if (alertMessage.chatId !== 123456789) {
      throw new Error("createAlertMessage should set correct chatId");
    }
    if (!alertMessage.text.includes("E2E Test Alert")) {
      throw new Error("createAlertMessage should include alert content");
    }
    if (!alertMessage.options?.inlineKeyboard) {
      throw new Error("createAlertMessage should include inline keyboard");
    }
    console.log("   - createAlertMessage: OK");

    // Test createAlertButtons
    const buttons = createAlertButtons(sampleAlert);
    if (!buttons.buttons || buttons.buttons.length === 0) {
      throw new Error("createAlertButtons should create buttons");
    }
    const allButtons = buttons.buttons.flat();
    if (!allButtons.some(b => b.text.includes("View Details"))) {
      throw new Error("createAlertButtons should include View Details button");
    }
    if (!allButtons.some(b => b.text.includes("Acknowledge"))) {
      throw new Error("createAlertButtons should include Acknowledge button");
    }
    console.log("   - createAlertButtons: OK");

    // Test formatAlertSummary
    const alerts = [sampleAlert, { ...sampleAlert, severity: "critical", alertType: "insider_activity" }];
    const summary = formatAlertSummary(alerts);
    if (!summary.includes("Alert Summary")) {
      throw new Error("formatAlertSummary should include title");
    }
    if (!summary.includes("2 alerts")) {
      throw new Error("formatAlertSummary should show alert count");
    }
    console.log("   - formatAlertSummary: OK");

    // Test helper functions
    console.log("14. Testing alert helper functions...");
    if (getSeverityEmoji("critical") !== "🔴") {
      throw new Error("getSeverityEmoji should return correct emoji");
    }
    if (getAlertTypeEmoji("whale_trade") !== "🐋") {
      throw new Error("getAlertTypeEmoji should return correct emoji");
    }
    if (getAlertTypeLabel("whale_trade") !== "Whale Trade") {
      throw new Error("getAlertTypeLabel should return correct label");
    }
    console.log("   - Helper functions: OK");

    // Test validateAlertData
    console.log("15. Testing alert validation...");
    const validationErrors = validateAlertData(sampleAlert);
    if (validationErrors.length !== 0) {
      throw new Error("validateAlertData should return no errors for valid data");
    }
    const invalidAlert = { ...sampleAlert, alertId: "", alertType: "invalid" };
    const invalidErrors = validateAlertData(invalidAlert);
    if (invalidErrors.length === 0) {
      throw new Error("validateAlertData should return errors for invalid data");
    }
    console.log("   - Validation: OK");

    // Test ALERT_TYPE_CONFIG
    console.log("16. Testing alert type config...");
    const alertTypes = ["whale_trade", "price_movement", "insider_activity", "fresh_wallet"];
    for (const type of alertTypes) {
      if (!ALERT_TYPE_CONFIG[type]) {
        throw new Error(`ALERT_TYPE_CONFIG missing config for ${type}`);
      }
    }
    console.log("   - ALERT_TYPE_CONFIG: OK");

    // Test SEVERITY_CONFIG
    console.log("17. Testing severity config...");
    const severities = ["critical", "high", "medium", "low", "info"];
    for (const severity of severities) {
      if (!SEVERITY_CONFIG[severity]) {
        throw new Error(`SEVERITY_CONFIG missing config for ${severity}`);
      }
    }
    console.log("   - SEVERITY_CONFIG: OK");

    // === NOTIFICATION SERVICE TESTS ===
    console.log("\n=== Notification Service Tests ===\n");

    // Test notification service creation
    console.log("18. Testing notification service creation...");
    resetNotificationService();
    const notificationService = createNotificationService({
      client: createTelegramClient({ botToken: "test-token", devMode: true }),
    });
    if (!(notificationService instanceof TelegramNotificationService)) {
      throw new Error("createNotificationService should return TelegramNotificationService");
    }
    console.log("   - Service creation: OK");

    // Test sendAlert
    console.log("19. Testing sendAlert...");
    const alertData = {
      alertId: "e2e-notif-test-123",
      alertType: "whale_trade",
      severity: "high",
      title: "E2E Notification Test",
      message: "Testing notification service send.",
      timestamp: new Date(),
      walletAddress: "0x1234567890abcdef1234567890abcdef12345678",
      tradeSize: 100000,
    };
    const sendResult = await notificationService.sendAlert(
      { chatId: 123456789, name: "Test User" },
      alertData
    );
    if (!sendResult.success) {
      throw new Error("sendAlert should succeed");
    }
    if (!sendResult.messageId) {
      throw new Error("sendAlert should return messageId");
    }
    console.log("   - sendAlert: OK");

    // Test recipient filtering - disabled
    console.log("20. Testing recipient filtering...");
    const disabledResult = await notificationService.sendAlert(
      { chatId: 123, enabled: false },
      alertData
    );
    if (!disabledResult.skipped || disabledResult.skipReason !== "Recipient disabled") {
      throw new Error("Disabled recipient should be skipped");
    }
    console.log("   - Disabled recipient skip: OK");

    // Test priority filtering
    const urgentOnlyResult = await notificationService.sendAlert(
      { chatId: 123, minPriority: "urgent" },
      { ...alertData, severity: "medium" }
    );
    if (!urgentOnlyResult.skipped) {
      throw new Error("Medium severity should be skipped for urgent priority");
    }
    console.log("   - Priority filtering: OK");

    // Test muted types
    const mutedResult = await notificationService.sendAlert(
      { chatId: 123, mutedTypes: ["whale_trade"] },
      alertData
    );
    if (!mutedResult.skipped || !mutedResult.skipReason.includes("muted")) {
      throw new Error("Muted type should be skipped");
    }
    console.log("   - Muted types: OK");

    // Test sendAlertToMany
    console.log("21. Testing sendAlertToMany...");
    const notifBatchResult = await notificationService.sendAlertToMany(
      [
        { chatId: 1, name: "User 1" },
        { chatId: 2, name: "User 2" },
        { chatId: 3, name: "User 3", enabled: false },
      ],
      alertData
    );
    if (notifBatchResult.total !== 3) {
      throw new Error("Batch total should be 3");
    }
    if (notifBatchResult.delivered !== 2) {
      throw new Error("Batch delivered should be 2");
    }
    if (notifBatchResult.skipped !== 1) {
      throw new Error("Batch skipped should be 1");
    }
    console.log("   - sendAlertToMany: OK");

    // Test delivery history
    console.log("22. Testing delivery history...");
    const historyResult = notificationService.getDeliveryResult(alertData.alertId);
    if (!historyResult || historyResult.delivered !== 2) {
      throw new Error("Delivery history should be stored");
    }
    const allHistory = notificationService.getDeliveryHistory();
    if (allHistory.length === 0) {
      throw new Error("getDeliveryHistory should return entries");
    }
    console.log("   - Delivery history: OK");

    // Test statistics
    console.log("23. Testing statistics...");
    const notifStats = notificationService.getStats();
    if (notifStats.totalSent < 1) {
      throw new Error("Stats should track sent notifications");
    }
    if (notifStats.totalSkipped < 1) {
      throw new Error("Stats should track skipped notifications");
    }
    if (typeof notifStats.successRate !== "number") {
      throw new Error("Stats should include success rate");
    }
    console.log("   - Statistics: OK");

    // Test event handlers
    console.log("24. Testing notification event handlers...");
    let eventFired = false;
    const unsubNotif = notificationService.on("notification:sent", () => {
      eventFired = true;
    });
    await notificationService.sendAlert({ chatId: 999 }, alertData);
    if (!eventFired) {
      throw new Error("notification:sent event should fire");
    }
    unsubNotif();
    console.log("   - Event handlers: OK");

    // Test singleton pattern
    console.log("25. Testing notification service singleton...");
    resetNotificationService();
    const notifSingleton1 = getNotificationService();
    const notifSingleton2 = getNotificationService();
    if (notifSingleton1 !== notifSingleton2) {
      throw new Error("getNotificationService should return singleton");
    }
    console.log("   - Singleton pattern: OK");

    // Test helper functions
    console.log("26. Testing helper functions...");
    resetNotificationService();
    const helperResult = await sendInstantAlert(123456789, {
      alertId: "helper-test",
      alertType: "system",
      severity: "medium",
      title: "Helper Test",
      message: "Testing helper function.",
      timestamp: new Date(),
    });
    if (!helperResult.success) {
      throw new Error("sendInstantAlert helper should work");
    }
    console.log("   - sendInstantAlert helper: OK");

    const manyHelperResult = await sendInstantAlertToMany([1, 2, 3], {
      alertId: "many-helper-test",
      alertType: "system",
      severity: "medium",
      title: "Many Helper Test",
      message: "Testing batch helper.",
      timestamp: new Date(),
    });
    if (manyHelperResult.delivered !== 3) {
      throw new Error(`sendInstantAlertToMany helper should work (got delivered=${manyHelperResult.delivered}, total=${manyHelperResult.total})`);
    }
    console.log("   - sendInstantAlertToMany helper: OK");

    console.log("\n✅ All Telegram E2E tests passed!");
    return true;
  } catch (error) {
    console.error("\n❌ Telegram E2E test failed:", error.message);
    return false;
  }
}

const success = await runTelegramE2ETest();
process.exit(success ? 0 : 1);
