import { deleteSession, getSession, setSession } from '../lib/api.js';
export class ApiSessionStore {
    async get(key) {
        return (await getSession(key)) ?? undefined;
    }
    async set(key, value) {
        await setSession(key, value);
    }
    async delete(key) {
        await deleteSession(key);
    }
}
//# sourceMappingURL=sessionStore.js.map