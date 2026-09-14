import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { AuditModule } from "../audit/audit.module";
import { BillingModule } from "../billing/billing.module";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { JwtStrategy } from "./jwt.strategy";

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_ACCESS_SECRET,
    }),
    AuditModule,
    BillingModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
