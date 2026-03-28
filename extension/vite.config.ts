import { defineConfig, type Plugin } from 'vite';
import { resolve } from 'path';
import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { viteStaticCopy } from 'vite-plugin-static-copy';

// Chrome rejects content scripts with non-ASCII bytes.
// rrweb bundles contain Unicode literals, so escape them after write.
function asciiOnly(): Plugin {
  return {
    name: 'ascii-only',
    closeBundle() {
      const distDir = resolve(__dirname, 'dist');
      for (const file of readdirSync(distDir)) {
        if (!file.endsWith('.js')) continue;
        const filePath = resolve(distDir, file);
        const content = readFileSync(filePath, 'utf8');
        const escaped = content.replace(/[^\x00-\x7F]/g, (ch: string) => {
          const code = ch.codePointAt(0)!;
          if (code > 0xFFFF) {
            const hi = Math.floor((code - 0x10000) / 0x400) + 0xD800;
            const lo = ((code - 0x10000) % 0x400) + 0xDC00;
            return `\\u${hi.toString(16)}\\u${lo.toString(16)}`;
          }
          return `\\u${code.toString(16).padStart(4, '0')}`;
        });
        if (escaped !== content) {
          writeFileSync(filePath, escaped, 'utf8');
          console.log(`[ascii-only] Escaped non-ASCII in ${file}`);
        }
      }
    },
  };
}

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'src/popup.ts'),
        content: resolve(__dirname, 'src/content.ts'),
        background: resolve(__dirname, 'src/background.ts'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name].js',
        assetFileNames: '[name].[ext]',
        // Prevent code splitting so each entry is self-contained.
        manualChunks: () => undefined,
      },
    },
    commonjsOptions: {
      include: [/rrweb/, /node_modules/],
    },
    target: 'es2022',
    minify: false,
    sourcemap: true,
  },
  plugins: [
    asciiOnly(),
    viteStaticCopy({
      targets: [
        { src: 'manifest.json', dest: '.' },
        { src: 'popup.html', dest: '.' },
        { src: 'icons/*', dest: 'icons' },
      ],
    }),
  ],
});
