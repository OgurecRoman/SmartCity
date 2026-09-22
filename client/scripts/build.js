const esbuild = require('esbuild');
const dotenv = require('dotenv');

// Загружаем переменные из .env
dotenv.config();

// Определяем, какие переменные экспортировать в код
const define = {
  'process.env.API_URL': JSON.stringify(process.env.VITE_API_URL || 'http://localhost:3000'),
};

// Режим разработки или продакшена
const isWatch = process.argv.includes('--watch');

const buildOptions = {
  entryPoints: ['public/app.ts'],
  bundle: true,
  outfile: 'public/app.js',
  target: 'es2020',
  define,
  minify: !isWatch,
  sourcemap: isWatch,
};

async function run() {
  if (isWatch) {
    // Новый API esbuild (0.24+)
    const ctx = await esbuild.context(buildOptions);
    
    // Запускаем dev-сервер
    const { host, port } = await ctx.serve({
      servedir: 'public',
      port: 8080,
    });
    
    console.log(`🚀 Сервер запущен на http://${host}:${port}`);
    console.log(`📂 Откройте: http://localhost:${port}/?dev=900000001`);
  } else {
    // Режим продакшена
    await esbuild.build(buildOptions);
    console.log('✅ Сборка завершена');
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});