import path from 'node:path';
import { prepareContent, projectRoot } from './prepare-content.mjs';

// Astro's official watched-config API refreshes both Starlight's sidebar and
// the content loader whenever generated navigation or asset metadata changes.
export function contentIntegration() {
  return {
    name: 'source-markdown',
    hooks: {
      'astro:config:setup': ({ addWatchFile }) => {
        addWatchFile(path.join(projectRoot, 'src/generated/catalog.json'));
      },
      'astro:server:setup': ({ server, logger }) => {
        const content = path.join(projectRoot, 'content');
        let timer;
        let queue = Promise.resolve();
        const onChange = (_event, filename) => {
          if (!path.resolve(filename).startsWith(content + path.sep)) return;
          clearTimeout(timer);
          timer = setTimeout(() => {
            queue = queue.then(async () => {
              await prepareContent();
              server.ws.send({ type: 'full-reload' });
            }).catch((error) => logger.error(error.stack));
          }, 120);
        };
        server.watcher.add(content);
        server.watcher.on('all', onChange);
      },
    },
  };
}
