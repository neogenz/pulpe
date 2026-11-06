import {
  Controller,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiUnauthorizedResponse,
  ApiInternalServerErrorResponse,
} from '@nestjs/swagger';
import {
  type AssetCategoryResponse,
  type AssetCategoryDeleteResponse,
} from 'pulpe-shared';
import { AuthGuard } from '@common/guards/auth.guard';
import {
  User,
  type AuthenticatedUser,
} from '@common/decorators/user.decorator';
import { ErrorResponseDto } from '@common/dto/response.dto';
import {
  AssetCategoryCreateDto,
  AssetCategoryUpdateDto,
  AssetCategoryResponseDto,
  AssetCategoryDeleteResponseDto,
} from './dto/asset-swagger.dto';
import { CreateAssetCategoryUseCase } from '../../application/create-asset-category.use-case';
import { UpdateAssetCategoryUseCase } from '../../application/update-asset-category.use-case';
import { RemoveAssetCategoryUseCase } from '../../application/remove-asset-category.use-case';
import { AssetMapper } from '../mappers/asset.mapper';

@ApiTags('Asset categories')
@ApiBearerAuth()
@Controller({ path: 'asset-categories', version: '1' })
@UseGuards(AuthGuard)
@ApiUnauthorizedResponse({
  description: 'Authentication required',
  type: ErrorResponseDto,
})
@ApiInternalServerErrorResponse({
  description: 'Internal server error',
  type: ErrorResponseDto,
})
export class AssetCategoryController {
  constructor(
    private readonly createUseCase: CreateAssetCategoryUseCase,
    private readonly updateUseCase: UpdateAssetCategoryUseCase,
    private readonly removeUseCase: RemoveAssetCategoryUseCase,
    private readonly mapper: AssetMapper,
  ) {}

  @Post()
  @ApiOperation({
    summary: "Crée une catégorie d'avoirs (nom unique par utilisateur)",
  })
  @ApiResponse({
    status: 201,
    description: 'Catégorie créée avec succès',
    type: AssetCategoryResponseDto,
  })
  async create(
    @Body() createDto: AssetCategoryCreateDto,
    @User() user: AuthenticatedUser,
  ): Promise<AssetCategoryResponse> {
    const entity = await this.createUseCase.execute(createDto, user);
    return { success: true, data: this.mapper.toCategoryApi(entity) };
  }

  @Patch(':id')
  @ApiOperation({ summary: "Renomme une catégorie d'avoirs" })
  @ApiParam({ name: 'id', description: 'Identifiant unique de la catégorie' })
  @ApiResponse({
    status: 200,
    description: 'Catégorie renommée avec succès',
    type: AssetCategoryResponseDto,
  })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: AssetCategoryUpdateDto,
    @User() user: AuthenticatedUser,
  ): Promise<AssetCategoryResponse> {
    const entity = await this.updateUseCase.execute(id, updateDto, user);
    return { success: true, data: this.mapper.toCategoryApi(entity) };
  }

  @Delete(':id')
  @ApiOperation({
    summary: "Supprime une catégorie d'avoirs",
    description: 'Refusé tant que la catégorie contient un avoir (409).',
  })
  @ApiParam({ name: 'id', description: 'Identifiant unique de la catégorie' })
  @ApiResponse({
    status: 200,
    description: 'Catégorie supprimée avec succès',
    type: AssetCategoryDeleteResponseDto,
  })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @User() user: AuthenticatedUser,
  ): Promise<AssetCategoryDeleteResponse> {
    await this.removeUseCase.execute(id, user);
    return { success: true, message: 'Asset category deleted successfully' };
  }
}
