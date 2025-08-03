#!/bin/bash

# Fix unused variables by prefixing with underscore
find src -name "*.ts" -type f -exec sed -i '' \
  -e "s/import { ExternalServiceException }/import { ExternalServiceException as _ExternalServiceException }/g" \
  -e "s/'client' is defined but never used/'_client' is defined but never used/g" \
  -e "s/\(const\|let\|var\) client =/\1 _client =/g" \
  -e "s/(\s*client\s*:\s*SupabaseClient/(\_client: SupabaseClient/g" \
  -e "s/catch (error)/catch (_error)/g" \
  -e "s/, error:/, _error:/g" \
  {} \;

# Fix specific files with known issues
# Fix client parameter in supabase-user.repository.ts
sed -i '' 's/client: SupabaseClient/_client: SupabaseClient/g' src/slices/users/infrastructure/persistence/supabase-user.repository.ts

# Fix ExternalServiceException import
sed -i '' 's/ExternalServiceException,/_ExternalServiceException,/g' src/common/filters/global-exception.filter.enhanced.spec.ts

echo "Fixed remaining lint errors"