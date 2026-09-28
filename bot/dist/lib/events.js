const handlers = new Map();
export const events = {
    on(name, handler) {
        const list = (handlers.get(name) ?? []);
        list.push(handler);
        handlers.set(name, list);
    },
    async dispatch(name, payload) {
        const list = (handlers.get(name) ?? []);
        if (list.length === 0) {
            return;
        }
        for (const handler of list) {
            try {
                await handler(payload);
            }
            catch (error) {
                console.error(`[Bot Events] Обработчик события ${name} завершился с ошибкой`, error);
            }
        }
    },
};
//# sourceMappingURL=events.js.map