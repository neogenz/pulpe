#!/bin/bash

# Fix catch blocks where _error is not used
find src -name "*.ts" -type f -exec sed -i '' 's/} catch (_error) {/} catch {/g' {} \;

# Fix specific patterns where error needs to remain
find src -name "*.ts" -type f -exec sed -i '' \
  -e 's/, _error:/, error:/g' \
  -e 's/err: _error/err: error/g' \
  -e 's/_error: result.reason/error: result.reason/g' \
  {} \;

echo "Fixed catch error patterns"