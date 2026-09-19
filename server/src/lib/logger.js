const stamp = () => new Date().toISOString();

function print(level, message, meta) {
  const line = `${stamp()} ${level} ${message}`;
  if (meta === undefined) {
    // eslint-disable-next-line no-console
    console.log(line);
    return;
  }
  const detail = meta instanceof Error ? `${meta.message}\n${meta.stack ?? ''}` : JSON.stringify(meta, jsonReplacer);
  // eslint-disable-next-line no-console
  console.log(`${line} ${detail}`);
}

function jsonReplacer(_key, value) {
  return typeof value === 'bigint' ? value.toString() : value;
}

export const log = {
  info: (message, meta) => print('INFO', message, meta),
  warn: (message, meta) => print('WARN', message, meta),
  error: (message, meta) => print('ERROR', message, meta),
};
