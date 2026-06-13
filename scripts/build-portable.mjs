import { access, copyFile, cp, mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const rootDir = process.cwd();
const outputDir = path.join(rootDir, 'portable', 'idealista-bot');
const windowsDir = path.join(rootDir, 'windows');
const args = process.argv.slice(2);

const envSourceArg = args.find((arg) => arg.startsWith('--env-source='));
const envSource = envSourceArg
  ? path.resolve(rootDir, envSourceArg.split('=')[1])
  : path.join(rootDir, '.env.example');

async function pathExists(targetPath) {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  if (!(await pathExists(path.join(rootDir, 'dist')))) {
    throw new Error(
      'dist/ not found. Run the build before creating the portable folder.',
    );
  }

  if (!(await pathExists(path.join(rootDir, 'node_modules')))) {
    throw new Error(
      'node_modules/ not found. Run npm install before creating the portable folder.',
    );
  }

  if (!(await pathExists(envSource))) {
    throw new Error(`Env source not found: ${envSource}`);
  }

  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });

  await cp(path.join(rootDir, 'dist'), path.join(outputDir, 'dist'), {
    recursive: true,
  });
  await cp(
    path.join(rootDir, 'node_modules'),
    path.join(outputDir, 'node_modules'),
    {
      recursive: true,
    },
  );

  await mkdir(path.join(outputDir, 'data', 'images'), { recursive: true });
  await mkdir(path.join(outputDir, 'data', 'snapshots'), { recursive: true });
  await mkdir(path.join(outputDir, 'logs'), { recursive: true });
  await mkdir(path.join(outputDir, 'run'), { recursive: true });
  await mkdir(path.join(outputDir, '.browser-profile'), { recursive: true });

  await copyFile(
    path.join(rootDir, 'package.json'),
    path.join(outputDir, 'package.json'),
  );
  await copyFile(
    path.join(rootDir, 'package-lock.json'),
    path.join(outputDir, 'package-lock.json'),
  );
  await copyFile(envSource, path.join(outputDir, '.env'));
  await copyFile(
    path.join(rootDir, 'README.md'),
    path.join(outputDir, 'README.md'),
  );
  await copyFile(
    path.join(rootDir, '.env.example'),
    path.join(outputDir, '.env.example'),
  );

  await cp(windowsDir, outputDir, { recursive: true });

  await writeFile(
    path.join(outputDir, 'LEEME-WINDOWS.txt'),
    [
      'Idealista Bot - carpeta portable para Windows',
      '',
      '1. Asegurate de tener Node.js 18+ y Google Chrome instalados.',
      '2. Completa el archivo .env si todavia no viene configurado.',
      "3. En el primer uso de esta carpeta, hace doble click en 'Inicializar Navegador.cmd'.",
      '4. Acepta cookies / inicia sesion en Idealista si hace falta y cierra Chrome.',
      "5. Luego hace doble click en 'Iniciar Bot.cmd'.",
      "6. Usa 'Ver Logs.cmd' si queres revisar que esta pasando.",
      "7. Usa 'Detener Bot.cmd' para apagar el bot manualmente.",
    ].join('\r\n'),
    'utf8',
  );

  console.log(`Portable package created at: ${outputDir}`);
  console.log(`Environment file copied from: ${envSource}`);
}

main().catch((error) => {
  console.error('Failed to create portable package:', error.message);
  process.exit(1);
});
