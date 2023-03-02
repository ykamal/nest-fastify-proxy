import fastifyCookie from '@fastify/cookie';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { FastifyReply, FastifyRequest } from 'fastify';
import { AppModule } from './app.module';

// PROXIES
const fastifyServer = new FastifyAdapter();

const defaultHost = `http://192.168.0.186:3000`;
const loginHost = `http://192.168.0.186:4000`;

const proxies = {
  '/apps/app-1': `http://192.168.0.186:3001`,
  '/apps/app-2': `http://192.168.0.186:3002`,
};

const isFile = (url) => {
  return url.split('/').pop().indexOf('.') > -1;
};

// eslint-disable-next-line @typescript-eslint/no-var-requires
fastifyServer.register(require('@fastify/http-proxy'), {
  upstream: ``,
  // this is where we handle requests like a guard. We cannot use guards because these are not routes
  // of nest itself
  preHandler: (req: FastifyRequest, res: FastifyReply, next: any) => {
    if (
      !req.url.startsWith(`/login`) &&
      !isFile(req.url) &&
      !req.cookies['pps-auth']
    ) {
      return res.redirect(`/login?redirect_to=${encodeURIComponent(req.url)}`);
    }
    next();
  },
  replyOptions: {
    // this will define which proxy something gets sent to
    getUpstream: (original) => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const url = require('url').parse(original.url);
      const pathnames = url.pathname.split('/').filter((part) => part);
      if (!pathnames.length) return defaultHost;

      switch (pathnames[0]) {
        case 'login':
          return loginHost;

        case 'apps':
          return proxies[pathnames[0]] ?? defaultHost;
      }
    },
  },
  rewritePrefix: `/`,
  disableCache: true,
  cacheUrls: 0,
});

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    fastifyServer,
  );

  await app.register(fastifyCookie);

  await app.listen(80, `0.0.0.0`);
}
bootstrap();
