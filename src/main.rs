use std::process::{ Child, Command, Stdio, ExitStatus };
use std::io::{ BufRead, BufReader, BufWriter, Read,  Write };
use std::path::{ Path, PathBuf };
use std::net::{ TcpListener, TcpStream };
use std::thread;
use std::fs::File;

extern crate argparse;
extern crate rand;

use argparse::{ ArgumentParser };
use rand::distributions::{IndependentSample, Range};

struct ListenerData {
    listener: TcpListener,
    port: u16,
}

fn create_listener() -> Result<ListenerData, &'static str>
{
    let possible_port_values = Range::new( 1024, 65535 );
    let mut rng = rand::thread_rng();
    for _ in 1..5 {
        let try_port = possible_port_values.ind_sample( &mut rng );

        let result = TcpListener::bind( ( "127.0.0.1", try_port ) );
        if result.is_ok() {
            return Ok( ListenerData{ listener: result.unwrap(), port: try_port } )
        }
    }

    Err( &"Failed to bind port" )
}

struct Credentials {
    username: String,
    user_token: String,
}

fn parse_credentials( credentials_file: &Path ) -> Result<Credentials, &str>
{
    let f = File::open( credentials_file ).unwrap();
    let mut reader = BufReader::new( f );

    let mut credentials_version = String::new();
    reader.read_line( &mut credentials_version ).unwrap();
    match credentials_version.trim().as_ref() {
        "0.2.0" => {
            let mut username = String::new();
            let mut token = String::new();
            reader.read_line( &mut username ).unwrap();
            reader.read_line( &mut token ).unwrap();
            Ok( Credentials{ username: username.trim().to_string(), user_token: token.trim().to_string() } )
        },
        _ => Err( "Unknown version" ),
    }
}

fn main()
{
    let mut wrapper_id = String::new();
    let mut pid_path = String::new();
    let mut package_path = String::new();
    let mut game_path = String::new();
    let mut game_args: Vec<String> = std::vec::Vec::new();

    {
        let mut ap: ArgumentParser = ArgumentParser::new();
        ap.refer( &mut wrapper_id ).add_argument( "wrapper-id", argparse::Store, "A unique identifier for the wrapper" ).required();
        ap.refer( &mut pid_path ).add_argument( "pid-path", argparse::Store, "Path to the pid directory" ).required();
        ap.refer( &mut package_path ).add_argument( "package-path", argparse::Store, "Path to the package installation directory" ).required();
        ap.refer( &mut game_path ).add_argument( "game-path", argparse::Store, "Path to the game file relative to the package installation directory" ).required();
        ap.refer( &mut game_args ).add_argument( "game-args", argparse::Collect, "Additional arguments to the game file" );
        ap.parse_args_or_exit();
    }

    let listener_data = create_listener().unwrap();
    let listener = listener_data.listener;

    let task_wrapper_id = wrapper_id.clone();
    let task_package_path = package_path.clone();
    let task_game_path = game_path.clone();
    let task_game_args = game_args.clone();
    thread::spawn( move || {

        for stream in listener.incoming() {
            let mut stream: TcpStream = stream.unwrap_or_else( |e| panic!( "Could not get incoming connection stream: {}", e ) );
            let out_str = String::from( "v0.2.0:Game Wrapper:" ) + &task_wrapper_id + ":" + &task_package_path + ":" + &task_game_path + ":\"" + &task_game_args.join( &"\",\"" ) + "\"";
            stream.write( out_str.as_bytes() ).unwrap_or_else( |e| panic!( "Could not send reply to the new connection: {}", e ) );
        }
    } );

    let mut pid_path = PathBuf::from( pid_path );
    pid_path.push( wrapper_id );

    match File::create( &pid_path ) {
        Ok( f ) => {
            let mut writer = BufWriter::new( f );
            writer.write( listener_data.port.to_string().as_bytes() )
                .expect( "Failed to write pid file" );
            writer.flush()
                .expect( "Failed to flush pid file" );
            drop( writer );
        },
        Err( e ) => println!( "Failed to write pid file: {}", e ),
    };

    // Get the full game file path.
    let mut game_file = PathBuf::from( package_path.clone() );
    game_file.push( game_path );

    // Current working directory is the directory of the game executable
    let cwd: &Path = game_file.parent()
        .expect( "Could not get parent dir from path" );

    let mut package_credentials: PathBuf = PathBuf::from( &package_path );
    package_credentials.push( ".gj-credentials" );

    let mut game_file_credentials: PathBuf = PathBuf::from( cwd );
    game_file_credentials.push( ".gj-credentials" );

    // Copy over the credential file from the package directory to the game executable's directory.
    let mut supports_game_api = std::fs::copy( package_credentials.as_path(), game_file_credentials.as_path() ).is_ok();

    let mut credentials: Credentials = Credentials{ username: String::new(), user_token: String::new() };
    if supports_game_api {
        let get_credentials = parse_credentials( game_file_credentials.as_path() );
        supports_game_api = get_credentials.is_ok();
        credentials = get_credentials.unwrap();
    }

    if supports_game_api {
        game_args.push( String::from( "gjapi_username" ) );
        game_args.push( credentials.username.to_string() );
        game_args.push( String::from( "gjapi_token" ) );
        game_args.push( credentials.user_token.to_string() );
    }

    let mut game_handle: Child = Command::new( &game_file )
        .current_dir( cwd )
        .args( game_args.as_slice() )
        .stderr( Stdio::piped() )
        .spawn()
        .unwrap_or_else( |e| panic!( "Couldn't launch game: {}", e ) );

    let result: ExitStatus = game_handle.wait().unwrap_or_else( |e| panic!( "Couldn't wait for game to launch/finish {}", e ) );

    if std::fs::remove_file( &pid_path ).is_err() {
        println!( "Failed to remove pid file: {}", pid_path.display() );
    }

    println!( "Game exited with exit code {}", result.code().expect( "Could not discern wrapped game exit code" ) );

    if !result.success() {
        let mut err_str = String::new();
        match game_handle.stderr.expect( "Could not get err stream" ).read_to_string( &mut err_str )  {
            Err(e) => panic!( "Could not read err stream {}", e ),
            Ok(_) => println!( "Stderr: {}", err_str ),
        }
    }
}
