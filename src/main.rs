use std::process::{ Child, Command, Stdio, ExitStatus };
use std::io::{ Read,  Write };
use std::path::Path;
use std::net::{ TcpListener, TcpStream };
use std::thread;

fn main()
{
    let args: Vec<String> = std::env::args().collect();
    match args.len() {
        1 => { println!( "Missing argument, which game to run?" ); return; },
        2 => { println!( "Missing argument, which port to host the wrapper on?" ); return; },
        _ => {},
    }

    let game_file: &str = &args[1];
    let game_file_owned: String = game_file.to_owned();
    let game_port = *&args[2].parse::<u16>().ok().expect( "Invalid port given for hosting this game wrapper" );
    println!( "This game you want to run is {} on port {}", game_file, game_port );

    thread::spawn( move || {
        let game_file = &game_file_owned;

        let listener: TcpListener = TcpListener::bind( ( "127.0.0.1", game_port ) ).unwrap_or_else( |e| panic!( "Couldn't bind to given port: {}", e ) );

        for stream in listener.incoming() {
            let mut stream: TcpStream = stream.unwrap_or_else( |e| panic!( "Could not get incoming connection stream: {}", e ) );
            let out_str = String::from( "v1.0:Game Wrapper:" ) + game_file;
            stream.write( out_str.as_bytes() ).unwrap_or_else( |e| panic!( "Could not send reply to the new connection: {}", e ) );
        }
    } );

    let path = Path::new( game_file );
    let cwd: &str = path.parent()
        .expect( "Could not get parent dir from path" )
        .to_str()
        .expect( "Could not parse parent dir name from path" );

    let mut game_handle: Child = Command::new( game_file )
        .current_dir( cwd )
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