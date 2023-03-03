import fastifyCookie from '@fastify/cookie';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { FastifyReply, FastifyRequest } from 'fastify';
import { createClient } from 'redis';
import { AppModule } from './app.module';

async function bootstrap() {
  // REDIS
  // This assumes that we are using localhost:6379
  const redisClient = createClient();
  redisClient.on('error', (err) => console.log(`REDIS CLIENT ERROR`, err));

  await redisClient.connect();

  // PROXIES
  const fastifyServer = new FastifyAdapter();

  const myHost = `192.168.0.186`;
  const defaultHost = `http://${myHost}:3000`;
  const loginHost = `http://${myHost}:4000`;

  let proxies; // the list of apps and their backends

  /**
   * This updates the proxies list from Redis every 1 second.
   *
   * We are doing this because some of the configurations below
   * do not support async functions/calls/methods inside.
   */
  setInterval(async () => {
    const redisApps = {};
    for await (const key of redisClient.scanIterator()) {
      const backend = await redisClient.get(key);
      redisApps[key] = backend;
    }
    proxies = redisApps;
  }, 1000);

  const isFile = (url) => {
    return url.split('/').pop().indexOf('.') > -1;
  };

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  await fastifyServer.register(require('@fastify/http-proxy'), {
    upstream: ``, // leave this blank to make it dynamic below
    // this is where we handle requests like a guard. We cannot use guards because these are not routes
    // of nest itself
    preHandler: (req: FastifyRequest, res: FastifyReply, next: any) => {
      if (
        !req.url.startsWith(`/login`) &&
        !isFile(req.url) &&
        !req.cookies['pps-auth']
      ) {
        return res.redirect(
          `/login?redirect_to=${encodeURIComponent(req.url)}`,
        );
      }
      next();
    },
    replyOptions: {
      // this will define which proxy something gets sent to
      getUpstream: (request: FastifyRequest) => {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const url = require('url').parse(request.url);
        const pathnames = url.pathname.split('/').filter((part) => part);

        if (!pathnames.length) return defaultHost;

        switch (pathnames[0]) {
          case 'login':
            return loginHost;

          case 'apps':
            return proxies[pathnames[1]];

          default:
            return defaultHost;
        }
      },
    },
    rewritePrefix: `/`,
    disableCache: true,
    cacheUrls: 0,
  });

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    fastifyServer,
  );

  await app.register(fastifyCookie);

  await app.listen(80, `0.0.0.0`);
}
bootstrap();
