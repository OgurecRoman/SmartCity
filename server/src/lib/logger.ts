type Meta = unknown;

const stamp = () => new Date().toISOString();

function print(level: 'INFO' | 'WARN' | 'ERROR', message: string, meta?: Meta): void {
  const line = `${stamp()} ${level} ${message}`;
  if (meta === undefined) {

    console.log(line);
    return;
  }
  const detail = meta instanceof Error ? `${meta.message}\n${meta.stack ?? ''}` : JSON.stringify(meta, jsonReplacer);

  console.log(`${line} ${detail}`);
}

function jsonReplacer(_key: string, value: unknown): unknown {
  return typeof value === 'bigint' ? value.toString() : value;
}

export const log = {
  info: (message: string, meta?: Meta) => print('INFO', message, meta),
  warn: (message: string, meta?: Meta) => print('WARN', message, meta),
  error: (message: string, meta?: Meta) => print('ERROR', message, meta),
};
