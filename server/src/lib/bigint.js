// BigInt не сериализуется в JSON по умолчанию; MAX user id и chat id храним как BigInt.
// Патч делает JSON.stringify безопасным во всём процессе (Express res.json, логи).

if (typeof BigInt.prototype.toJSON !== 'function') {
  Object.defineProperty(BigInt.prototype, 'toJSON', {
    value: function toJSON() {
      return this.toString();
    },
    writable: true,
    configurable: true,
  });
}

export {};
