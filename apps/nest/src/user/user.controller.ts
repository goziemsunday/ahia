import { Body, Controller, Get, Patch, Post, Req } from "@nestjs/common";
import {
  AuthService,
  Session,
  type UserSession,
} from "@thallesp/nestjs-better-auth";
import type { User } from "better-auth";
import { fromNodeHeaders } from "better-auth/node";
import type { Request } from "express";

import { auth } from "../lib/auth";
import type { SuccessRes } from "../lib/types";
import { successResponse } from "../lib/utils";
import { ChangePasswordDto, UpdateUserDto } from "./user.dto";

@Controller("user")
export class UserController {
  constructor(private authService: AuthService<typeof auth>) {}

  @Get("me")
  get(@Session() session: UserSession<typeof auth>): SuccessRes<User> {
    return successResponse(session.user);
  }

  @Patch("me")
  async update(@Req() req: Request, @Body() body: UpdateUserDto) {
    const response = await this.authService.api.updateUser({
      body,
      headers: fromNodeHeaders(req.headers),
    });

    return successResponse(response);
  }

  @Post("me/password")
  async changePassword(@Req() req: Request, @Body() body: ChangePasswordDto) {
    await this.authService.api.changePassword({
      body: {
        currentPassword: body.currentPassword,
        newPassword: body.newPassword,
        revokeOtherSessions: body.revokeOtherSessions,
      },
      headers: fromNodeHeaders(req.headers),
    });

    return successResponse({ status: true });
  }
}
