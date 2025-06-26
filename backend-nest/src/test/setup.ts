import "reflect-metadata";

// Global test setup for Bun
console.log("🧪 Test environment initialized with Bun");

// Mock console.error in tests to avoid noise
const originalConsoleError = console.error;
global.console = {
  ...console,
  error: (message: any, ...args: any[]) => {
    if (process.env.NODE_ENV === "test") {
      // Only log in test if explicitly needed
      return;
    }
    originalConsoleError(message, ...args);
  },
};