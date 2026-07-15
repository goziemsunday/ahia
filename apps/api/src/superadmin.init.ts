import { Injectable, OnApplicationBootstrap } from "@nestjs/common";
import { AuthService } from "@thallesp/nestjs-better-auth";

import { db } from "@repo/db";

import { auth } from "./lib/auth";
import { sendAccountCreatedEmail } from "./lib/email";
import env from "./lib/env";
import { generatePassword } from "./lib/utils";

@Injectable()
export class SuperadminBootstrapper implements OnApplicationBootstrap {
  constructor(private authService: AuthService<typeof auth>) {}

  async onApplicationBootstrap() {
    if (env.NODE_ENV === "test") return;

    const existing = await db.query.user.findFirst({
      where: (user, { eq }) => eq(user.role, "superadmin"),
    });

    // const [existing] = await db
    //   .select()
    //   .from(user)
    //   .where(eq(user.role, "superadmin"))
    //   .limit(1);

    if (existing) return;

    const password = generatePassword();
    const { user: superadmin } = await this.authService.api.createUser({
      body: {
        name: "Super Admin",
        email: env.SUPERADMIN_EMAIL,
        role: "superadmin",
        password,
      },
    });

    await sendAccountCreatedEmail({
      to: superadmin.email,
      role: "superadmin",
      name: superadmin.name,
      email: superadmin.email,
      password,
    });
    await this.authService.api.sendVerificationEmail({
      body: { email: superadmin.email },
    });

    console.log(`Superadmin created: ${superadmin.email}`);
  }
}
