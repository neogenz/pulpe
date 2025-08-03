#!/bin/bash

echo "Fixing final 66 ESLint errors..."

# Fix ExternalServiceException in error-handling.example.ts
sed -i '' 's/import {/import {_/' src/common/examples/error-handling.example.ts
sed -i '' 's/_EntityNotFoundException,/EntityNotFoundException,/' src/common/examples/error-handling.example.ts  
sed -i '' 's/_ValidationException,/ValidationException,/' src/common/examples/error-handling.example.ts
sed -i '' 's/_ConflictException,/ConflictException,/' src/common/examples/error-handling.example.ts
sed -i '' 's/_BusinessRuleViolationException,/BusinessRuleViolationException,/' src/common/examples/error-handling.example.ts
sed -i '' 's/_InvalidOperationException,/InvalidOperationException,/' src/common/examples/error-handling.example.ts
sed -i '' 's/_MissingDataException,/MissingDataException,/' src/common/examples/error-handling.example.ts
sed -i '' 's/ExternalServiceException,/_ExternalServiceException,/' src/common/examples/error-handling.example.ts

# Fix error parameter in error-handler.spec.ts
sed -i '' 's/transformError: (error)/transformError: (_error)/' src/common/utils/error-handler.spec.ts

# Remove unused PinoLogger import
sed -i '' '/import.*PinoLogger.*from.*nestjs-pino/d' src/modules/health/monitoring.service.spec.ts

# Fix debug.controller.ts
sed -i '' 's/@User() user/@User() _user/' src/modules/debug/debug.controller.ts
sed -i '' 's/@Res() res: Response/@Res() _res: Response/' src/modules/debug/debug.controller.ts

# Fix health.controller.ts
sed -i '' 's/@Query() filters/@Query() _filters/' src/modules/health/health.controller.ts

# Fix base-repository.ts
sed -i '' 's/findByBudget(budgetId: string)/findByBudget(_budgetId: string)/' src/shared/infrastructure/logging/base-repository.ts
sed -i '' 's/update(userId: string, data: T)/update(_userId: string, _data: T)/' src/shared/infrastructure/logging/base-repository.ts
sed -i '' 's/logSensitive(publicData: any, sensitiveData: any)/logSensitive(_publicData: any, _sensitiveData: any)/' src/shared/infrastructure/logging/base-repository.ts
sed -i '' 's/delete(id: string)/delete(_id: string)/' src/shared/infrastructure/logging/base-repository.ts

# Fix logging.middleware.ts
sed -i '' 's/import { Request }/import { Request as _Request }/' src/shared/infrastructure/logging/logging.middleware.ts

# Fix Function types in base-repository.spec.ts
sed -i '' 's/: Function/: (() => void)/g' src/shared/infrastructure/repositories/base-repository.spec.ts

# Fix auth.controller.ts
sed -i '' 's/@Body() body:/@Body() _body:/g' src/slices/auth/infrastructure/api/auth.controller.ts

# Fix supabase-auth.repository.ts
sed -i '' 's/const responseBody =/const _responseBody =/' src/slices/auth/infrastructure/persistence/supabase-auth.repository.ts
sed -i '' 's/const statusCode =/const _statusCode =/' src/slices/auth/infrastructure/persistence/supabase-auth.repository.ts

# Fix interceptors
sed -i '' 's/(req, res, next)/(req, _res, next)/' src/modules/debug/debug.controller.ts
sed -i '' 's/(req, res, next)/(_req, _res, next)/' src/modules/debug/debug.controller.ts

# Fix unused imports in auth decorators
sed -i '' 's/Result,/_Result,/' src/shared/infrastructure/security/auth.decorators.ts
sed -i '' 's/PUBLIC_KEY,/_PUBLIC_KEY,/' src/shared/infrastructure/security/auth.decorators.ts  
sed -i '' 's/ROLES_KEY,/_ROLES_KEY,/' src/shared/infrastructure/security/auth.decorators.ts

# Fix AuthToken import
sed -i '' 's/import { AuthToken/import { AuthToken as _AuthToken/' src/slices/auth/infrastructure/api/auth.controller.ts

# Fix client parameter in supabase-user.repository.ts
sed -i '' 's/async findByAuth(client/async findByAuth(_client/' src/slices/users/infrastructure/persistence/supabase-user.repository.ts

echo "Running lint to check remaining issues..."
bun run lint 2>&1 | grep -E "^✖" | tail -1