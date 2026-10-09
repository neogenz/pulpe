import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiConsumes,
  ApiCreatedResponse,
  ApiInternalServerErrorResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import {
  TRANSACTION_IMPORT_MAX_FILE_BYTES,
  type TransactionImportPreviewResponse,
  type TransactionImportResponse,
} from 'pulpe-shared';
import { AuthGuard } from '@common/guards/auth.guard';
import {
  type AuthenticatedUser,
  User,
} from '@common/decorators/user.decorator';
import { ErrorResponseDto } from '@common/dto/response.dto';
import { BusinessException } from '@common/exceptions/business.exception';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import { PreviewTransactionImportUseCase } from '../../application/preview-transaction-import.use-case';
import { ConfirmTransactionImportUseCase } from '../../application/confirm-transaction-import.use-case';
import {
  TransactionImportPreviewResponseDto,
  TransactionImportRequestDto,
  TransactionImportResponseDto,
} from './dto/transaction-import-swagger.dto';

/** The part of a multer file this controller reads. */
interface UploadedBankFile {
  buffer: Buffer;
}

const FILE_FIELD = 'file';

const uploadInterceptor = FileInterceptor(FILE_FIELD, {
  // Over the limit, multer answers 413 before the body is buffered further.
  limits: { fileSize: TRANSACTION_IMPORT_MAX_FILE_BYTES, files: 1, fields: 4 },
});

const multipartBody = {
  schema: {
    type: 'object',
    required: [FILE_FIELD, 'budgetId'],
    properties: {
      [FILE_FIELD]: { type: 'string', format: 'binary' },
      budgetId: { type: 'string', format: 'uuid' },
    },
  },
};

@ApiTags('Transaction imports')
@ApiBearerAuth()
@Controller({ path: 'transaction-imports', version: '1' })
@UseGuards(AuthGuard)
@ApiUnauthorizedResponse({
  description: 'Authentication required',
  type: ErrorResponseDto,
})
@ApiInternalServerErrorResponse({
  description: 'Internal server error',
  type: ErrorResponseDto,
})
export class TransactionImportController {
  constructor(
    private readonly previewUseCase: PreviewTransactionImportUseCase,
    private readonly confirmUseCase: ConfirmTransactionImportUseCase,
  ) {}

  @Post('preview')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @UseInterceptors(uploadInterceptor)
  @ApiConsumes('multipart/form-data')
  @ApiBody(multipartBody)
  @ApiOperation({
    summary: 'Analyse un export bancaire sans rien enregistrer',
  })
  @ApiOkResponse({ type: TransactionImportPreviewResponseDto })
  async preview(
    @UploadedFile() file: UploadedBankFile | undefined,
    @Body() body: TransactionImportRequestDto,
  ): Promise<TransactionImportPreviewResponse> {
    const data = await this.previewUseCase.execute(
      decodeFile(file),
      body.budgetId,
    );
    return { success: true, data };
  }

  @Post()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @UseInterceptors(uploadInterceptor)
  @ApiConsumes('multipart/form-data')
  @ApiBody(multipartBody)
  @ApiOperation({
    summary:
      'Crée les opérations nouvelles d’un export bancaire (tout ou rien)',
  })
  @ApiCreatedResponse({ type: TransactionImportResponseDto })
  @ApiUnprocessableEntityResponse({
    description: 'The file has blocking errors',
    type: ErrorResponseDto,
  })
  @ApiConflictResponse({
    description: 'An operation of the file was imported in the meantime',
    type: ErrorResponseDto,
  })
  async confirm(
    @UploadedFile() file: UploadedBankFile | undefined,
    @Body() body: TransactionImportRequestDto,
    @User() user: AuthenticatedUser,
  ): Promise<TransactionImportResponse> {
    const data = await this.confirmUseCase.execute(
      decodeFile(file),
      body.budgetId,
      user,
    );
    return { success: true, data };
  }
}

/** Bank exports are UTF-8 (ISO 20022 mandates it); the decoder drops a BOM. */
function decodeFile(file: UploadedBankFile | undefined): string {
  if (!file?.buffer?.length) {
    throw new BusinessException(
      ERROR_DEFINITIONS.TRANSACTION_IMPORT_FILE_MISSING,
      undefined,
      { operation: 'transactionImport.decodeFile' },
    );
  }
  return new TextDecoder('utf-8').decode(file.buffer);
}
