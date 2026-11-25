import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiNotFoundResponse,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiInternalServerErrorResponse,
} from '@nestjs/swagger';
import {
  type NetWorthResponse,
  type AssetResponse,
  type AssetDeleteResponse,
  type AssetSnapshotsResponse,
  type AssetHistoryResponse,
} from 'pulpe-shared';
import { AuthGuard } from '@common/guards/auth.guard';
import {
  User,
  type AuthenticatedUser,
} from '@common/decorators/user.decorator';
import { ErrorResponseDto } from '@common/dto/response.dto';
import {
  AssetCreateDto,
  AssetUpdateDto,
  AssetSnapshotsCreateDto,
  NetWorthResponseDto,
  AssetResponseDto,
  AssetDeleteResponseDto,
  AssetSnapshotsResponseDto,
  AssetHistoryQueryDto,
  AssetHistoryResponseDto,
} from './dto/asset-swagger.dto';
import { GetNetWorthUseCase } from '../../application/get-net-worth.use-case';
import { GetAssetHistoryUseCase } from '../../application/get-asset-history.use-case';
import { CreateAssetUseCase } from '../../application/create-asset.use-case';
import { UpdateAssetUseCase } from '../../application/update-asset.use-case';
import { RemoveAssetUseCase } from '../../application/remove-asset.use-case';
import { RecordAssetSnapshotsUseCase } from '../../application/record-asset-snapshots.use-case';
import { DismissAssetSuggestionUseCase } from '../../application/dismiss-asset-suggestion.use-case';
import { AssetMapper } from '../mappers/asset.mapper';

@ApiTags('Assets')
@ApiBearerAuth()
@Controller({ path: 'assets', version: '1' })
@UseGuards(AuthGuard)
@ApiUnauthorizedResponse({
  description: 'Authentication required',
  type: ErrorResponseDto,
})
@ApiInternalServerErrorResponse({
  description: 'Internal server error',
  type: ErrorResponseDto,
})
export class AssetController {
  constructor(
    private readonly getNetWorthUseCase: GetNetWorthUseCase,
    private readonly getHistoryUseCase: GetAssetHistoryUseCase,
    private readonly createUseCase: CreateAssetUseCase,
    private readonly updateUseCase: UpdateAssetUseCase,
    private readonly removeUseCase: RemoveAssetUseCase,
    private readonly recordSnapshotsUseCase: RecordAssetSnapshotsUseCase,
    private readonly dismissSuggestionUseCase: DismissAssetSuggestionUseCase,
    private readonly mapper: AssetMapper,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Lit le patrimoine',
    description:
      "Catégories, avoirs avec leur dernière valeur, et totaux en devise de base au taux du jour. Un taux indisponible laisse l'avoir hors des totaux (`incomplete`).",
  })
  @ApiResponse({
    status: 200,
    description: 'Patrimoine récupéré avec succès',
    type: NetWorthResponseDto,
  })
  async getNetWorth(
    @User() user: AuthenticatedUser,
  ): Promise<NetWorthResponse> {
    const netWorth = await this.getNetWorthUseCase.execute(user);
    return { success: true, data: this.mapper.toNetWorthApi(netWorth) };
  }

  @Get(':id/history')
  @ApiOperation({
    summary: "Lit l'historique d'un avoir",
    description:
      "L'avoir calculé comme dans `GET /v1/assets` et une page de son historique, du plus récent au plus ancien : les saisies et, entre elles, l'effet de chaque mouvement pointé dans la devise de l'avoir. Passer `nextCursor` en `cursor` pour la page suivante.",
  })
  @ApiParam({ name: 'id', description: "Identifiant unique de l'avoir" })
  @ApiResponse({
    status: 200,
    description: 'Historique récupéré avec succès',
    type: AssetHistoryResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Identifiant, limite ou curseur invalide',
    type: ErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Avoir introuvable ou archivé',
    type: ErrorResponseDto,
  })
  async getHistory(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: AssetHistoryQueryDto,
    @User() user: AuthenticatedUser,
  ): Promise<AssetHistoryResponse> {
    const page = await this.getHistoryUseCase.execute(id, query, user);
    return { success: true, data: this.mapper.toAssetHistoryApi(page) };
  }

  @Post()
  @ApiOperation({ summary: 'Crée un avoir avec sa première valeur' })
  @ApiResponse({
    status: 201,
    description: 'Avoir créé avec succès',
    type: AssetResponseDto,
  })
  async create(
    @Body() createDto: AssetCreateDto,
    @User() user: AuthenticatedUser,
  ): Promise<AssetResponse> {
    const entity = await this.createUseCase.execute(createDto, user);
    return { success: true, data: this.mapper.toApi(entity) };
  }

  @Post('snapshots')
  @ApiOperation({
    summary: 'Enregistre de nouvelles valeurs',
    description:
      'Une photo par avoir, toutes à la même date. Un avoir `owe` refuse une valeur négative.',
  })
  @ApiResponse({
    status: 201,
    description: 'Valeurs enregistrées avec succès',
    type: AssetSnapshotsResponseDto,
  })
  async recordSnapshots(
    @Body() snapshotsDto: AssetSnapshotsCreateDto,
    @User() user: AuthenticatedUser,
  ): Promise<AssetSnapshotsResponse> {
    const recordedAt = await this.recordSnapshotsUseCase.execute(
      snapshotsDto,
      user,
    );
    return { success: true, data: { recordedAt } };
  }

  @Post(':id/dismiss-suggestion')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Obsolète : ne fait plus rien',
    deprecated: true,
    description:
      "Depuis que la valeur d'un avoir suit ce qui est pointé, il n'y a plus de proposition à écarter. Gardée pour iOS 1.14.x et Android : renvoie l'avoir sans rien écrire.",
  })
  @ApiParam({ name: 'id', description: "Identifiant unique de l'avoir" })
  @ApiResponse({
    status: 200,
    description: "L'avoir, inchangé",
    type: AssetResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Avoir introuvable',
    type: ErrorResponseDto,
  })
  async dismissSuggestion(
    @Param('id', ParseUUIDPipe) id: string,
    @User() user: AuthenticatedUser,
  ): Promise<AssetResponse> {
    const entity = await this.dismissSuggestionUseCase.execute(id, user);
    return { success: true, data: this.mapper.toApi(entity) };
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Modifie un avoir',
    description:
      'Nom, catégorie, marqueur « dans Pulpe » ou archivage. La devise et le sens sont figés à la création.',
  })
  @ApiParam({ name: 'id', description: "Identifiant unique de l'avoir" })
  @ApiResponse({
    status: 200,
    description: 'Avoir modifié avec succès',
    type: AssetResponseDto,
  })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: AssetUpdateDto,
    @User() user: AuthenticatedUser,
  ): Promise<AssetResponse> {
    const entity = await this.updateUseCase.execute(id, updateDto, user);
    return { success: true, data: this.mapper.toApi(entity) };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Supprime un avoir et son historique' })
  @ApiParam({ name: 'id', description: "Identifiant unique de l'avoir" })
  @ApiResponse({
    status: 200,
    description: 'Avoir supprimé avec succès',
    type: AssetDeleteResponseDto,
  })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @User() user: AuthenticatedUser,
  ): Promise<AssetDeleteResponse> {
    await this.removeUseCase.execute(id, user);
    return { success: true, message: 'Asset deleted successfully' };
  }
}
