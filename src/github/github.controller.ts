import { Controller, Get, Query, Res } from '@nestjs/common';
import {
  ApiQuery,
  ApiResponse,
  ApiTags,
  ApiProduces,
} from '@nestjs/swagger';
import { Response } from 'express';
import { GithubService } from './github.service';

@ApiTags('github')
@Controller('github')
export class GithubController {
  constructor(private readonly githubService: GithubService) {}

  @Get('music')
  @ApiQuery({
    name: 'username',
    required: true,
    description: 'GitHub kullanıcı adı',
  })
  @ApiProduces('audio/mpeg')
  @ApiResponse({
    status: 200,
    description: 'GitHub aktivitesinden üretilen MP3 dosyası döndürür.',
    content: { 'audio/mpeg': {} },
  })
  async getMusic(
    @Query('username') username: string,
    @Res() res: Response,
  ) {
    await this.githubService.generateAndSendMusic(username, res, false);
  }

  @Get('music/custom')
  @ApiQuery({
    name: 'username',
    required: true,
    description: 'GitHub kullanıcı adı',
  })
  @ApiQuery({
    name: 'instrumentId',
    required: true,
    description:
      'Enstrüman ID (1: Piyano, 2: Flüt, 3: Gitar, 4: Keman, 5: Klarnet, 6: Davul, 7: Bağlama, 8: Keman Vibrato)',
  })
  @ApiQuery({
    name: 'tempo',
    required: false,
    description: 'Tempo (BPM cinsinden, varsayılan: 120)',
  })
  @ApiQuery({
    name: 'volume',
    required: false,
    description: 'Ses seviyesi (0.0 - 1.0 arası, varsayılan: 0.5)',
  })
  @ApiProduces('audio/mpeg')
  @ApiResponse({
    status: 200,
    description: 'Özel ayarlarla üretilen MP3 dosyası döndürür.',
    content: { 'audio/mpeg': {} },
  })
  async getCustomMusic(
    @Res() res: Response,
    @Query('username') username: string,
    @Query('instrumentId') instrumentId: number,
    @Query('tempo') tempo?: number,
    @Query('volume') volume?: number,
  ) {
    await this.githubService.generateCustomMusic(
      username,
      instrumentId,
      tempo,
      volume,
      res,
    );
  }

  @Get('music/stream')
  @ApiQuery({
    name: 'username',
    required: true,
    description: 'GitHub kullanıcı adı',
  })
  @ApiProduces('audio/mpeg')
  @ApiResponse({
    status: 200,
    description: 'MP3 dosyasını tarayıcıda çalınabilir şekilde döndürür.',
    content: { 'audio/mpeg': {} },
  })
  async streamMusic(
    @Query('username') username: string,
    @Res() res: Response,
  ) {
    await this.githubService.generateAndSendMusic(username, res, true);
  }

  @Get('music/year')
  @ApiQuery({
    name: 'username',
    required: true,
    description: 'GitHub kullanıcı adı',
  })
  @ApiQuery({
    name: 'year',
    required: false,
    description: 'Seçilen yıl (örneğin: 2023)',
  })
  @ApiResponse({
    status: 200,
    description:
      'Seçilen yılın katkı verilerine göre müzik oluşturur ve HTML olarak döndürür.',
    content: { 'text/html': {} },
  })
  async getMusicByYear(
    @Res() res: Response,
    @Query('username') username: string,
    @Query('year') year?: string,
  ) {
    await this.githubService.generateMusicByYear(username, year, res);
  }

  @Get('years')
  @ApiQuery({
    name: 'username',
    required: true,
    description: 'GitHub kullanıcı adı',
  })
  @ApiResponse({
    status: 200,
    description: 'Kullanıcının mevcut olduğu yılları döndürür.',
    content: { 'application/json': {} },
  })
  async getYears(
    @Query('username') username: string,
    @Res() res: Response,
  ) {
    const years = await this.githubService.getUserYears(username);
    res.json({ username, years });
  }
}
