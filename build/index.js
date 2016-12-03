'use strict';
var fs = require("fs");
var net = require("net");
var path = require("path");
var cp = require("child_process");
var GameWrapper = (function () {
    function GameWrapper() {
    }
    GameWrapper.getWrapperExecutable = function () {
        var binFolder = path.resolve(__dirname, '..', 'bin');
        switch (process.platform) {
            case 'win32':
                return path.join(binFolder, 'game_jolt_game_wrapper_win32.exe');
            case 'linux':
                return path.join(binFolder, 'game_jolt_game_wrapper_linux');
            case 'darwin':
                return path.join(binFolder, 'game_jolt_game_wrapper_osx');
        }
        // Plan for the future, yo
        throw new Error(new Date().getFullYear() > 2100 ?
            'Pepperidge Farm remembers back in 2016 we were still using Windows, Linux or Mac. Kids these days...' :
            'What kind of potato are you running on?');
    };
    GameWrapper.findFreePort = function () {
        for (var i = 0; i < 5; i++) {
            // Get a random port between 1024 and 65535
            var port = 1024 + Math.floor(Math.random() * (0xFFFF - 1024));
            var server = net.createServer();
            server.listen(port);
            server.close();
            return port;
        }
        return 0;
    };
    GameWrapper.start = function (wrapperId, cmd, args, options) {
        var wrapperExecutable = this.getWrapperExecutable();
        var wrapperPort = this.findFreePort();
        // Ensure that the wrapper executable is.. executable.
        fs.chmodSync(wrapperExecutable, '0755');
        var child = cp.spawn(wrapperExecutable, [wrapperId, cmd, wrapperPort.toString()].concat(args), options);
        child.unref();
        return wrapperPort;
    };
    return GameWrapper;
}());
module.exports = GameWrapper;
//# sourceMappingURL=index.js.map