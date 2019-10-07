var express = require('express')
 , http = require('http');
const session = require('express-session');
var app = express();
app.set('port', 3000);
const bodyParser = require('body-parser');
app.use(bodyParser.json());
app.use(express.static(__dirname + '/game'));
app.use(session({secret: '919191919'})); // Used to give each user a session identifier when they come to the website.

var players = [] // List of all players attatched to the web server.

var sess; // Probably should be in the post function below?


// Sync function each client calls to tell the webserver their x,y coords.
app.post('/sync',function(req,res){
   
   sess=req.session

   // console.log(sess.username)
   if (sess.username == undefined){
      // Assigns the client a random username if they don't have one.
      // Yes there can be duplicates right now. Don't care yet.
      sess.username = "player" + Math.floor((Math.random() * 100) + 1);
   }

   // console.log(sess)

   // JSON blob of x,y coords.
   var array = JSON.parse(JSON.stringify(req.body)).sync;
   // console.log(array)

   // Client username
   var username = sess.username;

   // If player is new add them to the list of players.
   if (!getPlayer(username)){
      // if (players.length ==2){ // TODO  REMOVE?
         // res.status(500).send('Server FULL');
         // return
      // }
      var player = {}
      player["x"]=64;
      player["y"]=64;
      player["username"] = username;
      players.push(player)
      console.log("New Player: " + username)
   }

   // Update our players blob information with what we received from the packet
   updatePlayer(username, array);
   // Sends success, and shows their username, this is used during the first time the client syncs so they know their own username.
   res.status(200).send(JSON.stringify(username));
} );

// Used for me to goto this endpoint to play the pico8 cart.
app.get('/game',function(req,res){
   res.sendFile(__dirname + '/game/index.html');
} );

// Displays a blob of all the active players information.
// This is used on the client side, they do a GET request every x milliseconds
// This is how they get their new information.
// This will be replaced with socket io.
app.get('/sync',function(req,res){
   res.json(JSON.stringify(players))
} );

// app.get('/get_number', function(req,res){
//    // res.write(players.length.toString())
//    res.status(200).send(players.length.toString());

// } );

//Start server :) 
http.createServer(app).listen(app.get('port'), function(){
 console.log('Express server listening on port ' + app.get('port'));
});


// Updates the player specified by the username's x and y coord.
// This will be expanded beyond x and y?
function updatePlayer(username, array){
   var player = getPlayer(username);
   if(player != null){
      player.x = array[0]
      player.y = array[1]
      console.log(player.username + " X: " + player.x + ", Y: " + player.y)
   }
}

// Iterate over players object and find the player with passed in username.
function getPlayer(username){
   for (var i=0; i< players.length; i++){
      var player = players[i];
      if (player.username == username){
         return player;
      }
   }
}