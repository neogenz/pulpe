import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiUnauthorizedResponse,
  ApiInternalServerErrorResponse,
} from '@nestjs/swagger';
import {
  type TagResponse,
  type TagListResponse,
  type TagDeleteResponse,
  type TagHistoryResponse,
} from 'pulpe-shared';
import { AuthGuard } from '@common/guards/auth.guard';
import {
  User,
  type AuthenticatedUser,
} from '@common/decorators/user.decorator';
import { ErrorResponseDto } from '@common/dto/response.dto';
import {
  TagCreateDto,
  TagUpdateDto,
  TagResponseDto,
  TagListResponseDto,
  TagHistoryQueryDto,
  TagHistoryResponseDto,
  TagDeleteResponseDto,
} from './dto/tag-swagger.dto';
import { FindAllTagsUseCase } from '../../application/find-all-tags.use-case';
import { FindTagUseCase } from '../../application/find-tag.use-case';
import { CreateTagUseCase } from '../../application/create-tag.use-case';
import { UpdateTagUseCase } from '../../application/update-tag.use-case';
import { RemoveTagUseCase } from '../../application/remove-tag.use-case';
import { GetTagHistoryUseCase } from '../../application/get-tag-history.use-case';
import { TagMapper } from '../mappers/tag.mapper';

@ApiTags('Tags')
@ApiBearerAuth()
@Controller({ path: 'tags', version: '1' })
@UseGuards(AuthGuard)
@ApiUnauthorizedResponse({
  description: 'Authentication required',
  type: ErrorResponseDto,
})
@ApiInternalServerErrorResponse({
  description: 'Internal server error',
  type: ErrorResponseDto,
})
export class TagController {
  constructor(
    private readonly findAllUseCase: FindAllTagsUseCase,
    private readonly findOneUseCase: FindTagUseCase,
    private readonly createUseCase: CreateTagUseCase,
    private readonly updateUseCase: UpdateTagUseCase,
    private readonly removeUseCase: RemoveTagUseCase,
    private readonly historyUseCase: GetTagHistoryUseCase,
    private readonly mapper: TagMapper,
  ) {}

  @Get()
  @ApiOperation({ summary: "Liste les tags de l'utilisateur" })
  @ApiResponse({
    status: 200,
    description: 'Tags récupérés avec succès',
    type: TagListResponseDto,
  })
  async findAll(@User() user: AuthenticatedUser): Promise<TagListResponse> {
    const entities = await this.findAllUseCase.execute(user);
    return { success: true, data: this.mapper.toApiList(entities) };
  }

  @Post()
  @ApiOperation({ summary: 'Crée un tag (nom unique par utilisateur)' })
  @ApiResponse({
    status: 201,
    description: 'Tag créé avec succès',
    type: TagResponseDto,
  })
  async create(
    @Body() createDto: TagCreateDto,
    @User() user: AuthenticatedUser,
  ): Promise<TagResponse> {
    const entity = await this.createUseCase.execute(createDto, user);
    return { success: true, data: this.mapper.toApi(entity) };
  }

  @Get(':id/history')
  @ApiOperation({ summary: "Récupère l'évolution mensuelle d'un tag" })
  @ApiParam({ name: 'id', description: 'Identifiant unique du tag' })
  @ApiQuery({ name: 'months', enum: [3, 6, 12, 24], type: Number })
  @ApiQuery({ name: 'endMonth', minimum: 1, maximum: 12, type: Number })
  @ApiQuery({ name: 'endYear', type: Number })
  @ApiResponse({
    status: 200,
    description: 'Historique du tag récupéré avec succès',
    type: TagHistoryResponseDto,
  })
  async history(
    @Param('id') id: string,
    @Query() query: TagHistoryQueryDto,
    @User() user: AuthenticatedUser,
  ): Promise<TagHistoryResponse> {
    const history = await this.historyUseCase.execute(id, query, user);
    return { success: true, data: this.mapper.toHistoryApi(history) };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Récupère un tag par son ID' })
  @ApiParam({ name: 'id', description: 'Identifiant unique du tag' })
  @ApiResponse({
    status: 200,
    description: 'Tag récupéré avec succès',
    type: TagResponseDto,
  })
  async findOne(
    @Param('id') id: string,
    @User() user: AuthenticatedUser,
  ): Promise<TagResponse> {
    const entity = await this.findOneUseCase.execute(id, user);
    return { success: true, data: this.mapper.toApi(entity) };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Renomme un tag' })
  @ApiParam({ name: 'id', description: 'Identifiant unique du tag' })
  @ApiResponse({
    status: 200,
    description: 'Tag modifié avec succès',
    type: TagResponseDto,
  })
  async update(
    @Param('id') id: string,
    @Body() updateDto: TagUpdateDto,
    @User() user: AuthenticatedUser,
  ): Promise<TagResponse> {
    const entity = await this.updateUseCase.execute(id, updateDto, user);
    return { success: true, data: this.mapper.toApi(entity) };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Supprime un tag' })
  @ApiParam({ name: 'id', description: 'Identifiant unique du tag' })
  @ApiResponse({
    status: 200,
    description: 'Tag supprimé avec succès',
    type: TagDeleteResponseDto,
  })
  async remove(
    @Param('id') id: string,
    @User() user: AuthenticatedUser,
  ): Promise<TagDeleteResponse> {
    await this.removeUseCase.execute(id, user);
    return { success: true, message: 'Tag deleted successfully' };
  }
}
