var wifi = require("Wifi");
var f = new (require("FlashEEPROM"))();

var server = "m14.cloudmqtt.com";

var options = {
    port: 16639,
    username: "bpltewxc",
    password: "SjJmTS2GCs_0"
};

var id;
var idLight;
var relaysState = {};

var accessWrite = true;
var accessRead = true;
var queueStore = [];
var queueRead = [];
var dataRead = [];

const relayQuantity = 4;
const devicePath = "indoor/controls/";

E.on('init', function () {
    for (var index = 0; index < relayQuantity + 2; index++) {
        readFromEeprom(index);//read all data eeprom
    }
});

var mqtt = require("https://github.com/olliephillips/tinyMQTT/blob/master/tinyMQTT.min.js").create(server, options);

wifi.on('connected', function (details) {
    mqtt.connect();
});

mqtt.on('connected', function () {
    if (dataRead[0] == "ok") {

        for (var index = 0; index < relayQuantity; index++) {//read all data from eeprom

            var allData = dataRead[index + 2];
            var arrayData = allData.split(':');

            subscrNew(arrayData[0]);

            var stateVar;
            if (arrayData[1] === "true") stateVar = true;
            else stateVar = false;

            if (!isNaN(+arrayData[0])) {
                relaysState["relay" + index] = {
                    id: +arrayData[0],
                    state: stateVar
                };
            } else {
                relaysState["relay" + index] = {
                    id: arrayData[0],
                    state: stateVar
                };
            }
        }
        id = +dataRead[1];//restore last ID (for auto generation on setID - auto)

    } else {
        for (var index2 = 0; index2 < relayQuantity; index2++) {//generate from mac, states = false by default

            if (index2 === 0) id = setIdMac();
            else id += 1;

            subscrNew(id);

            relaysState["relay" + index2] = {
                id: id,
                state: false
            };

            storeToEeprom(index2 + 2, "" + id + ":" + false);
        }
        storeToEeprom(0, "ok");//store eeprom flag
        storeToEeprom(1, "" + id);//store last ID (for auto generation on setID - auto)
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
    mqtt.subscribe(devicePath + newId + "_getState");
    mqtt.subscribe(devicePath + newId + "_setState");
    mqtt.subscribe(devicePath + newId + "_setID");
    mqtt.subscribe(devicePath + newId + "_getList");
    mqtt.subscribe(devicePath + newId + "_getTime");
}

function storeToEeprom(adr, item) {
    queueStore.push(adr);
    queueStore.push(item);

    if (accessWrite === true) {
        accessWrite = false;

        var Id = setInterval(function () {
            var a = queueStore.shift();
            var i = queueStore.shift();
            f.write(a, i);

            if (queueStore.length === 0) {
                clearInterval(Id);
                accessWrite = true;
            }
        }, 10);
    }
}

function readFromEeprom(adr) {
    queueRead.push(adr);

    if (accessRead === true) {
        accessRead = false;

        var Id = setInterval(function () {
            var a = queueRead.shift();
            try {
                dataRead[a] = E.toString(f.read(a));
            } catch (error) {
                clearInterval(Id);
                accessRead = true;
            }

            if (queueRead.length === 0) {
                clearInterval(Id);
                accessRead = true;
            }
        }, 10);
    }
}

function viewAllInfo() {
    for (var i = 0; i < relayQuantity; i++) {
        var list = "relay" + i + " id:" + relaysState["relay" + i].id + " state:" + relaysState["relay" + i].state;
        mqtt.publish(devicePath + relaysState["relay" + i].id + "," + "_report_listState", list);
    }
}

mqtt.on('message', function (pub) {
    for (var index = 0; index < relayQuantity; index++) {
        var topic = devicePath + relaysState["relay" + index].id;
        var relayRes = topic + "_report_relay" + index;

        if (pub.topic == topic + "_getState") {
            mqtt.publish(relayRes, "" + relaysState["relay" + index].state);
        }

        if (pub.topic == topic + "_setState") {
            if (pub.message == "1" || pub.message == "true") relaysState["relay" + index].state = true;
            if (pub.message == "0" || pub.message == "false") relaysState["relay" + index].state = false;
            storeToEeprom(index + 2, "" + relaysState["relay" + index].id + ":" + relaysState["relay" + index].state);
            mqtt.publish(relayRes, "" + relaysState["relay" + index].state);
        }

        if (pub.topic == topic + "_setID") {
            var oldID = relaysState["relay" + index].id;
            if (pub.message == "auto") {
                relaysState["relay" + index].id = ++id;
                storeToEeprom(1, "" + relaysState["relay" + index].id);//write last ID to special eeprom place
                storeToEeprom(index + 2, "" + relaysState["relay" + index].id + ":" + relaysState["relay" + index].state);//write auto ID to eeprom
            } else {
                if (!isNaN(+pub.message)) relaysState["relay" + index].id = +pub.message;//add number ID
                else relaysState["relay" + index].id = pub.message;//add any ID
                storeToEeprom(index + 2, "" + relaysState["relay" + index].id + ":" + relaysState["relay" + index].state);//write own ID to eeprom
            }
            if (relaysState["relay" + index].id != oldID) subscrNew(relaysState["relay" + index].id);//subscribe new ID
            mqtt.publish(devicePath + oldID + "_report_relay" + index, "" + relaysState["relay" + index].id);
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