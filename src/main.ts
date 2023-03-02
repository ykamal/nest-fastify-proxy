import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { AppModule } from './app.module';

// PROXIES
const fastifyServer = new FastifyAdapter();

const proxies = {
  '/': `http://192.168.0.186:3000`,
  '/login': `http://192.168.0.186:4000`,
  '/apps/app-1': `http://192.168.0.186:3001`,
  '/apps/app-2': `http://192.168.0.186:3002`,
};

// eslint-disable-next-line @typescript-eslint/no-var-requires
fastifyServer.register(require('@fastify/http-proxy'), {
  upstream: ``,
  replyOptions: {
    getUpstream: (original) => {
      return proxies[original.url] ?? `/`;
    },
  },
  disableCache: true,
  cacheUrls: 0,
});

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    fastifyServer,
  );
  await app.listen(80, `0.0.0.0`);
}
bootstrap();
