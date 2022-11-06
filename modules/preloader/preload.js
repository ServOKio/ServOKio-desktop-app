const {
    contextBridge,
    ipcRenderer,
    remote
} = require("electron");
const fs = require("fs");

contextBridge.exposeInMainWorld(
    "sapi", {
        send: (channel, data) => {
            // whitelist channels
            let validChannels = ["toMain", "toMinecraft"];
            if (validChannels.includes(channel)) {
                return ipcRenderer.sendSync(channel, data);
            }
        },
        sendA: (channel, data) => {
            // whitelist channels
            let validChannels = ["toMain", "toMinecraft"];
            if (validChannels.includes(channel)) {
                ipcRenderer.send(channel, data);
            }
        },
        receive: (channel, func) => {
            let validChannels = ["fromMain", "fromMinecraft"];
            if (validChannels.includes(channel)) {
                // Deliberately strip event as it includes `sender`
                ipcRenderer.on(channel, (event, ...args) => func(...args));
            }
        },
        removeReceive: (channel, func) => {
            let validChannels = ["fromMain", "fromMinecraft"];
            if (validChannels.includes(channel)) {
                // Deliberately strip event as it includes `sender`
                ipcRenderer.removeListener(channel, func);
            }
        },
        getMP3: (channel, args) => {
            let validChannels = ["fromMain"];
            if (validChannels.includes(channel)) {
                const bin = fs.readFileSync(args[0]);
                const buf = new Buffer(bin, 'binary');
                const string = buf.toString('base64');
                return {
                    title: "tagger.title",
                    uri: "data:audio/mpeg;base64,"+string
                }
            }
        },
        remote: _ => {
            return remote;
        },
    }
);
window.hi = () => {
    return "Hi";
}