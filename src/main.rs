use std::process::{ Child, Command, Stdio, ExitStatus };
use std::io::{ Read,  Write };
use std::path::Path;
use std::net::{ TcpListener, TcpStream };
use std::thread;

extern crate argparse;
use argparse::{ ArgumentParser };

fn main()
{
    let mut wrapper_id = String::new();
    let mut game_file = String::new();
    let mut game_port: u16 = 0;
    let mut game_args: Vec<String> = std::vec::Vec::new();

    {
        let mut ap: ArgumentParser = ArgumentParser::new();
        ap.refer( &mut wrapper_id ).add_argument( "wrapper-id", argparse::Store, "A unique identifier for the wrapper" ).required();
        ap.refer( &mut game_file ).add_argument( "game-file", argparse::Store, "Path to the game file" ).required();
        ap.refer( &mut game_port ).add_argument( "wrapper-port", argparse::Store, "Port to host the wrapper on" ).required();
        ap.refer( &mut game_args ).add_argument( "game-args", argparse::Collect, "Additional arguments to the game file" );
        ap.parse_args_or_exit();
    }

    let task_wrapper_id = wrapper_id.clone();
    let task_game_file = game_file.clone();
    let task_game_port = game_port;
    let task_game_args = game_args.clone();
    thread::spawn( move || {

        let listener: TcpListener = match TcpListener::bind( ( "127.0.0.1", task_game_port ) ) {
            Ok( listener ) => listener,
            Err( e ) => {
                println!( "Couldn\t bind  to given port: {}", e );
                std::process::exit( -1337 );
            },
        };

        for stream in listener.incoming() {
            let mut stream: TcpStream = stream.unwrap_or_else( |e| panic!( "Could not get incoming connection stream: {}", e ) );
            let out_str = String::from( "v0.0.1:Game Wrapper:" ) + &task_wrapper_id + ":" + &task_game_file + ":\"" + &task_game_args.join( &"\",\"" ) + "\"";
            stream.write( out_str.as_bytes() ).unwrap_or_else( |e| panic!( "Could not send reply to the new connection: {}", e ) );
        }
    } );

    let path = Path::new( &game_file );
    let cwd: &str = path.parent()
        .expect( "Could not get parent dir from path" )
        .to_str()
        .expect( "Could not parse parent dir name from path" );

    let mut game_handle: Child = Command::new( &game_file )
        .current_dir( cwd )
        .args( game_args.as_slice() )
        .stderr( Stdio::piped() )
        .spawn()
        .unwrap_or_else( |e| panic!( "Couldn't launch game: {}", e ) );

    let result: ExitStatus = game_handle.wait().unwrap_or_else( |e| panic!( "Couldn't wait for game to launch/finish {}", e ) );

    println!( "Game exited with exit code {}", result.code().expect( "Could not discern wrapped game exit code" ) );

    if !result.success() {
        let mut err_str = String::new();
        match game_handle.stderr.expect( "Could not get err stream" ).read_to_string( &mut err_str )  {
            Err(e) => panic!( "Could not read err stream {}", e ),
            Ok(_) => println!( "Stderr: {}", err_str ),
        }
    }
}