/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    // Exclude rrweb-player from SWC compilation — its large Svelte bundle
    // crashes SWC workers ("Jest worker encountered child process exceptions").
    // The package ships pre-built JS that doesn't need transpilation.
    config.module.rules.push({
      test: /node_modules[\\/](rrweb-player|rrweb)[\\/].*\.(js|mjs|cjs)$/,
      resolve: { fullySpecified: false },
      type: 'javascript/auto',
    });
    return config;
  },
  async headers() {
    return [
      {
        source: '/embed/:id*',
        headers: [
          { key: 'Content-Security-Policy', value: 'frame-ancestors *' },
          { key: 'X-Frame-Options', value: 'ALLOWALL' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
