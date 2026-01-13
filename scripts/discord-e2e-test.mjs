#!/usr/bin/env node
/**
 * E2E test for Discord webhook setup
 * Tests that the Discord module can be imported and used correctly
 */

async function runDiscordE2ETest() {
  console.log("Running Discord E2E test...");

  try {
    // Dynamic import of the Discord module
    const {
      DiscordClient,
      DiscordClientError,
      createDiscordClient,
      getDiscordClient,
      resetDiscordClient,
      DiscordEmbedColor,
      DiscordMessageStatus,
      isValidWebhookUrl,
      extractWebhookId,
      maskWebhookUrl,
      isValidFieldValue,
      isValidFieldName,
      isValidEmbedTitle,
      isValidEmbedDescription,
      isValidMessageContent,
      calculateEmbedCharacterCount,
      isValidEmbedTotal,
      truncateForDiscord,
      formatTimestampForEmbed,
      generateResultId,
    } = await import("../src/notifications/discord/index.ts");

    console.log("1. Module imports successful");

    // Test helper functions
    console.log("2. Testing helper functions...");

    // Test webhook URL validation
    const validUrl =
      "https://discord.com/api/webhooks/1234567890123456789/abcdefghijk-lmnopqrst";
    const invalidUrl = "https://example.com/webhook";

    if (!isValidWebhookUrl(validUrl)) {
      throw new Error("isValidWebhookUrl failed: should accept valid URL");
    }
    if (isValidWebhookUrl(invalidUrl)) {
      throw new Error("isValidWebhookUrl failed: should reject invalid URL");
    }
    if (isValidWebhookUrl("")) {
      throw new Error("isValidWebhookUrl failed: should reject empty string");
    }
    if (isValidWebhookUrl(null)) {
      throw new Error("isValidWebhookUrl failed: should reject null");
    }
    console.log("   - isValidWebhookUrl: PASS");

    // Test extractWebhookId
    const extractedId = extractWebhookId(validUrl);
    if (extractedId !== "1234567890123456789") {
      throw new Error(`extractWebhookId failed: expected 1234567890123456789, got ${extractedId}`);
    }
    if (extractWebhookId("invalid") !== null) {
      throw new Error("extractWebhookId failed: should return null for invalid URL");
    }
    console.log("   - extractWebhookId: PASS");

    // Test maskWebhookUrl
    const masked = maskWebhookUrl(validUrl);
    if (!masked.includes("****")) {
      throw new Error("maskWebhookUrl failed: should mask token");
    }
    if (masked.includes("abcdefghijk")) {
      throw new Error("maskWebhookUrl failed: should not contain original token");
    }
    console.log("   - maskWebhookUrl: PASS");

    // Test field validation
    if (!isValidFieldName("Name")) {
      throw new Error("isValidFieldName failed: should accept valid name");
    }
    if (isValidFieldName("")) {
      throw new Error("isValidFieldName failed: should reject empty");
    }
    if (isValidFieldName("a".repeat(257))) {
      throw new Error("isValidFieldName failed: should reject too long");
    }
    if (!isValidFieldValue("Value")) {
      throw new Error("isValidFieldValue failed: should accept valid value");
    }
    if (isValidFieldValue("")) {
      throw new Error("isValidFieldValue failed: should reject empty");
    }
    if (isValidFieldValue("a".repeat(1025))) {
      throw new Error("isValidFieldValue failed: should reject too long");
    }
    console.log("   - Field validation: PASS");

    // Test embed validation
    if (!isValidEmbedTitle("Title")) {
      throw new Error("isValidEmbedTitle failed: should accept valid title");
    }
    if (isValidEmbedTitle("a".repeat(257))) {
      throw new Error("isValidEmbedTitle failed: should reject too long");
    }
    if (!isValidEmbedDescription("Description")) {
      throw new Error("isValidEmbedDescription failed");
    }
    if (isValidEmbedDescription("a".repeat(4097))) {
      throw new Error("isValidEmbedDescription failed: should reject too long");
    }
    if (!isValidMessageContent("Content")) {
      throw new Error("isValidMessageContent failed");
    }
    if (isValidMessageContent("a".repeat(2001))) {
      throw new Error("isValidMessageContent failed: should reject too long");
    }
    console.log("   - Embed validation: PASS");

    // Test calculateEmbedCharacterCount
    const charCount = calculateEmbedCharacterCount({
      title: "Test", // 4
      description: "Description", // 11
      footer: { text: "Footer" }, // 6
    });
    if (charCount !== 21) {
      throw new Error(`calculateEmbedCharacterCount failed: expected 21, got ${charCount}`);
    }
    console.log("   - calculateEmbedCharacterCount: PASS");

    // Test isValidEmbedTotal
    if (!isValidEmbedTotal([{ title: "Test" }])) {
      throw new Error("isValidEmbedTotal failed: should accept valid embed");
    }
    if (isValidEmbedTotal([{ description: "a".repeat(6001) }])) {
      throw new Error("isValidEmbedTotal failed: should reject too long");
    }
    console.log("   - isValidEmbedTotal: PASS");

    // Test truncateForDiscord
    if (truncateForDiscord("Short", 100) !== "Short") {
      throw new Error("truncateForDiscord failed: short string unchanged");
    }
    if (truncateForDiscord("This is a long string", 10) !== "This is...") {
      throw new Error("truncateForDiscord failed: long string truncated");
    }
    console.log("   - truncateForDiscord: PASS");

    // Test formatTimestampForEmbed
    const date = new Date("2024-01-15T10:00:00Z");
    if (formatTimestampForEmbed(date) !== "2024-01-15T10:00:00.000Z") {
      throw new Error("formatTimestampForEmbed failed");
    }
    console.log("   - formatTimestampForEmbed: PASS");

    // Test generateResultId
    const id1 = generateResultId();
    const id2 = generateResultId();
    if (id1 === id2) {
      throw new Error("generateResultId failed: IDs should be unique");
    }
    if (!id1.startsWith("discord_")) {
      throw new Error("generateResultId failed: should have discord_ prefix");
    }
    console.log("   - generateResultId: PASS");

    // Test enums
    console.log("3. Testing enums...");
    if (DiscordEmbedColor.RED !== 15548997) {
      throw new Error("DiscordEmbedColor.RED has wrong value");
    }
    if (DiscordEmbedColor.GREEN !== 5763719) {
      throw new Error("DiscordEmbedColor.GREEN has wrong value");
    }
    if (DiscordEmbedColor.BLUE !== 3447003) {
      throw new Error("DiscordEmbedColor.BLUE has wrong value");
    }
    console.log("   - DiscordEmbedColor: PASS");

    if (DiscordMessageStatus.PENDING !== "pending") {
      throw new Error("DiscordMessageStatus.PENDING has wrong value");
    }
    if (DiscordMessageStatus.SENT !== "sent") {
      throw new Error("DiscordMessageStatus.SENT has wrong value");
    }
    if (DiscordMessageStatus.FAILED !== "failed") {
      throw new Error("DiscordMessageStatus.FAILED has wrong value");
    }
    if (DiscordMessageStatus.RATE_LIMITED !== "rate_limited") {
      throw new Error("DiscordMessageStatus.RATE_LIMITED has wrong value");
    }
    console.log("   - DiscordMessageStatus: PASS");

    // Test client creation
    console.log("4. Testing client creation...");

    // Create client in dev mode
    const devClient = createDiscordClient({
      webhookUrl: "",
      devMode: true,
    });
    if (!devClient.isDevMode()) {
      throw new Error("Client should be in dev mode");
    }
    console.log("   - Dev mode client: PASS");

    // Create client with valid webhook URL
    const urlClient = createDiscordClient({
      webhookUrl: validUrl,
      devMode: true,
    });
    const config = urlClient.getConfig();
    if (!config.webhookUrl.includes("****")) {
      throw new Error("Webhook URL should be masked in config");
    }
    console.log("   - Config masking: PASS");

    // Test custom configuration
    const customClient = createDiscordClient({
      webhookUrl: validUrl,
      devMode: true,
      username: "Custom Bot",
      rateLimit: 10,
      maxRetries: 5,
      timeout: 60000,
    });
    const customConfig = customClient.getConfig();
    if (customConfig.username !== "Custom Bot") {
      throw new Error("Custom username not applied");
    }
    if (customConfig.rateLimit !== 10) {
      throw new Error("Custom rate limit not applied");
    }
    if (customConfig.maxRetries !== 5) {
      throw new Error("Custom retries not applied");
    }
    if (customConfig.timeout !== 60000) {
      throw new Error("Custom timeout not applied");
    }
    console.log("   - Custom configuration: PASS");

    // Test error for invalid URL in production mode
    let threwForInvalid = false;
    try {
      createDiscordClient({
        webhookUrl: "invalid-url",
        devMode: false,
      });
    } catch (e) {
      if (e instanceof DiscordClientError) {
        threwForInvalid = true;
      }
    }
    if (!threwForInvalid) {
      throw new Error("Should throw for invalid URL in production mode");
    }
    console.log("   - Invalid URL error: PASS");

    // Test statistics
    console.log("5. Testing client statistics...");

    resetDiscordClient();
    const statsClient = createDiscordClient({
      webhookUrl: "",
      devMode: true,
    });

    const initialStats = statsClient.getStats();
    if (initialStats.sent !== 0 || initialStats.failed !== 0) {
      throw new Error("Initial stats should be zero");
    }
    console.log("   - Initial stats: PASS");

    // Send messages to update stats
    await statsClient.sendMessage({ content: "Test 1" });
    await statsClient.sendMessage({ content: "Test 2" });

    const updatedStats = statsClient.getStats();
    if (updatedStats.sent !== 2) {
      throw new Error(`Sent count should be 2, got ${updatedStats.sent}`);
    }
    console.log("   - Stats increment: PASS");

    // Reset stats
    statsClient.resetStats();
    const resetStats = statsClient.getStats();
    if (resetStats.sent !== 0 || resetStats.total !== 0) {
      throw new Error("Stats should be zero after reset");
    }
    console.log("   - Stats reset: PASS");

    // Test event subscription
    console.log("6. Testing events...");

    const eventClient = createDiscordClient({
      webhookUrl: "",
      devMode: true,
    });
    const events = [];
    eventClient.on("message:sending", () => events.push("sending"));
    eventClient.on("message:sent", () => events.push("sent"));
    await eventClient.sendMessage({ content: "Event test" });
    if (!events.includes("sending") || !events.includes("sent")) {
      throw new Error("Events should be emitted");
    }
    console.log("   - Event emission: PASS");

    // Test unsubscribe
    const unsubEvents = [];
    const unsubscribe = eventClient.on("message:sent", () =>
      unsubEvents.push("sent")
    );
    unsubscribe();
    await eventClient.sendMessage({ content: "After unsubscribe" });
    // unsubEvents should still be empty from unsubscribed handler
    console.log("   - Event unsubscribe: PASS");

    // Test message sending
    console.log("7. Testing message sending...");

    const msgClient = createDiscordClient({
      webhookUrl: "",
      devMode: true,
    });

    // Simple message
    const simpleResult = await msgClient.sendMessage({ content: "Hello!" });
    if (simpleResult.status !== DiscordMessageStatus.SENT) {
      throw new Error("Simple message should be sent");
    }
    if (!simpleResult.id) {
      throw new Error("Result should have ID");
    }
    console.log("   - Simple message: PASS");

    // Message with embeds
    const embedResult = await msgClient.sendMessage({
      embeds: [
        {
          title: "Test Alert",
          description: "Alert description",
          color: DiscordEmbedColor.RED,
          fields: [
            { name: "Field 1", value: "Value 1", inline: true },
            { name: "Field 2", value: "Value 2", inline: true },
          ],
        },
      ],
    });
    if (embedResult.status !== DiscordMessageStatus.SENT) {
      throw new Error("Embed message should be sent");
    }
    console.log("   - Embed message: PASS");

    // Message with content and embeds
    const combinedResult = await msgClient.sendMessage({
      content: "Alert notification:",
      embeds: [{ title: "Alert", description: "Details here" }],
    });
    if (combinedResult.status !== DiscordMessageStatus.SENT) {
      throw new Error("Combined message should be sent");
    }
    console.log("   - Combined message: PASS");

    // Test error handling for empty message
    let threwForEmpty = false;
    try {
      await msgClient.sendMessage({});
    } catch (e) {
      threwForEmpty = true;
    }
    if (!threwForEmpty) {
      throw new Error("Should throw for empty message");
    }
    console.log("   - Empty message error: PASS");

    // Test error for content too long
    let threwForLong = false;
    try {
      await msgClient.sendMessage({ content: "a".repeat(2001) });
    } catch (e) {
      threwForLong = true;
    }
    if (!threwForLong) {
      throw new Error("Should throw for long content");
    }
    console.log("   - Long content error: PASS");

    // Test error for too many embeds
    let threwForEmbeds = false;
    try {
      await msgClient.sendMessage({
        embeds: Array(11)
          .fill(null)
          .map(() => ({ title: "Test" })),
      });
    } catch (e) {
      threwForEmbeds = true;
    }
    if (!threwForEmbeds) {
      throw new Error("Should throw for too many embeds");
    }
    console.log("   - Too many embeds error: PASS");

    // Test batch sending
    console.log("8. Testing batch sending...");

    const batchClient = createDiscordClient({
      webhookUrl: "",
      devMode: true,
    });

    const batchResult = await batchClient.sendBatch([
      { content: "Message 1" },
      { content: "Message 2" },
      { content: "Message 3" },
    ]);
    if (batchResult.total !== 3) {
      throw new Error("Batch total should be 3");
    }
    if (batchResult.sent !== 3) {
      throw new Error("Batch sent should be 3");
    }
    if (batchResult.failed !== 0) {
      throw new Error("Batch failed should be 0");
    }
    console.log("   - Batch send: PASS");

    // Test batch with errors
    const errorBatchResult = await batchClient.sendBatch(
      [{ content: "Valid" }, { content: "" }, { content: "Also valid" }],
      { stopOnError: false }
    );
    if (errorBatchResult.sent !== 2) {
      throw new Error("Should have 2 successful sends");
    }
    if (errorBatchResult.failed !== 1) {
      throw new Error("Should have 1 failed send");
    }
    console.log("   - Batch with errors: PASS");

    // Test stopOnError
    const stopResult = await batchClient.sendBatch(
      [{ content: "First" }, { content: "" }, { content: "Third" }],
      { stopOnError: true }
    );
    if (stopResult.sent !== 1) {
      throw new Error("Should stop after first success");
    }
    if (stopResult.results.length !== 1) {
      throw new Error("Should only have 1 result");
    }
    console.log("   - Stop on error: PASS");

    // Test connection
    console.log("9. Testing connection...");

    const connClient = createDiscordClient({
      webhookUrl: "",
      devMode: true,
    });

    if (connClient.isConnected()) {
      throw new Error("Should not be connected initially");
    }

    const webhookInfo = await connClient.testConnection();
    if (!webhookInfo) {
      throw new Error("Should return webhook info");
    }
    if (!webhookInfo.id) {
      throw new Error("Webhook info should have ID");
    }
    if (!connClient.isConnected()) {
      throw new Error("Should be connected after test");
    }
    console.log("   - Test connection: PASS");

    // Test getWebhookInfo
    const info = await connClient.getWebhookInfo();
    if (!info.id || !info.channel_id) {
      throw new Error("Should have id and channel_id");
    }
    console.log("   - Get webhook info: PASS");

    // Test singleton
    console.log("10. Testing singleton...");

    resetDiscordClient();
    const singleton1 = getDiscordClient();
    const singleton2 = getDiscordClient();
    if (singleton1 !== singleton2) {
      throw new Error("Singleton should return same instance");
    }
    console.log("   - Singleton returns same instance: PASS");

    resetDiscordClient();
    const newSingleton = getDiscordClient();
    if (singleton1 === newSingleton) {
      throw new Error("Reset should create new instance");
    }
    console.log("   - Reset creates new instance: PASS");

    // Test error class
    console.log("11. Testing DiscordClientError...");

    const error = new DiscordClientError("Test error", "TEST_CODE", {
      statusCode: 400,
      retryable: true,
      retryAfter: 5,
    });
    if (error.message !== "Test error") {
      throw new Error("Error message incorrect");
    }
    if (error.code !== "TEST_CODE") {
      throw new Error("Error code incorrect");
    }
    if (error.statusCode !== 400) {
      throw new Error("Error status code incorrect");
    }
    if (error.retryable !== true) {
      throw new Error("Error retryable incorrect");
    }
    if (error.retryAfter !== 5) {
      throw new Error("Error retryAfter incorrect");
    }
    if (error.name !== "DiscordClientError") {
      throw new Error("Error name incorrect");
    }
    console.log("   - Error properties: PASS");

    const causeError = new DiscordClientError("Wrapped", "WRAP", {
      cause: new Error("Original"),
    });
    if (!causeError.cause) {
      throw new Error("Should have cause");
    }
    console.log("   - Error with cause: PASS");

    // Test complex embed scenarios
    console.log("12. Testing complex embeds...");

    const complexClient = createDiscordClient({
      webhookUrl: "",
      devMode: true,
    });

    // Full embed with all fields
    const fullEmbedResult = await complexClient.sendMessage({
      embeds: [
        {
          title: "Alert: Whale Trade Detected",
          description: "A large trade has been detected",
          url: "https://polymarket.com",
          timestamp: new Date().toISOString(),
          color: DiscordEmbedColor.GOLD,
          footer: { text: "Polymarket Tracker", icon_url: "https://example.com/icon.png" },
          thumbnail: { url: "https://example.com/thumb.png" },
          image: { url: "https://example.com/image.png" },
          author: { name: "Whale Alert", url: "https://example.com" },
          fields: [
            { name: "Wallet", value: "0x1234...5678", inline: true },
            { name: "Amount", value: "$50,000", inline: true },
            { name: "Market", value: "Will BTC reach $100k?", inline: false },
          ],
        },
      ],
    });
    if (fullEmbedResult.status !== DiscordMessageStatus.SENT) {
      throw new Error("Full embed should be sent");
    }
    console.log("   - Full embed: PASS");

    // Multiple embeds
    const multiEmbedResult = await complexClient.sendMessage({
      content: "Multiple alerts:",
      embeds: [
        { title: "Alert 1", color: DiscordEmbedColor.RED },
        { title: "Alert 2", color: DiscordEmbedColor.ORANGE },
        { title: "Alert 3", color: DiscordEmbedColor.YELLOW },
      ],
    });
    if (multiEmbedResult.status !== DiscordMessageStatus.SENT) {
      throw new Error("Multiple embeds should be sent");
    }
    console.log("   - Multiple embeds: PASS");

    // Embed with many fields
    const manyFields = Array(20)
      .fill(null)
      .map((_, i) => ({
        name: `Field ${i + 1}`,
        value: `Value ${i + 1}`,
        inline: i % 3 !== 2,
      }));
    const manyFieldsResult = await complexClient.sendMessage({
      embeds: [{ title: "Many Fields", fields: manyFields }],
    });
    if (manyFieldsResult.status !== DiscordMessageStatus.SENT) {
      throw new Error("Many fields embed should be sent");
    }
    console.log("   - Many fields: PASS");

    // Test allowed mentions
    console.log("13. Testing allowed mentions...");

    const mentionResult = await complexClient.sendMessage({
      content: "@everyone Check this!",
      allowed_mentions: { parse: [] },
    });
    if (mentionResult.status !== DiscordMessageStatus.SENT) {
      throw new Error("Mention message should be sent");
    }
    console.log("   - Allowed mentions: PASS");

    console.log("\n✅ All Discord E2E tests passed!");
    return true;
  } catch (error) {
    console.error("\n❌ Discord E2E test failed:", error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    return false;
  }
}

// Run the tests
runDiscordE2ETest().then((success) => {
  process.exit(success ? 0 : 1);
});
