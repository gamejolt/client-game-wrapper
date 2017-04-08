'use strict';

let gulp = require( 'gulp' );
let sequence = require( 'run-sequence' );
let shell = require( 'gulp-shell' );
let plugins = require( 'gulp-load-plugins' )();
let rp = require( 'request-promise' );
let _ = require( 'lodash' );
let fs = require( 'fs' );
let path = require( 'path' );
let del = require( 'del' );
let Download = require( 'download' );
let config = require( 'config' );

gulp.task( 'clean', function()
{
    return del( './build/**/*' );
} );

gulp.task( 'js', shell.task( [
   'tsc',
] ) );

gulp.task( 'build-rust', shell.task( [
   'cargo build --release',
] ) );

gulp.task( 'build', [ 'build-rust' ], function( cb )
{
    return sequence( 'clean', 'js', cb );
} );

gulp.task( 'watch', [ 'build' ], function()
{
    gulp.watch( [ './src/**/*', 'tsconfig.json' ], [ 'build' ] );
} );

gulp.task( 'fetch-binaries', function()
{
    let urls = {};

    let travisLatestBuildNumber = 0;
    let appveyorJobId = 0;

    let travisSettings = {
        method: 'GET',
        headers: {
            'User-Agent': 'TravisGJClientGameWrapper/' + require( './package.json' ).version,
            'Accept': 'application/vnd.travis-ci.2+json',
        },
        json: true,
        resolveWithFullResponse: true,
    };

    let appveyorSettings = {
        method: 'GET',
        json: true,
        resolveWithFullResponse: true,
    };

    return del( './bin/**/*' )
        .then( function()
        {
            let settings = _.defaults( {
                method: 'POST',
                uri: 'https://api.travis-ci.org/auth/github',
                body: {
                    github_token: config.github_token,
                },
            }, travisSettings );

            return rp( settings );
        } )
        .then( function( response )
        {
            if ( !response || !response.body ) {
                throw new Error( 'Invalid travis auth/github response' );
            }

            if ( response.statusCode != 200 || !response.body.access_token ) {
                throw new Error( 'Could not get travis access token. Response:\n' + JSON.stringify( response.body, null, 2 ) );
            }

            travisSettings.headers['Authorization'] = 'token ' + response.body.access_token;

            let settings = _.defaults( {
                uri: 'https://api.travis-ci.org/repos?slug=gamejolt%2Fclient-game-wrapper',
            }, travisSettings );

            return rp( settings );
        } )
        .then( function( response )
        {
            if ( !response || response.statusCode != 200 || !response.body ) {
                throw new Error( 'Invalid travis /repos response' );
            }

            if ( !response.body.repos || !response.body.repos[0] || response.body.repos[0].last_build_state !== 'passed' ) {
                throw new Error( 'Can\'t fetch binaries because travis most recent build failed' );
            }

            let latestBuildId = response.body.repos[0].last_build_id;
            travisLatestBuildNumber = response.body.repos[0].last_build_number;

            let settings = _.defaults( {
                uri: 'https://api.travis-ci.org/builds/' + latestBuildId,
            }, travisSettings );
            return rp( settings );
        } )
        .then( function( response )
        {
            if ( !response || response.statusCode != 200 || !response.body ) {
                throw new Error( 'Invalid travis /builds response' );
            }

            if ( !response.body.build || response.body.build.state !== 'passed' || !response.body.jobs ) {
                throw new Error( 'Can\'t fetch binaries because travis most recent build failed' );
            }

            let jobs = response.body.jobs;
            for ( let job of jobs ) {
                if ( job.config.rust !== 'stable' ) {
                    continue;
                }

                if ( job.state !== 'passed' ) {
                    throw new Error( 'Can\'t fetch binaries because travis most recent build\'s job failed' );
                }

                if ( job.config.os === 'linux' ) {
                    urls['linux'] = 'https://s3.amazonaws.com/gjolt-client-builds/gamejolt/client-game-wrapper/' + travisLatestBuildNumber + '/' + job.number + '/target/release/game_jolt_game_wrapper';
                }
                else if ( job.config.os === 'osx' ) {
                    urls['osx'] = 'https://s3.amazonaws.com/gjolt-client-builds/gamejolt/client-game-wrapper/' + travisLatestBuildNumber + '/' + job.number + '/target/release/game_jolt_game_wrapper';
                }
            }

            let settings = _.defaults( {
                uri: 'https://ci.appveyor.com/api/projects/hworld/client-game-wrapper',
            }, appveyorSettings );
            return rp( settings );
        } )
        .then( function( response )
        {
            if ( !response || response.statusCode != 200 || !response.body ) {
                throw new Error( 'Invalid response' );
            }

            let appveyorJob = 0;
            if ( response.body.build.jobs[0].name === 'Environment: TARGET=i686-pc-windows-gnu, BITS=32' ) {
                appveyorJob = response.body.build.jobs[0];
            }
            else {
                appveyorJob = response.body.build.jobs[1];
            }

            if ( appveyorJob.status !== 'success' ) {
                throw new Error( 'Can\'t fetch binaries because the most recent appveyor job failed' );
            }

            appveyorJobId = appveyorJob.jobId;

            let settings = _.defaults( {
                uri: 'https://ci.appveyor.com/api/buildjobs/' + appveyorJobId + '/artifacts',
            }, appveyorSettings );
            return rp( settings );
        } )
        .then( function( response )
        {
            if ( !response || response.statusCode != 200 || !response.body ) {
                throw new Error( 'Invalid response' );
            }

            let appveyorArtifacts = response.body;
            if ( !appveyorArtifacts[0] || !appveyorArtifacts[0].fileName ) {
                throw new Error( 'Can\'t fetch binaries because the most recent appveyor job doesn\'t have a valid artifact' );
            }

            urls['win32'] = 'https://ci.appveyor.com/api/buildjobs/' + appveyorJobId + '/artifacts/' + appveyorArtifacts[0].fileName;
        } )
        .then( function()
        {
            console.log( urls );
            if ( Object.keys( urls ).length < 3 ) {
                throw new Error( 'Can\'t fetch binaries because not all oses returned a url' );
            }

            let promises = [];
            for ( let os of [ 'win32', 'linux', 'osx' ] ) {
                promises.push( new Promise( function( resolve, reject )
                {
                    let parsed = path.parse( path.basename( urls[ os ] ) );
                    let filename = parsed.name;
                    let ext = parsed.ext;
                    let basename = parsed.base;
                    let newBasename = filename + '_' + os + ext;

                    console.log( urls[ os ] );
                    new Download( { mode: '755' } )
                        .get( urls[ os ] )
                        .dest( path.join( __dirname, 'bin', os ) )
                        .run( function( err, files )
                        {
                            if ( err ) {
                                return reject( err );
                            }
                            fs.renameSync( path.join( __dirname, 'bin', os, basename ), path.join( __dirname, 'bin', newBasename ) );
                            fs.rmdirSync( path.join( __dirname, 'bin', os ) );
                            resolve( files );
                        } );
                } ) );
            }
            return Promise.all( promises );
        } );
} );
