import { Server, ServerOptions } from './server';

export async function createServer(options: ServerOptions) {
    const server = new Server(options);

    await server.start();

    return server;
}

export * from './constants';
export * from './server';

// eslint-disable-next-line @typescript-eslint/no-inferrable-types
export const version: string = '[VI]{{inject}}[/VI]';
