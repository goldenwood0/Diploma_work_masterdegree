// Preview only: points at the disposable API from HSK1_BROWSER=1 transfer check.
import { preview } from 'vite';
await preview({ preview: { host: '127.0.0.1', port: 8446, strictPort: true,
  proxy: { '/api': { target: 'http://127.0.0.1:3002', changeOrigin: false } } } });
console.log('Isolated HSK1 preview: http://127.0.0.1:8446');
