'use strict';

let gulp = require( 'gulp' );
let sequence = require( 'run-sequence' );
let shell = require( 'gulp-shell' );
let plugins = require( 'gulp-load-plugins' )();
let path = require( 'path' );
let del = require( 'del' );

let typescript = plugins.typescript.createProject( './src/tsconfig.json', {
	typescript: require( 'typescript' ),
} );

gulp.task( 'clean', function()
{
	return del( './build/**/*' );
} );

gulp.task( 'js', function()
{
	return gulp.src( './src/**/*.ts' )
		.pipe( plugins.plumber() )
		.pipe( plugins.sourcemaps.init() )
		.pipe( plugins.typescript( typescript ) )
		.pipe( plugins.sourcemaps.write( '.', {
			sourceRoot: function( file )
			{
				// Gotta return a relative path from the build file to the source folder.
				return path.relative(
					path.join( __dirname, file.relative ),
					path.join( __dirname, 'src' )
				) + path.sep;
			}
		} ) )
		.pipe( gulp.dest( './build' ) );
} );

let executableName = process.platform === 'win32' ? 'game_jolt_game_wrapper.exe' : 'game_jolt_game_wrapper';
let newExecutableName = process.platform === 'win32' ? 'game_jolt_game_wrapper_win32.exe' : 'game_jolt_game_wrapper_' + process.platform;

gulp.task( 'rust', shell.task( [
	'cargo build --release',
    'mkdir "' + path.join( __dirname, 'bin' ) + '"',
	'cp "' + path.resolve( path.join( __dirname, 'target', 'release', executableName ) ) + '" "' + path.resolve( path.join( __dirname, 'bin', newExecutableName ) ) + '"',
] ) );

gulp.task( 'build', function( cb )
{
	return sequence( 'clean', 'js', 'rust', cb );
} );

gulp.task( 'watch', [ 'build' ], function()
{
	gulp.watch( [ './src/**/*' ], [ 'build' ] );
} );