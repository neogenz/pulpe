import "reflect-metadata";

// Global test setup for Bun
console.log("🧪 Test environment initialized with Bun");

// Store original console.error for restoration and selective logging
const originalConsoleError = console.error;

// Patterns of error messages that should be silenced in tests to reduce noise
const SILENCED_ERROR_PATTERNS = [
  /ExperimentalWarning/i,
  /DeprecationWarning/i,
  /UnhandledPromiseRejectionWarning/i,
];

// Override console.error method directly to preserve console object integrity
if (process.env.NODE_ENV === "test") {
  console.error = (message: any, ...args: any[]) => {
    // Allow full error logging when DEBUG_TESTS is set
    if (process.env.DEBUG_TESTS === "true") {
      originalConsoleError(message, ...args);
      return;
    }

    // Convert message to string for pattern matching
    const messageString = String(message);
    
    // Check if this error should be silenced
    const shouldSilence = SILENCED_ERROR_PATTERNS.some(pattern => 
      pattern.test(messageString)
    );

    // Only log errors that aren't in our silence list
    if (!shouldSilence) {
      originalConsoleError(message, ...args);
    }
  };
}

// Cleanup function to restore original console.error if needed
export const restoreConsole = () => {
  console.error = originalConsoleError;
};