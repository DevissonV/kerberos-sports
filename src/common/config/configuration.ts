export const config = {
  appName: 'kerberos-sports',
  mode: 'PAPER' as const,
  sport: 'FOOTBALL' as const,
  nodeEnv: process.env.NODE_ENV ?? 'development',
};
