#!/bin/bash

# Script to update test files to use BusinessException instead of standard NestJS exceptions
# This script handles the systematic conversion of error test cases

echo "Fixing error handling in test files..."

# Array of test files to update
test_files=(
  "src/modules/transaction/transaction.service.spec.ts"
  "src/modules/budget-line/budget-line.service.spec.ts"
  "src/modules/budget-template/budget-template.service.spec.ts"
)

# Common replacements
declare -A replacements=(
  ["NotFoundException.*Transaction not found"]="ERROR_DEFINITIONS.TRANSACTION_NOT_FOUND"
  ["NotFoundException.*Budget line not found"]="ERROR_DEFINITIONS.BUDGET_LINE_NOT_FOUND"
  ["NotFoundException.*Template not found"]="ERROR_DEFINITIONS.TEMPLATE_NOT_FOUND"
  ["InternalServerErrorException.*Failed to retrieve"]="ERROR_DEFINITIONS.*_FETCH_FAILED"
  ["InternalServerErrorException.*Failed to create"]="ERROR_DEFINITIONS.*_CREATE_FAILED"
  ["InternalServerErrorException.*Failed to update"]="ERROR_DEFINITIONS.*_UPDATE_FAILED"
  ["InternalServerErrorException.*Failed to delete"]="ERROR_DEFINITIONS.*_DELETE_FAILED"
  ["BadRequestException.*validation"]="ERROR_DEFINITIONS.VALIDATION_FAILED"
  ["BadRequestException.*Invalid"]="ERROR_DEFINITIONS.VALIDATION_FAILED"
)

echo "Files that need manual update:"
for file in "${test_files[@]}"; do
  echo "  - $file"
done

echo ""
echo "Common patterns to replace:"
echo "1. expectErrorThrown -> expectBusinessExceptionThrown"
echo "2. Add ERROR_DEFINITIONS import"
echo "3. Add expectBusinessExceptionThrown import"
echo "4. Map NestJS exceptions to ERROR_DEFINITIONS:"
echo "   - NotFoundException -> *_NOT_FOUND"
echo "   - BadRequestException -> VALIDATION_FAILED or REQUIRED_DATA_MISSING"
echo "   - InternalServerErrorException -> *_FAILED (CREATE/UPDATE/DELETE/FETCH)"

echo ""
echo "Example conversion:"
echo "Before:"
echo "  await expectErrorThrown("
echo "    () => service.findOne('invalid-id', mockClient),"
echo "    NotFoundException,"
echo "    'Transaction not found'"
echo "  );"
echo ""
echo "After:"
echo "  await expectBusinessExceptionThrown("
echo "    () => service.findOne('invalid-id', mockClient),"
echo "    ERROR_DEFINITIONS.TRANSACTION_NOT_FOUND,"
echo "    { id: 'invalid-id' }"
echo "  );"

echo ""
echo "Run this command to see remaining failing tests:"
echo "bun test 2>&1 | grep 'fail' | head -20"