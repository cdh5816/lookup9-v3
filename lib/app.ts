import packageInfo from '../package.json';
import env from './env';

const app = {
  version: packageInfo.version,
  name: 'LOOKUP9',
  logoUrl: '/logo.png',   // public 폴더에 넣을 예정
  url: env.appUrl,
};

export default app;
