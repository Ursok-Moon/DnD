export class Helpers {
    static calculateModifier(value) {
        return Math.floor((value - 10) / 2);
    }

    static formatModifier(value) {
        return value >= 0 ? `+${value}` : value.toString();
    }

    static generateId() {
        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    static deepClone(obj) {
        return JSON.parse(JSON.stringify(obj));
    }

    static debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    static showMessage(message, type = 'info', duration = 3000) {
        const messageEl = document.createElement('div');
        messageEl.className = `message message-${type}`;
        messageEl.textContent = message;
        messageEl.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            background: ${type === 'error' ? '#f44336' : type === 'warning' ? '#ff9800' : '#4CAF50'};
            color: white;
            border-radius: 5px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.3);
            z-index: 9999;
            animation: slideIn 0.3s ease;
        `;
        
        document.body.appendChild(messageEl);
        
        setTimeout(() => {
            messageEl.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => messageEl.remove(), 300);
        }, duration);
    }

    static validateNumber(value, min, max, defaultValue) {
        const num = parseInt(value);
        if (isNaN(num)) return defaultValue;
        if (min !== undefined && num < min) return min;
        if (max !== undefined && num > max) return max;
        return num;
    }
}