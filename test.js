/*var relayCount = 5;
var relaysState = {};

for (var index = 0; index < relayCount; index++) {
    console.log("outdoor/controls/relay" + index + "_setState");
}*/
/*var x = 4;
var y = 3;
var s = 2;
var z = x == y + s;*/
/*var relayQuantity = 40;
var relaysState = {};
var index = 2;
var id = 24;
var state = true;
var oldID = 1234;
for (var index = 0; index < relayQuantity; index++) {
    relaysState["relay" + index] = {
        id: id++,
        state: false
    };*/

//var array = [];

function setIdMac() {
    var array = "5c:cf:7f:da:56:25".split(':');
    var idMac = "" + array[4] + array[5];
    idMac = parseInt(idMac, 16);

    return idMac;
}

var id=0;

setInterval(function () {
    console.log(typeof (id));//65535
    console.log(++id);
}, 1000);