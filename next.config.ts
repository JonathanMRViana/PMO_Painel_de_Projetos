import type { NextConfig } from 'next';

const isGitHubPagesBuild = process.env.PMO_GITHUB_PAGES === '1';

const nextConfig: NextConfig = isGitHubPagesBuild
  ? {
      output: 'export',
      assetPrefix: '/PMO_Painel_de_Projetos',
    }
  : {};

export default nextConfig;
