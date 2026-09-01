import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiInternalServerErrorResponse,
  ApiNoContentResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AuthGuard } from '@common/guards/auth.guard';
import {
  User,
  type AuthenticatedUser,
} from '@common/decorators/user.decorator';
import { SkipClientKey } from '@common/decorators/skip-client-key.decorator';
import { ErrorResponseDto } from '@common/dto/response.dto';
import { SubmitFeedbackUseCase } from '../../application/submit-feedback.use-case';
import { FeedbackCreateDto } from './dto/feedback-swagger.dto';

@ApiTags('Feedback')
@ApiBearerAuth()
@Controller({ path: 'feedback', version: '1' })
@UseGuards(AuthGuard)
@ApiUnauthorizedResponse({
  description: 'Authentication required',
  type: ErrorResponseDto,
})
@ApiInternalServerErrorResponse({
  description: 'Feedback could not be submitted',
  type: ErrorResponseDto,
})
export class FeedbackController {
  constructor(private readonly submitFeedback: SubmitFeedbackUseCase) {}

  @Post()
  @SkipClientKey()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Submit private in-app feedback' })
  @ApiNoContentResponse({ description: 'Feedback submitted' })
  @ApiBadRequestResponse({
    description: 'Invalid feedback',
    type: ErrorResponseDto,
  })
  async submit(
    @Body() feedback: FeedbackCreateDto,
    @User() user: AuthenticatedUser,
  ): Promise<void> {
    await this.submitFeedback.execute(feedback, user);
  }
}
