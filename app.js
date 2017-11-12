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
var controlPath = "indoor/controls/";
var reportPath = "indoor/controls/";

E.on('init', function () {
    for (var index = 0; index < relayQuantity + 4; index++) {// +4-extend eeprom data
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

            var allData = dataRead[index + 4];
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
        controlPath = dataRead[2];//restore control path
        reportPath = dataRead[3];//restore report path

    } else {
        for (var index2 = 0; index2 < relayQuantity; index2++) {//generate from mac, states = false by default

            if (index2 === 0) id = setIdMac();
            else id += 1;

            subscrNew(id);

            relaysState["relay" + index2] = {
                id: id,
                state: false
            };

            storeToEeprom(index2 + 4, "" + id + ":" + false);
        }
        storeToEeprom(0, "ok");//store eeprom flag
        storeToEeprom(1, "" + id);//store last ID (for auto generation on setID - auto)
        storeToEeprom(2, controlPath);
        storeToEeprom(3, reportPath);
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
    mqtt.subscribe(controlPath + newId + "_setState");
    mqtt.subscribe(controlPath + newId + "_setID");
    mqtt.subscribe(controlPath + newId + "_setConPath");
    mqtt.subscribe(controlPath + newId + "_setRepPath");
    mqtt.subscribe(controlPath + newId + "_setRestart");
    mqtt.subscribe(controlPath + newId + "_setReset");
    mqtt.subscribe(controlPath + newId + "_getState");
    mqtt.subscribe(controlPath + newId + "_getList");
    mqtt.subscribe(controlPath + newId + "_getTime");
    mqtt.subscribe(controlPath + newId + "_getHelp");
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
        mqtt.publish(reportPath + relaysState["relay" + i].id + "," + "_report_listState", list);
    }
}

function viewHelp() {

    var hlp = "help_comm:";

    mqtt.publish(reportPath + hlp, "_setState (1,0,true,false)");
    mqtt.publish(reportPath + hlp, "_setID (auto,any text)");
    mqtt.publish(reportPath + hlp, "_setConPath (control path)");
    mqtt.publish(reportPath + hlp, "_setRepPath (report path)");
    mqtt.publish(reportPath + hlp, "_getState ()");
    mqtt.publish(reportPath + hlp, "_getList ()");
    mqtt.publish(reportPath + hlp, "_getTime ()");
    mqtt.publish(reportPath + hlp, "_setRestart ()");
    mqtt.publish(reportPath + hlp, "_setReset ()");
    mqtt.publish(reportPath + hlp, "_getHelp ()");
}

mqtt.on('message', function (pub) {
    for (var index = 0; index < relayQuantity; index++) {

        var topicContr = controlPath + relaysState["relay" + index].id;
        var topicReport = reportPath + relaysState["relay" + index].id;
        var relayRes = topicReport + "_report_relay" + index;

        if (pub.topic == topicContr + "_getState") {
            mqtt.publish(relayRes, "" + relaysState["relay" + index].state);
        }

        if (pub.topic == topicContr + "_setState") {
            if (pub.message == "1" || pub.message == "true") relaysState["relay" + index].state = true;
            if (pub.message == "0" || pub.message == "false") relaysState["relay" + index].state = false;
            storeToEeprom(index + 2, "" + relaysState["relay" + index].id + ":" + relaysState["relay" + index].state);
            mqtt.publish(relayRes, "" + relaysState["relay" + index].state);
        }

        if (pub.topic == topicContr + "_setID") {
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
            mqtt.publish(reportPath + oldID + "_report_relay" + index, "" + relaysState["relay" + index].id);
        }

        if (pub.topic == topicContr + "_setConPath") {
            controlPath = "" + pub.message;
            storeToEeprom(2, controlPath);
            mqtt.publish(topicReport, controlPath);
            break;//for single set path of more identional ID
        }

        if (pub.topic == topicContr + "_setRepPath") {
            reportPath = "" + pub.message;
            storeToEeprom(3, reportPath);
            mqtt.publish(topicReport, reportPath);
            break;//for single set path of more identional ID
        }

        if (pub.topic == topicContr + "_setRestart") {
            mqtt.publish(topicReport, "restarting");
            while (1) { }//initiate wachdog restart
        }

        if (pub.topic == topicContr + "_setReset") {
            mqtt.publish(topicReport, "reseting");
            f.erase();//clear all flash eeprom
            setTimeout(function () {//wait for clear
                while (1) { }//initiate wachdog restart
            }, 100);
            break;
        }

        if (pub.topic == topicContr + "_getHelp") {
            viewHelp();
            break;
        }

        if (pub.topic == topicContr + "_getList") {
            viewAllInfo();
            break;//for single print list of more identional ID
        }

        if (pub.topic == topicContr + "_getTime") {
            mqtt.publish(topicReport + "_report_workTime", "" + getTime());
            break;//for single print time of more identional ID
        }
    }
});

mqtt.on('disconnected', function () {
    clearInterval(idLight);
    digitalWrite(2, 0);//led indicator MQTT disconnected
    mqtt.connect();
});