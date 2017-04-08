'use strict';

import * as fs from 'fs';
import * as path from 'path';
import * as cp from 'child_process';

class GameWrapper
{
	private static getWrapperExecutable()
	{
		let binFolder = path.resolve( __dirname, '..', 'bin' );
		switch ( process.platform ) {
			case 'win32':
				return path.join( binFolder, 'game_jolt_game_wrapper_win32.exe' );
			case 'linux':
				return path.join( binFolder, 'game_jolt_game_wrapper_linux' );
			case 'darwin':
				return path.join( binFolder, 'game_jolt_game_wrapper_osx' );
		}

		// Plan for the future, yo
		throw new Error( new Date().getFullYear() > 2100 ?
			'Pepperidge Farm remembers back in 2016 we were still using Windows, Linux or Mac. Kids these days...' :
			'What kind of potato are you running on?' );
	}

	static start( wrapperId: string, pidPath: string, packagePath: string, executablePath: string, args: string[], options?: cp.SpawnOptions )
	{
		let wrapperExecutable = this.getWrapperExecutable();

		// Ensure that the wrapper executable is.. executable.
		fs.chmodSync( wrapperExecutable, '0755' );

		let child = cp.spawn( wrapperExecutable, [ wrapperId, pidPath, packagePath, executablePath ].concat( args ), options );
		child.unref();
	}
}

export = GameWrapper;
