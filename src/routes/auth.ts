import type { FastifyPluginAsync } from "fastify";
import { createRequire } from "node:module";

type Bcrypt = {
  compare(data: string, hash: string): Promise<boolean>;
};

// bcryptjs ships no type declarations; require it to keep the dependency list minimal.
const bcrypt = createRequire(import.meta.url)("bcryptjs") as Bcrypt;

const authRoutes: FastifyPluginAsync = async (app) => {
  app.post("/auth/login", async (request, reply) => {
    const body = (request.body ?? {}) as Record<string, unknown>;
    const login = typeof body.login === "string" ? body.login : "";
    const password = typeof body.password === "string" ? body.password : "";
    const expectedLogin = process.env.LOGIN;
    const expectedHash = process.env.PASSWORD_HASH;

    if (!expectedLogin || !expectedHash) {
      throw new Error("LOGIN / PASSWORD_HASH are not set");
    }

    if (!login || !password) {
      return reply.code(400).send({ error: "login and password are required" });
    }

    const passwordMatches = await bcrypt.compare(password, expectedHash);
    if (login !== expectedLogin || !passwordMatches) {
      return reply.code(401).send({ error: "invalid credentials" });
    }

    return { token: app.jwt.sign({ login }, { expiresIn: "12h" }) };
  });
};

export default authRoutes;
