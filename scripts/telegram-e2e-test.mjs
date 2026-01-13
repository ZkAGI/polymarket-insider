#!/usr/bin/env node
/**
 * E2E test for Telegram bot setup
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

    console.log("\n✅ All Telegram E2E tests passed!");
    return true;
  } catch (error) {
    console.error("\n❌ Telegram E2E test failed:", error.message);
    return false;
  }
}

const success = await runTelegramE2ETest();
process.exit(success ? 0 : 1);
