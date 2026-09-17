import { Body, Controller, HttpCode, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { AuthService } from "./auth.service";
import { LoginDto, RefreshDto, RegisterDto } from "./dto";
import { Public } from "./public.decorator";

// Credential endpoints are brute-force targets, so they get a tighter
// 10 req/min per-IP limit than the global 60/min (see app.module.ts).
const AUTH_THROTTLE = { default: { limit: 10, ttl: 60_000 } };

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Throttle(AUTH_THROTTLE)
  @Post("register")
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto.email, dto.password, dto.name);
  }

  @Public()
  @Throttle(AUTH_THROTTLE)
  @HttpCode(200)
  @Post("login")
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password);
  }

  @Public()
  @HttpCode(200)
  @Post("refresh")
  refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @Public()
  @HttpCode(204)
  @Post("logout")
  async logout(@Body() dto: RefreshDto) {
    await this.authService.logout(dto.refreshToken);
  }
}
