'use strict';
var fs = require("fs");
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
    GameWrapper.start = function (wrapperId, pidPath, packagePath, executablePath, args, options) {
        var wrapperExecutable = this.getWrapperExecutable();
        // Ensure that the wrapper executable is.. executable.
        fs.chmodSync(wrapperExecutable, '0755');
        var child = cp.spawn(wrapperExecutable, [wrapperId, pidPath, packagePath, executablePath].concat(args), options);
        child.unref();
    };
    return GameWrapper;
}());
module.exports = GameWrapper;
//# sourceMappingURL=index.js.map