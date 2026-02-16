type Listener = () => void;
let listeners: Listener[] = [];

export const onLogout = (fn: Listener) => {
    listeners.push(fn);
    return () => {
        listeners = listeners.filter((l) => l !== fn);
    };
};

export const emitLogout = () => {
    listeners.forEach((fn) => fn());
};
