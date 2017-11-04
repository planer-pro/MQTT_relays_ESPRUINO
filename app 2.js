var wifi = require("Wifi");

var server = "m14.cloudmqtt.com";

var options = {
    port: 16610,
    username: "aawpwmsb",
    password: "6tz2i2jglC5N"
};

var mqtt = require("https://github.com/olliephillips/tinyMQTT/blob/master/tinyMQTT.min.js").create(server, options);

wifi.on('connected', function (details) {
    mqtt.connect();
});

var id;
var idLight;
var relayQuantity = 4;
var relaysState = {};

mqtt.on('connected', function () {
    for (var index = 0; index < relayQuantity; index++) {
        if (index === 0) id = setIdMac();
        else id += 1;
        subscrNew(id);
        relaysState["relay" + index] = {
            id: id,
            state: false
        };
    }
    viewAllInfo();

    idLight = setInterval(function () {
        digitalPulse(2, 0, [60, 60, 60]);//led indicator MQTT transmit
    }, 4000);
});

function setIdMac() {
    var array = wifi.getIP().mac.split(':');
    var idMac = "" + array[4] + array[5];
    idMac = parseInt(idMac, 16);
    return idMac;
}

function subscrNew(newId) {
    mqtt.subscribe("indoor/controls/" + newId + "_getState");
    mqtt.subscribe("indoor/controls/" + newId + "_setState");
    mqtt.subscribe("indoor/controls/" + newId + "_setID");
    mqtt.subscribe("indoor/controls/" + newId + "_getList");
    mqtt.subscribe("indoor/controls/" + newId + "_getTime");
}

function viewAllInfo() {
    for (var i = 0; i < relayQuantity; i++) {
        var list = "relay" + i + " id:" + relaysState["relay" + i].id + " state:" + relaysState["relay" + i].state;
        mqtt.publish("indoor/controls/" + relaysState["relay" + i].id + "," + "_report_listState", list);
    }
}

mqtt.on('message', function (pub) {
    for (var index = 0; index < relayQuantity; index++) {
        var topic = "indoor/controls/" + relaysState["relay" + index].id;
        var relayRes = topic + "_report_relay" + index;

        if (pub.topic == topic + "_getState") {
            mqtt.publish(relayRes, "" + relaysState["relay" + index].state);
        }

        if (pub.topic == topic + "_setState") {
            //var state = pub.message == "1" || "true";
            if (pub.message == "1" || pub.message == "true") relaysState["relay" + index].state = true;
            if (pub.message == "0" || pub.message == "false") relaysState["relay" + index].state = false;
            mqtt.publish(relayRes, "" + relaysState["relay" + index].state);
        }

        if (pub.topic == topic + "_setID") {
            var oldID = relaysState["relay" + index].id;
            if (pub.message == "auto") {
                relaysState["relay" + index].id = ++id;
            } else {
                var x = +pub.message;//try convert to number
                if (x >= 0 && x <= 65535) {
                    relaysState["relay" + index].id = x;//no Nan and in range? ok, next
                }
            }
            if (relaysState["relay" + index].id != oldID) subscrNew(relaysState["relay" + index].id);
            mqtt.publish("indoor/controls/" + oldID + "_report_relay" + index, "" + relaysState["relay" + index].id);
        }

        if (pub.topic == topic + "_getList") {
            viewAllInfo();
            break;//for single print list of more identional ID
        }

        if (pub.topic == topic + "_getTime") {
            mqtt.publish(topic + "_report_workTime", "" + getTime());
            break;//for single print time of more identional ID       
        }
    }
});

mqtt.on('disconnected', function () {
    clearInterval(idLight);
    digitalWrite(2, 0);//led indicator MQTT disconnected
    mqtt.connect();
});