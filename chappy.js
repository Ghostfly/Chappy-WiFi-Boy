/**
* Chappy - The WiFi protector
*
* Made for Livebox Play
*
*
*/
const request = require("request");
const ObservableArray = require('observable-array');
const includes = require('array-includes');
const nodemailer = require('nodemailer');
const sleep = require('sleep');
const config = require('./chappy-config');

let sended = [];
let cookieJar = request.jar();

global.hosts = ObservableArray();

global.hosts.on('change', function(event){
  let detected;

  switch(event.type){
    case 'splice':
      detected = event.removed;
      break;
    case 'push':
      detected = event.values[0];
      break;
    default:
      return;
  }

  if(includes(config.whiteList, detected)){
    console.log(detected, "is connected, but authorized 🙌");
    return;
  }

  if(!includes(config.whiteList,detected)) {
    loginOnLivebox(function(error, response){
      if(event.type == "push"){
        let token = JSON.parse(response).data.contextID;
        console.log("Sending email.. Who is " + detected + "?");
        sendMail("An unknown device named " + detected + " has been detected on your network<br><br>WiFi has been turned off to avoid any problem.", token);
        console.log("Sleeping for.. 10s");

        sleep.sleep(10);

        // TODO : .. mibs parameter missing

        //console.log("Changing password");
        //changeWiFiPass("3E739FE32F4ECD24AAA7E3AC24", token);

        console.log("Turning off cause : "+ event.type + " " + detected);
        turnWiFi(false, token);
      }
    });
  }
});


// Step 1 : Login on livebox
loginOnLivebox(function(error, response){
  console.log('ChappY is now watching your network 🕵');
  // Step 2 : Watching
  setInterval(function(){
    watchHosts();
  }, 1500);
});


function sendMail(message, token){
  let transporter = nodemailer.createTransport({
        host: config.smtpHost,
        port: config.smtpPort,
        secure: config.smtpSecure, // true for 465, false for other ports
        auth: {
            user: config.smtpUser, // generated ethereal user
            pass: config.smtpPassword  // generated ethereal password
        }
    });

    // setup email data with unicode symbols
    let mailOptions = {
        from: '"ChappY 👻" <chappy@uplg.xyz>',
        to: config.email,
        subject: 'Your network has been owned ! 😏',
        html: message + "<p>Happy to protect your network</p><h6>ChappY</h6>"
    };

    // send mail with defined transport object
    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            throw error;
        }
    });
}

/**
* @function watchHosts
*
*
*/
function watchHosts() {
  // Preparing the request
  const options = { method: 'POST',
    url: 'http://192.168.1.1/sysbus/Devices:get',
    headers:{ 'Content-Type': 'application/json' } };

    request(options, function (error, response, body) {
      if (error) throw new Error(error);
      let hosts = JSON.parse(body).result.status;

      hosts = hosts.filter(function(elem){
        if(elem.Active == true && (elem.Layer2Interface == "wl0" || elem.Layer2Interface == "wl1") && !includes(global.hosts, elem.Name)){
          global.hosts.push(elem.Name);
          return elem;
        } else if(elem.Active == false && includes(global.hosts, elem.Name)){
          global.hosts.splice(global.hosts.indexOf(elem.Name), 1)
        }
      });
  });
}

/**
* @function loginOnLivebox
*
* @param callback : containing authToken needed for some actions
*
*/
function loginOnLivebox(callback){
  const options = {
                  method: 'POST',
                  url: 'http://192.168.1.1/authenticate',
                  jar: cookieJar,
                  qs: { username: config.username, password: config.password },
                  headers:
                   { 'content-type': 'application/json' }
                };

  request(options, function (error, response, body) {
    if (error) {
      console.log("Chappy can't connect, sorry :/");
      process.exit();
    }
    callback(null, body);
  });

}

/**
* @function turnOffWiFi
*
* @param offOrNot : true | false
* @param token : given by loginOnLivebox
* @param callback : containing return from livebox
*
*/
function turnWiFi(onOrNot, token){
  const options = {
                  method: 'POST',
                  jar: cookieJar,
                  url: 'http://192.168.1.1/sysbus/NMC/Wifi:set',
                  headers:
                   { 'X-Context': token,
                     'Cache-Control': 'no-cache',
                     'Content-Type': 'application/json' },
                  qs:{
                   "Enable": onOrNot, "Status": onOrNot  },
                  json: true
                };

  request(options, function (error, response, body) {
    if (error) throw new Error(error);

    let message = (onOrNot) ? "on" : "off";

    console.log("Wifi " + message, response.body.result.status == true);
  });
}

  /**
  * ToBeFixed
  * @function changeWiFiPass
  *
  * @param newPass : "blurp"
  * @param token : given by loginOnLivebox
  *
  */
  function changeWiFiPass(newPass, token){
    const options = {
                    method: 'POST',
                    jar: cookieJar,
                    url: 'http://192.168.1.1/sysbus/NeMo/Intf/wl0:setWLANConfig',
                    headers:
                     { 'X-Context': token,
                       'Cache-Control': 'no-cache',
                       'Content-Type': 'application/x-sah-ws-1-call+json;'},
                    qs:{"service":"NeMo.Intf.wl0","method":"setWLANConfig","parameters":{
                      "mibs":{
                        "wlanvap":{
                          "wl0":{
                            "Security":{
                              "KeyPassPhrase":newPass,
                              "WEPKey":newPass
                            }
                          },
                          "wl1":{
                            "Security":{
                              "KeyPassPhrase":newPass,
                              "WEPKey":newPass
                            }
                          }
                        }
                      }
                    }},
                    json: true
                  };

    request(options, function (error, response, body) {
      if (error) throw new Error(error);

      console.log("Wifi password " + JSON.stringify(body));
    });
  }
