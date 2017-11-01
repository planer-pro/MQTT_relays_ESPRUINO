var wifi = require("Wifi");

var server = "server";
var options = {
    port: port,
    username: "user",
    password: "pass"
};

var mqtt = require("https://github.com/olliephillips/tinyMQTT/blob/master/tinyMQTT.min.js").create(server, options);

wifi.on('connected', function (details) {
    mqtt.connect();
});

var idLight;
var relayQuantity = 4;
var relaysState = {};

mqtt.on('connected', function () {
    for (var index = 0; index < relayQuantity; index++) {

        var id = E.hwRand();

        mqtt.subscribe("indoor/controls/id:" + id + "_relay" + index + "_getState");
        mqtt.subscribe("indoor/controls/id:" + id + "_relay" + index + "_setState");
        mqtt.subscribe("indoor/controls/id:" + id + "_relay" + index + "_setID");
        mqtt.subscribe("indoor/controls/id:" + id + "_relay_getList");
        mqtt.subscribe("indoor/controls/id:" + id + "_relay_getTime");

        relaysState["relay" + index] = {
            id: id,
            state: false
        }
    }

    idLight = setInterval(function () {
        digitalPulse(2, 0, [60, 60, 60]);//led indicator MQTT transmit
    }, 4000);
});

mqtt.on('message', function (pub) {
    for (var index = 0; index < relayQuantity; index++) {
        if (pub.topic == "indoor/controls/id:" + relaysState["relay" + index].id + "_relay" + index + "_getState" && pub.message == ("1" || "true")) {
            mqtt.publish("indoor/controls/id:" + relaysState["relay" + index].id + "_report_relay" + index, relaysState["relay" + index].state);
        }

        /*if (pub.topic == "indoor/controls/id:" + relaysState["relay" + index].id + "_relay" + index + "_setState" && pub.message == ("1" || "true")) {
            relaysState["relay" + index].state = true;
            mqtt.publish("indoor/controls/id:" + relaysState["relay" + index].id + "_report_relay" + index, relaysState["relay" + index].state);
        }

        if (pub.topic == "indoor/controls/id:" + relaysState["relay" + index].id + "_relay" + index + "_setState" && pub.message == ("0" || "false")) {
            relaysState["relay" + index].state = false;
            mqtt.publish("indoor/controls/id:" + relaysState["relay" + index].id + "_report_relay" + index, relaysState["relay" + index].state);
        }*/

        if (pub.topic == "indoor/controls/id:" + relaysState["relay" + index].id + "_relay" + index + "_setID") {
            var oldID1 = relaysState["relay" + index].id;
            relaysState["relay" + index].id = pub.message;
            mqtt.publish("indoor/controls/id:" + oldID1 + "_report_relay" + index, relaysState["relay" + index].id);
        }

        if (pub.topic == "indoor/controls/id:" + relaysState["relay" + index].id + "_relay" + index + "_setID" && pub.message == ("auto")) {
            var oldID2 = relaysState["relay" + index].id;
            relaysState["relay" + index].id = E.hwRand();
            mqtt.publish("indoor/controls/id:" + oldID2 + "_report_relay" + index, relaysState["relay" + index].id);
        }

        if (pub.topic == "indoor/controls/id:" + relaysState["relay" + index].id + "_relay_getList" && pub.message == ("1" || "true")) {
            mqtt.publish("indoor/controls/id:" + relaysState["relay" + index].id + "_report_listState", JSON.stringify(relaysState));
        }

        if (pub.topic == "indoor/controls/id:" + relaysState["relay" + index].id + "_relay_getTime" && pub.message == ("1" || "true")) {
            mqtt.publish("indoor/controls/id:" + relaysState["relay" + index].id + "_report_workTime", getTime());
        }
    }
});

mqtt.on('disconnected', function () {
    clearInterval(idLight);
    digitalWrite(2, 0);//led indicator MQTT disconnected
    mqtt.connect();
});