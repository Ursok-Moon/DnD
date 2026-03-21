export class StorageService {
    constructor(prefix = 'dnd_') {
        this.prefix = prefix;
    }

    save(key, data) {
        try {
            localStorage.setItem(this.prefix + key, JSON.stringify(data));
            return true;
        } catch (error) {
            console.error('Error saving to localStorage:', error);
            return false;
        }
    }

    load(key, defaultValue = null) {
        try {
            const data = localStorage.getItem(this.prefix + key);
            return data ? JSON.parse(data) : defaultValue;
        } catch (error) {
            console.error('Error loading from localStorage:', error);
            return defaultValue;
        }
    }

    remove(key) {
        localStorage.removeItem(this.prefix + key);
    }

    saveAll(data) {
        Object.entries(data).forEach(([key, value]) => {
            this.save(key, value);
        });
    }

    loadAll() {
        const data = {};
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.startsWith(this.prefix)) {
                const cleanKey = key.replace(this.prefix, '');
                data[cleanKey] = this.load(cleanKey);
            }
        }
        return data;
    }

    clear() {
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.startsWith(this.prefix)) {
                keysToRemove.push(key);
            }
        }
        keysToRemove.forEach(key => localStorage.removeItem(key));
    }
}