import { Body, Controller, Get, Patch, Post, Req } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import {
  AuthService,
  Session,
  type UserSession,
} from "@thallesp/nestjs-better-auth";
import type { User } from "better-auth";
import { fromNodeHeaders } from "better-auth/node";
import type { Request } from "express";

import { ApiErrors } from "../common/decorators/api-error-res.decorator";
import { ApiSuccessRes } from "../common/decorators/api-success-res.decorator";
import { auth } from "../lib/auth";
import type { SuccessRes } from "../lib/types";
import { successResponse } from "../lib/utils";
import {
  ChangePasswordDto,
  ChangePasswordResponseDto,
  UpdateUserDto,
  UserDto,
} from "./user.dto";

@ApiTags("User")
@ApiBearerAuth()
@Controller("user")
export class UserController {
  constructor(private authService: AuthService<typeof auth>) {}

  @Get("me")
  @ApiOperation({ description: "Get the current user" })
  @ApiSuccessRes({ model: UserDto, description: "Current authenticated user" })
  @ApiErrors({
    401: { description: "Not authenticated: no or invalid session" },
  })
  get(@Session() session: UserSession<typeof auth>): SuccessRes<User> {
    return successResponse(session.user);
  }

  @Patch("me")
  @ApiOperation({ description: "Update the current user" })
  @ApiSuccessRes({ model: UserDto, description: "User updated" })
  @ApiErrors({
    400: {
      description: "Invalid input",
      example: { error: { details: "name: Expected string, received number" } },
    },
    401: { description: "Not authenticated: no or invalid session" },
  })
  async update(@Req() req: Request, @Body() body: UpdateUserDto) {
    const response = await this.authService.api.updateUser({
      body,
      headers: fromNodeHeaders(req.headers),
    });

    return successResponse(response);
  }

  @Post("me/password")
  @ApiOperation({ description: "Change the current user's password" })
  @ApiSuccessRes({
    model: ChangePasswordResponseDto,
    description: "Password changed",
  })
  @ApiErrors({
    400: {
      description: "Invalid input",
      example: {
        error: {
          details:
            "currentPassword: Required; newPassword: Must be at least 8 characters",
        },
      },
    },
    401: { description: "Not authenticated: no or invalid session" },
  })
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
