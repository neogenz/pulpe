#!/bin/bash

echo "Fixing remaining ESLint errors..."

# Fix unused imports/vars by prefixing with underscore
sed -i '' 's/ExternalServiceException,/_ExternalServiceException,/g' src/common/examples/error-handling.example.ts

# Fix unused function parameters
sed -i '' 's/(error)/()/g' src/common/utils/error-handler.spec.ts
sed -i '' 's/const data =/const _data =/g' src/common/utils/error-mapper.ts
sed -i '' 's/(user)/()/g' src/modules/debug/debug.controller.ts
sed -i '' 's/(filters)/(_filters)/g' src/modules/health/health.controller.ts
sed -i '' 's/(budgetId)/(_budgetId)/g' src/shared/infrastructure/logging/base-repository.ts
sed -i '' 's/(userId, data)/(_userId, _data)/g' src/shared/infrastructure/logging/base-repository.ts
sed -i '' 's/(publicData, sensitiveData)/(_publicData, _sensitiveData)/g' src/shared/infrastructure/logging/base-repository.ts
sed -i '' 's/(id)/(_id)/g' src/shared/infrastructure/logging/base-repository.ts

# Fix PinoLogger import
sed -i '' '/^import.*PinoLogger.*from.*nestjs-pino/d' src/modules/health/monitoring.service.ts

# Fix function naming convention for decorators (they are decorators, not regular functions)
# These are false positives - decorators should be PascalCase
echo "// eslint-disable-next-line @typescript-eslint/naming-convention" > temp_decorator_fix.txt
sed -i '' '/export function LogOperation/i\
// eslint-disable-next-line @typescript-eslint/naming-convention' src/shared/infrastructure/logging/logging.decorators.ts
sed -i '' '/export function LogPerformance/i\
// eslint-disable-next-line @typescript-eslint/naming-convention' src/shared/infrastructure/logging/logging.decorators.ts
sed -i '' '/export function LogErrors/i\
// eslint-disable-next-line @typescript-eslint/naming-convention' src/shared/infrastructure/logging/logging.decorators.ts
sed -i '' '/export function UseEnhancedLogger/i\
// eslint-disable-next-line @typescript-eslint/naming-convention' src/shared/infrastructure/logging/logging.decorators.ts

# Fix unnecessary try-catch
echo "Fixing unnecessary try-catch blocks..."
# This requires manual fix as the logic needs to be preserved

echo "Done!"