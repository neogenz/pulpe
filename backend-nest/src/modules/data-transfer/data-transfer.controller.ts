import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
} from '@nestjs/swagger';
import { AuthGuard } from '@common/guards/auth.guard';
import {
  User,
  SupabaseClient,
  type AuthenticatedUser,
} from '@common/decorators/user.decorator';
import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';
import { DataTransferService } from './data-transfer.service';
import { ExportData } from './entities/export-data.entity';
import { ImportOptionsDto, ImportResultDto } from './dto/import-data.dto';
import { exportDataSchema } from './schemas/export-data.schema';

@ApiTags('Data Transfer')
@Controller('data-transfer')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class DataTransferController {
  constructor(private readonly dataTransferService: DataTransferService) {}

  @Get('export')
  @ApiOperation({
    summary: 'Export all user data',
    description:
      'Exports all user data including templates, budgets, transactions, and savings goals to JSON format',
  })
  @ApiResponse({
    status: 200,
    description: 'User data exported successfully',
    type: ExportData,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async exportData(
    @User() user: AuthenticatedUser,
    @SupabaseClient() supabase: AuthenticatedSupabaseClient,
  ): Promise<ExportData> {
    const userId = user.id;
    return this.dataTransferService.exportUserData(userId, supabase);
  }

  @Post('import')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Import user data',
    description:
      'Imports user data from JSON format with different merge strategies',
  })
  @ApiConsumes('application/json')
  @ApiResponse({
    status: 200,
    description: 'Data imported successfully',
    type: ImportResultDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid data format' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async importData(
    @User() user: AuthenticatedUser,
    @SupabaseClient() supabase: AuthenticatedSupabaseClient,
    @Body('data') data: unknown,
    @Body('options') options?: ImportOptionsDto,
  ): Promise<ImportResultDto> {
    const userId = user.id;

    // Validate the incoming data
    try {
      const validatedData = exportDataSchema.parse(data);

      // Ensure the import is for the same user or update user_id
      if (validatedData.user_id !== userId) {
        // Update all user_id references to current user
        validatedData.user_id = userId;
      }

      return this.dataTransferService.importUserData(
        userId,
        validatedData,
        supabase,
        options?.mode,
        options?.dryRun,
      );
    } catch {
      throw new BadRequestException('Invalid data format');
    }
  }

  @Post('import/validate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Validate import data',
    description: 'Validates import data without actually importing (dry run)',
  })
  @ApiConsumes('application/json')
  @ApiResponse({
    status: 200,
    description: 'Validation completed',
    type: ImportResultDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid data format' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async validateImport(
    @User() user: AuthenticatedUser,
    @SupabaseClient() supabase: AuthenticatedSupabaseClient,
    @Body('data') data: unknown,
    @Body('options') options?: ImportOptionsDto,
  ): Promise<ImportResultDto> {
    const userId = user.id;

    // Validate the incoming data
    try {
      const validatedData = exportDataSchema.parse(data);

      // Always run validation in dry run mode
      return this.dataTransferService.importUserData(
        userId,
        validatedData,
        supabase,
        options?.mode,
        true, // Always dry run for validation
      );
    } catch {
      throw new BadRequestException('Invalid data format');
    }
  }
}
