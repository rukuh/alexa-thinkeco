var https = require('https'),
	alexaSkill = require('./AlexaSkill'),
	env = require('./env.js'),
	appID = process.env.appID,
	applianceIDs = process.env.applianceIDs,
	username = process.env.username,
	password = process.env.password;
	
function login() {
	var body = {
		data: JSON.stringify({
			Email: username,
			Password: password
		})
	};
	
	var options = {
		host: 'web.mymodlet.com',
		path: '/Account/Login',
		method: 'post',
		headers: { 'Content-Type':'application/json' }
	};
	
	return new Promise((resolve, reject) => {
		var req = https.request(options, res => {
			if (res.statusCode < 200 || res.statusCode >= 300) reject(new Error('login::statusCode=' + res.statusCode));
			res.on('data', () => resolve(res.headers['set-cookie']));
		});
		req.on('error', err => reject(err));
		req.write(JSON.stringify(body));
		req.end();
	});
};

function updateData(intent, cookies) {
	var options = {
		host: 'web.mymodlet.com',
		path: '/Devices/UpdateData',
		method: 'get',
		gzip: true,
		headers: { 'Content-Type': 'application/json', 'Cookie': cookies.join('; ') }
	};
	
	return new Promise((resolve, reject) => {
		var req = https.request(options, res => {
			var response = '';
			
			if (res.statusCode < 200 || res.statusCode >= 300) reject(new Error('updateData::statusCode=' + res.statusCode));
			res.on('data', body => response += body);
			res.on('end', () => {
				const parsedJSON = JSON.parse(JSON.parse(response));
				const modlet = parsedJSON.Devices.find(device => device.deviceId == applianceIDs[intent.slots.location.value]);
				const smartAC = parsedJSON.SmartACs.find(smartAC => smartAC.thermostat.associatedModletId == modlet.modletId);
				resolve(smartAC);
			});
		});
		req.on('error', err => reject(err));
		req.end();
	});
}

function switchDevice(intent, cookies) {
	var body = {
		data: JSON.stringify({
			id: applianceIDs[intent.slots.location.value]
		})
	 };

	var options = {
		host: 'web.mymodlet.com',
		path: `/Devices/Switch${sentenceCase(intent.slots.state.value)}`,
		method: 'post',
		gzip: true,
		headers: {
			'Content-Type': 'application/json',
			'Cookie': cookies.join('; ')
		}
	};
	
	return new Promise((resolve, reject) => {
		var req = https.request(options, res => {
			var response = '';
			
			if (res.statusCode < 200 || res.statusCode >= 300) reject(new Error('switchDevice::statusCode=' + res.statusCode));
			res.on('data', body => response += body);
			res.on('end', () => resolve(response));
		});
		req.on('error', err => reject(err));
		req.write(JSON.stringify(body));
		req.end();
	});
}

function userSettingsUpdate(intent, cookies) {
	var body = {
		data: JSON.stringify({
			'DeviceId': applianceIDs[intent.slots.location.value],
			'TargetTemperature': intent.slots.temperature.value,
			'IsThermostated': (intent.slots.state.value == 'on')
		})
	};

	var options = {
		host   : 'web.mymodlet.com',
		path   : '/Devices/UserSettingsUpdate',
		method : 'post',
		headers: { 'Content-Type': 'application/json', 'Cookie': cookies.join('; ') }
	};
	
	return new Promise((resolve, reject) => {
		var req = https.request(options, res => {
			var response = '';
			
			if (res.statusCode < 200 || res.statusCode >= 300) reject(new Error('userSettingsUpdate::statusCode=' + res.statusCode));
			res.on('data', body => response += body);
			res.on('end', () => resolve(response));
		});
		req.on('error', err => reject(err));
		req.write(JSON.stringify(body));
		req.end();
	});
}

var handleThermostatRequest = async (intent, session, response) => {
	console.log(JSON.stringify(intent));
	const cookies = await login();
	const data = await updateData(intent, cookies);
	await userSettingsUpdate(intent, cookies);
	if (data) {
		var text = data;
		var cardText = `The ${intent.slots.location.value} thermostat is set to: ${intent.slots.temperature.value}`;
	} else {
		var text = 'That value does not exist.'
		var cardText = text;
	}

	var heading = `${sentenceCase(intent.slots.location.value)} thermostat turned ${intent.slots.state.value}`;
	response.tellWithCard(`${sentenceCase(intent.slots.location.value)} thermostat set to ${intent.slots.temperature.value}`, heading, cardText);
}

var handleThermostateRequest = async (intent, session, response) => {
	console.log(JSON.stringify(intent));
	const cookies = await login();
	const data = await updateData(intent, cookies);
	await switchDevice(intent, cookies);
	if (data) {
		var text = data;
		var cardText = `The ${intent.slots.location.value} AC turned: ${data.modlet.isOn ? 'on' : 'off'}`;
	} else {
		var text = 'That value does not exist.'
		var cardText = text;
	}

	var heading = `${sentenceCase(intent.slots.location.value)} AC ${intent.slots.state.value}`;
	response.tellWithCard(`${sentenceCase(intent.slots.location.value)} AC turned ${data.modlet.isOn ? 'on' : 'off'}`, heading, cardText);
}

var ThinkEco = function () {
	alexaSkill.call(this, appID);
}

ThinkEco.prototype = Object.create(alexaSkill.prototype);
ThinkEco.prototype.constructor = ThinkEco;

ThinkEco.prototype.eventHandlers.onSessionStarted = (sessionStartedRequest, session) => {
	// What happens when the session starts? Optional
	console.log("onSessionStarted requestId: " + sessionStartedRequest.requestId
			+ ", sessionId: " + session.sessionId);
}

ThinkEco.prototype.eventHandlers.onLaunch = (launchRequest, session, response) => {
	// This is when they launch the skill but don't specify what they want. Prompt
	// them for their bus stop
	var output = 'Welcome to Think Eco. ' +
		'You can say things like set the living room thermostat to 77 or turn off the bedroom AC.';

	var reprompt = 'What thermostat would you like to change?';

	response.ask(output, reprompt);

	console.log("onLaunch requestId: " + launchRequest.requestId
			+ ", sessionId: " + session.sessionId);
}

ThinkEco.prototype.intentHandlers = {
	GetThermostatIntent: (intent, session, response) => {
		handleThermostatRequest(intent, session, response);
	},

	GetThermostateIntent: (intent, session, response) => {
		handleThermostateRequest(intent, session, response);
	},

	HelpIntent: (intent, session, response) => {
		var speechOutput = 'You can say things like set the living room thermostat to 77 or turn off the bed room AC.' +
			'What thermostat would you like to change?';
		response.ask(speechOutput);
	}
}

function sentenceCase(string) {
	return string[0].toUpperCase() + string.slice(1);
}

exports.handler = (event, context) => {
		var skill = new ThinkEco();
		skill.execute(event, context);
}
