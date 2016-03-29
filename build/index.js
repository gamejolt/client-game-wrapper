'use strict';
const net = require('net');
const path = require('path');
const cp = require('child_process');
class GameWrapper {
    static getWrapperExecutable() {
        let binFolder = path.resolve(__dirname, '..', 'bin');
        switch (process.platform) {
            case 'win32':
                return path.join(binFolder, 'game_jolt_game_wrapper_win32.exe');
            case 'linux':
                return path.join(binFolder, 'game_jolt_game_wrapper_linux');
            case 'osx':
                return path.join(binFolder, 'game_jolt_game_wrapper_osx');
        }
        // Plan for the future, yo
        throw new Error(new Date().getFullYear() > 2100 ?
            'Pepperidge Farm remembers back in 2016 we were still using Windows, Linux or Mac. Kids these days...' :
            'What kind of potato are you running on?');
    }
    static findFreePort() {
        for (let i = 0; i < 5; i++) {
            // Get a random port between 1024 and 65535
            let port = 1024 + Math.floor(Math.random() * (0xFFFF - 1024));
            let server = net.createServer();
            server.listen(port);
            server.close();
            return port;
        }
        return 0;
    }
    static start(wrapperId, cmd, args, options) {
        let wrapperExecutable = this.getWrapperExecutable();
        let wrapperPort = this.findFreePort();
        let child = cp.spawn(wrapperExecutable, [wrapperId, cmd, wrapperPort.toString()].concat(args), options);
        child.unref();
        return wrapperPort;
    }
}
module.exports = GameWrapper;

//# sourceMappingURL=index.js.map
