var username = null // The clients username.
// the gpio pins, can be read and written to : gpio[0]=5, writes 5 to pin 0.
// There are 128 pins, 0-63 i'm using for the client to send info, and 64-127(8?) 
// are being used to take info from the browser, which gets info from the webserver.
var gpio = getP8Gpio();

// var gpio_divs = document.querySelectorAll('.gpio_values div'); // Was used to display value of pins on the web browser.

// Reads GPIO pins as they change, sends new GPIO values to webserver.
gpio.subscribe(function (newIndices) {
        // console.log("newIndices: " + newIndices)
        // console.log(gpio._data); Log BITS
        var typeLen = gpio._data[0]; // First byte is length of the string containg the type of packet.
        var type = ""
        for(var i=2; i <typeLen+2; i++){
            type += String.fromCharCode(gpio._data[i]);
        }
        
        // Only send new gpio pins if the users 'output' pins changed.
        // When we're reading input pins and resetting them to zero we cause
        // an infinite loop of reading each players pins and resetting to zero,
        // then this would cause a trigger to send a new packet to other players.
        var wroteNewPacket = false;
        for(var i = 0; i < newIndices.length; i++){
            var pin = newIndices[i]
            if (pin < 64){
                // console.log(pin + "<" + 64)
                wroteNewPacket = true;
                break;
            }
        }

        // TODO Stop processing information here, just send it to the server, let the server tell us what yo do.
        if (wroteNewPacket == true){
            // console.log("")
            processPacket(type, gpio._data);
        }

        // DEBUG FOR RECENT CHANGES TO GPIO PINS
        // for (var i = 0; i < 2; i++) {
        //     var div = gpio_divs[i];
        //     div.innerText = gpio[i];
            
        //     if (newIndices.indexOf(i) === -1) {
        //         div.classList.remove('new');
        //     } else {
        //         div.classList.add('new');
        //     }
        // }
    });

// Process Packets sent from users game cart.
function processPacket(type, bits){
    var start = type.length+2; // bit right after packet type.
    console.log("Incoming Packet: " + type + bits);
    switch(type){
        case "pupdate":
            var xcoord = bits[start] // x coord is written directly after the packet name.
            var ycoord = bits[start+1] // y coord right after the x coord.
            console.log("X: " + xcoord)
            console.log("Y: " + ycoord)
            
            // The game has notified us that the player has changes to their coordinates and we should tell the web server.
            $.ajax({
                url: "sync",
                type: "POST",
                data: JSON.stringify({
                    sync: [xcoord, ycoord],
                }),
                contentType: "application/json; charset=utf-8",
                dataType: "json",
                success: function (resp) {                    
                    if (username == null){
                        // Our first sync has happened, server tells you your name.                      
                        username = JSON.parse(JSON.stringify(resp));
                        console.log("Received New Username: " + username)
                        document.querySelector('#username').innerText = username; // Update HTML to display username on browser
                        packet = {}
                        packet.type = "username"
                        packet.username = username
                        write_packet(packet) // Send username update packet to pico8.
                    }
                }
            })

            break
    }
}

// Every 100ms check webserver for packets to read in.
setInterval(function () {
    // This is temporarily rendering active players every interval.
    // Removes all players from the players tag in the browser
    var player_divs = document.getElementById("players")
    while (player_divs.firstChild) {
        player_divs.removeChild(player_divs.firstChild);
    }

    // GET request to web server to get information regarding other players
    $.get("sync", function (data, status) {
        var players = JSON.parse(data)        
        for (var i = 0; i < players.length; i++) {
            var player = players[i];
            // Send only info to pico8 if user in pico8 has their own username, and don't send info about yourself.
            if (username != undefined && player.username != username) {
                // console.log("PUPDATE ME FOR: " + player.username)
                packet = {}
                packet.type = "pupdate"
                packet.username = player.username
                packet.x = player.x
                packet.y = player.y
                write_packet(packet) // Send PlayerUpdate packet to pico8.
            }
            // var div = document.createElement("div");
            // div.innerHTML = player.username;
            // player_divs.appendChild(div);                
        }
    });
}, 50);

var cur_pin_write = 64 // Used to track the current pin index we're writing to

// Writes packet to gpio pins to be interepreted by pico8
function write_packet(packet){
    // console.log(packet)
    // Reset current pin we're writing to.
    cur_pin_write = 64 // pins 64 and up are input for game client

    // This line moves directly to the next bit that would be after we write the packet name.
    // We do this because it's implemented in game to only read packets if pin 64 is written to, so we do this last.
    cur_pin_write += packet.type.length + 1
    // console.log("Writing Packet: " + packet.type)
    if (packet.type == "username"){ // Unique schema for username packet
        write_string(packet.username);
        gpio[cur_pin_write] = packet.x
        cur_pin_write+=1; // Move to next pin
        gpio[cur_pin_write] = packet.y    
    }else if(packet.type == "pupdate"){ // Unique schema for pupdate packet
        write_string(packet.username);
        gpio[cur_pin_write] = packet.x;
        cur_pin_write+=1 // Move to next pin
        gpio[cur_pin_write] = packet.y;        
    }else{ // try writing every variable in dictionary, doesn't support strings yet, so need to manually write those.
        for (key in packet){
            if (key != "type"){ // Don't write type, we do this manually.
                gpio[cur_pin_write] = packet[key];
                cur_pin_write+=1
            }
        }
    }
    cur_pin_write = 64 // Reset index to start of "output" pin.
    // console.log(gpio._data) 
    write_string(packet.type) // Set packet name and size of type name last, this triggers pico8 to read packet.
    // console.log(gpio._data)
}

 // Writes a string at the gpio pin based on the index cur_pin_write.
 // First it writes the size of the string, then it moves up the pins and places 1 the char code of each character in each pin.
 // Example: packet.type = pupdate; [7,p,u,p,d,a,t,e]; except the chars are char codes.
function write_string(s){
    // save starting point for us to write the size of the string last, in case it's the name of the packet,
    // which is always the first char, which fires pico8 to read
    var tempStart = cur_pin_write;
    // console.log("WRITING STRING START: " + tempStart)
    cur_pin_write += 1; // Move up 1 pin to start writing the strings characters, leaves room for size of string.
    for (var i = 0; i < s.length; i++){
        // console.log(gpio[cur_pin_write]);
        gpio[cur_pin_write]= s.charCodeAt(i); // writes char code of the character at index i of string, into the gpio cur_pin_write.
        // console.log(gpio._data)
        // console.log(cur_pin_write + " : " + s.charCodeAt(i));
        cur_pin_write+=1; // Move up 1 pin.
    }
    gpio[tempStart] = s.length; // Finish off the string by placing the size of the string in the beginning of the string.
}