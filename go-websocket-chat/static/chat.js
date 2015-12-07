var webusb = {};

(function() {
  'use strict';

  webusb.devices = {};

  webusb.getDevices = function() {
    return navigator.usb.getDevices().then(devices => {
      return devices.map(device => new webusb.Device(device));
    });
  };

  webusb.Device = function(device) {
    this.device_ = device;
    webusb.devices[device.guid] = this;
  };

  webusb.deleteDevice = function(device) {
    delete webusb.devices[device.device_.guid];
  };

  webusb.getDeviceFromGuid = function(guid) {
    return webusb.devices[guid];
  };

  webusb.Device.prototype.connect = function() {
    return this.device_.open()
      .then(() => this.device_.getConfiguration()
            .then(config => {
              if (config.configurationValue == 1) {
                return Promise.resolve();
              } else {
                return Promise.reject("Need to setConfiguration(1).");
              }
            })
            .catch(error => this.device_.setConfiguration(1)))
      .then(() => this.device_.claimInterface(0))
      .then(() => this.device_.controlTransferOut({
        'requestType': 'class',
        'recipient': 'interface',
        'request': 0x22,
        'value': 0x01,
        'index': 0x00}));
  };

  webusb.Device.prototype.disconnect = function() {
    return this.device_.controlTransferOut({
      'requestType': 'class',
      'recipient': 'interface',
      'request': 0x22,
      'value': 0x00,
      'index': 0x00})
      .then(() => this.device_.close());
  };

  webusb.Device.prototype.controlTransferOut = function(setup, data) {
    return this.device_.controlTransferOut(setup, data);
  };

  webusb.Device.prototype.controlTransferIn = function(setup, length) {
    return this.device_.controlTransferIn(setup, length);
  };

})();

function logDeviceStrings(device) {
  console.log("Connection:",
            device.device_.manufacturerName,
            device.device_.productName,
            device.device_.serialNumber);
}

function hexToRgb(hex) {
  var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

function setDeviceColor(device, r, g, b) {
  var rgb = new Uint8Array(3);
  rgb[0] = r;
  rgb[1] = g;
  rgb[2] = b;

  device.controlTransferOut({
    'requestType': 'vendor',
    'recipient': 'device',
    'request': 0x01,
    'value': 0x00,
    'index': 0x00}, rgb)
  .then(o => {
      device.element.getElementsByClassName(
        "lightPicker")[0].value = rgbToHex(r, g, b);
    }, e => {
      console.log(e); disconnectDevice(device.guid);
    });
}

function setAllDeviceColor(r, g, b) {
  for (var d in webusb.devices) {
    setDeviceColor(webusb.devices[d], r, g, b);
  }
}

var BRIGHTNESS = 64;
function connectDevice(device) {
  device.connect()
    .then(logDeviceStrings(device))
    .then(function() { console.log("connected", device) });
}

function handleConnectEvent(event) {
  var rawDevice = event.device;
  var guid = rawDevice.guid;
  console.log('connect event', rawDevice, guid);
  var device = new webusb.Device(rawDevice);
  connectDevice(device);
}

function cleanUpDevice(device) {
  webusb.deleteDevice(device);
}

function disconnectDevice(guid) {
  if (!guid in webusb.devices) {
    console.log(guid, "not known");
    return;
  }

  var device = webusb.getDeviceFromGuid(guid);
  if (device) {  // This can fail if the I/O code already threw an exception
    console.log("removing!");
    device.disconnect()
    .then(s => {
      console.log("disconnected", device);
      cleanUpDevice(device);
    }, e => {
      console.log("nothing to disconnect", device);
      cleanUpDevice(device);
    });
  }
}

function handleDisconnectEvent(event) {
  var rawDevice = event.device;
  var guid = rawDevice.guid;
  console.log('disconnect event', rawDevice, guid);
  disconnectDevice(guid);
}

function registerEventListeners() {
  navigator.usb.addEventListener('connect', handleConnectEvent);
  navigator.usb.addEventListener('disconnect', handleDisconnectEvent);
}

function startInitialConnections() {
  webusb.getDevices().then(devices => {
    console.log("Initial devices", devices);
    for (var i in devices) {
      var device = devices[i];
      connectDevice(device);
    }
  });
}

    $(function() {

    var conn;
    var msg = $("#msg");
    var log = $("#log");

    function appendLog(msg) {
        var d = log[0]
        var doScroll = d.scrollTop == d.scrollHeight - d.clientHeight;
        msg.appendTo(log)
        if (doScroll) {
            d.scrollTop = d.scrollHeight - d.clientHeight;
        }
    }

    $("#form").submit(function() {
        if (!conn) {
            return false;
        }
        if (!msg.val()) {
            return false;
        }
        conn.send(msg.val());
        msg.val("");
        return false
    });

    if (window["WebSocket"]) {
        conn = new WebSocket("wss://z.sowbug.com:8443/ws");
        conn.onclose = function(evt) {
            appendLog($("<div><b>Connection closed.</b></div>"))
        }
        conn.onmessage = function(evt) {
          var s = evt.data;
          console.log("saw", s, webusb.devices, webusb.devices.length);
          if (s.indexOf("red") != -1) {
            console.log("found red", webusb.devices);
            setAllDeviceColor(255, 0, 0);
          }
          if (s.indexOf("blue") != -1) {
            console.log("found blue", webusb.devices);
            setAllDeviceColor(0, 0, 255);
          }
          if (s.indexOf("off") != -1) {
            setAllDeviceColor(0, 0, 0);
          }
            appendLog($("<div/>").text(evt.data))
        }
        registerEventListeners();
        startInitialConnections();
    } else {
        appendLog($("<div><b>Your browser does not support WebSockets.</b></div>"))
    }
    });
