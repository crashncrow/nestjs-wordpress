import { Controller, Get } from '@nestjs/common';
import { VERSION } from 'nestjs-wordpress';

@Controller('health')
export class HealthController {
  @Get()
  check(): { status: 'ok'; library: string } {
    return { status: 'ok', library: VERSION };
  }
}
