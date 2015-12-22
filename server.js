// acronyms used
// tcaban - total chats abandoned
// tca - total chats answered
// tcu - total chats unanswered
// tac - total active chats
// cwait - no of chats waiting
// awt - average waiting time
// asa - average speed to answer
// act - average chat time
// amc - average message count
// taway - total number of agents away
// tavail - total number of agents available
// status - current status 0 - logged out, 1 - away, 2 - available
// cslots - chat slots
// tcs - time in current status
// achats - active chats


//********************************* Set up Express Server 
http = require('http');
var express = require('express'),
	app = express(),
	server = require('http').createServer(app),
	io = require('socket.io').listen(server);
	users = {};
var bodyParser = require('body-parser');
app.use( bodyParser.json() );       // to support JSON-encoded bodies
app.use(bodyParser.urlencoded({     // to support URL-encoded bodies
  extended: true
})); 

//********************************* Get port used by Heroku
var PORT = Number(process.env.PORT || 3000);
server.listen(PORT);

//********************************* Get BoldChat API Credentials stored in Heroku environmental variables
var AID = process.env.AID || 0;
var APISETTINGSID = process.env.APISETTINGSID || 0;
var KEY = process.env.KEY || 0;
var PAGEPATH = process.env.PAGEPATH || "/"; //  Obsecur page path such as /bthCn2HYe0qPlcfZkp1t
var ACCESSPASSWORD = process.env.ACCESSPASSWORD|| "02210"; // Single password for all
var VALIDACCESSNETWORKS = JSON.parse(process.env.VALIDACCESSNETWORKS) || {};  // JSON string with valid public ISP addresses { "83.83.95.62": "Mark Troyer (LMI) Home Office", "10.10.10.1": "LogMeIn UK Office", "10.10": "H3G internal Network"};
if (AID == 0 || APISETTINGSID == 0 || KEY == 0) {
	console.log("AID = "+AID+", APISETTINGSID = "+APISETTINGSID+", KEY = "+KEY);
	console.log("BoldChat API Environmental Variables not set in HEROKU App.  Please verify..");
	process.exit(1);
}

//********************************* Callbacks for all URL requests
app.get(PAGEPATH, function(req, res){
	var ip = req.headers['x-forwarded-for'] ? req.headers['x-forwarded-for'].split(',')[0] : req.connection.remoteAddress;
	if (VALIDACCESSNETWORKS[ip])	{  // TODO:  Add in Access Control via White List
		console.log("IP Addrees: "+ip+" was on the white list.");
	} else {
		console.log("IP Address: "+ip+" was NOT on the white list.");
	}
	res.sendFile(__dirname + '/index.html');
});

app.get('/index.css', function(req, res){ 
	res.sendFile(__dirname + '/index.css');
});
app.get('/index.js', function(req, res){
	res.sendFile(__dirname + '/index.js');
});
app.get('/favicon.ico', function(req, res){
	res.sendFile(__dirname + '/favicon.ico');
});

//********************************* Global variables for chat data
var	Departments = new Object();	// array of dept ids and dept name objects
var	DepartmentsByName = new Object();	// array of dept names and ids
var	Folders = new Object();	// array of folder ids and folder name objects
var	Operators = new Object();	// array of operator ids and name objects
var	OperatorsByName = new Object();	// array of operator ids and name objects
var	ChatWindows = new Object();	// array of window ids and name objects
var	ChatButtons = new Object();	// array of button ids and name objects
var	Websites = new Object();	// array of website ids and name objects
var	Invitations = new Object();	// array of invitation ids and name objects
var	Teams = new Object();	// array of team names
var ApiDataNotReady = 0;	// Flag to show when data has been received from API so that data can be processed
var Overall = new Object({tcaban: 0,
							Notstarted: 0,
							tca: 0,
							tcu: 0,
							tac: 0,
							cwait: 0,
							awt: 0,
							asa: 0,
							act: 0,
							amc: 0,
							oaway: 0,
							oavail: 0}
						);		// top level stats

// Get all of the incoming Boldchat triggered chat data
app.post('/chat-start-answer-close', function(req, res){
//	io.sockets.emit('errorResponse', req.body);
	console.log("Event: Chat Status Changed: ");
	debugLog(req.body);
});

// Get all of the incoming Boldchat triggered operator data
app.post('/operator-status-changed', function(req, res){
//	console.log("Event: Operator Status Changed: " +req.body);
	debugLog(req.body);
});

// Set up code for outbound BoldChat API calls.  All of the capture callback code should ideally be packaged as an object.
var fs = require('fs');
eval(fs.readFileSync('hmac-sha512.js')+'');
var https = require('https');

function BC_API_Request(api_method,params,callBackFunction) {
	var auth = AID + ':' + APISETTINGSID + ':' + (new Date()).getTime();
	var authHash = auth + ':' + CryptoJS.SHA512(auth + KEY).toString(CryptoJS.enc.Hex);
	var options = {
		host : 'api.boldchat.com', 
		port : 443, 
		path : '/aid/'+AID+'/data/rest/json/v1/'+api_method+'?auth='+authHash+'&'+params, 
		method : 'GET'
	};
	https.request(options, callBackFunction).end();
}

function debugLog(dataobj) {
	console.log("object");
	for(key in dataobj) {
		if(dataobj.hasOwnProperty(key))
			console.log(key +":"+dataobj[key]);
	}
}

function deptsCallback(dlist) {
	for(var i in dlist) 
	{
		DepartmentsByName[dlist[i].Name] = {name: dlist[i].DepartmentID};
		Departments[dlist[i].DepartmentID] = {name: dlist[i].Name, 
													tca: 0, 
													tcu: 0, 
													tac: 0,
													cwait: 0,
													await: 0,
													asa: 0,
													act: 0,
													amc: 0,
													oaway: 0,
													oavail: 0};
	}
	console.log("No of Depts: "+Object.keys(Departments).length);
}

function operatorsCallback(dlist) {
	for(var i in dlist) 
	{
		OperatorsByName[dlist[i].Name] = {name: dlist[i].LoginID};
		Operators[dlist[i].LoginID] = {name: dlist[i].Name,
											tca: 0,
											status: 0,
											tcs: 0,
											cslots: 0,
											active: new Array(),
											asa: 0,
											act: 0,
											amc: 0};																					
	}
	console.log("No of Operators: "+Object.keys(Operators).length);
}

function foldersCallback(dlist) {
	for(var i in dlist) 
	{
		if(dlist[i].FolderType == 5)		// select only chat folder types
		{
			Folders[dlist[i].FolderID] = dlist[i].Name;
//			console.log("folder id: "+dlist[i].FolderID + " name: "+dlist[i].Name);
		}
	}
	console.log("No of Chat Folders: "+Object.keys(Folders).length);
}

function getDepartmentNameFromID(id) {
	return(Departments[id].name);
}

function getFolderNameFromID(id) {
	return(Folders[id]);
}

function getOperatorNameFromID(id) {
	return(Operators[id].name);
}

// cleans text field of tags and newlines using regex
function cleanText(mytext) {
	var clean = mytext.replace(/<\/?[^>]+(>|$)/g, "");	// take out html tags
	var clean2 = clean.replace(/(\r\n|\n|\r)/g,"");	// take out new lines
	return(clean2);
}

// setup all globals TODO: add teams
function doStartOfDay() {
	getApiData('getDepartments', 0, deptsCallback);
	getApiData("getOperators", 0, operatorsCallback);
	getApiData("getFolders", 0, foldersCallback);
}

// process chat objects and update all relevat dept, operator and global metrics
function processInactiveChats(chats) {
	// analyse each chat and keep track of global metrics
	for(var i in chats)
	{
		if(chats[i].Started === null)		// started not set
			Overall.Notstarted++;

		if(chats[i].ChatStatusType == 1)		// abandoned chat (in prechat form )
		{
			Overall.tcaban++;	// abandoned
			continue;
		}
		//department stats
		if(chats[i].DepartmentID === null) continue;		// should never be null at this stage but I have seen it
		deptobj = Departments[chats[i].DepartmentID];
		if(chats[i].Answered === null)		// answered not set
		{
			Overall.tcu++;
			deptobj.tcu++;
			continue;
		}
		// chat answered
		Overall.tca++;
		deptobj.tca++;
		// asa and act and amc calculations
		var starttime = new Date(chats[i].Started);
		var anstime = new Date(chats[i].Answered);
		var endtime = new Date(chats[i].Ended);
		var messagecount = chats[i].OperatorMessageCount + chats[i].VisitorMessageCount
		var asa = (anstime - starttime)/1000;
		var act = (endtime - anstime)/1000;		// in seconds
		Overall.asa = Math.round(((Overall.asa * (Overall.tca - 1)) + asa)/Overall.tca);
		Overall.act = Math.round(((Overall.act * (Overall.tca - 1)) + act)/Overall.tca);
		Overall.amc = Math.round(((Overall.amc * (Overall.tca - 1)) + messagecount)/Overall.tca);
		deptobj.asa = Math.round(((deptobj.asa * (deptobj.tca - 1)) + asa)/deptobj.tca);
		deptobj.act = Math.round(((deptobj.act * (deptobj.tca - 1)) + act)/deptobj.tca);
		deptobj.amc = Math.round(((deptobj.amc * (deptobj.tca - 1)) + messagecount)/deptobj.tca);
		
		//operator stats
		if(chats[i].OperatorID === null) continue;		// operator id not set for some strange reason
		opobj = Operators[chats[i].OperatorID];
		opobj.tca++;	// chats answered
		opobj.asa = Math.round(((opobj.asa * (opobj.tca - 1)) + asa)/opobj.tca);
		opobj.act = Math.round(((opobj.act * (opobj.tca - 1)) + act)/opobj.tca);
		opobj.amc = Math.round(((opobj.amc * (opobj.tca - 1)) + messagecount)/opobj.tca);
	}
}

// process active chat objects and update all relevat dept, operator and global metrics
function processActiveChats(achats) {
	var deptobj, opobj;
	var atime, chattime;
	var timenow = new Date();
	var opact = [];
	Overall.tac = Overall.tac + achats.length;	// no of objects = number of active chats
	for(var i in achats) 
	{
		var atime = new Date(achats[i].Answered);
		var chattime = (timenow - atime )/1000;
		if(achats[i].DepartmentID === null) continue;	// not sure why this would ever be the case but it occurs
		deptobj = Departments[achats[i].DepartmentID];
		deptobj.tac++;	// chats active
		if(achats[i].OperatorID === null) continue;		// not sure why this would ever be the case but it occurs
		opobj = Operators[achats[i].OperatorID];
//		console.log("opobj is "+achats[i].OperatorID);
		opact = opobj.active;
		opact.push({chatid: achats[i].ChatID, 
							deptname: getDepartmentNameFromID(achats[i].DepartmentID),
							ctime: chattime,
							messages: achats[i].OperatorMessageCount + achats[i].VisitorMessageCount
							});
	}
}

function getEstimatedWait(estwait) {
	for(var i in estwait) // there should only be one set
	{
	}
}

function getOperatorAvailability(dlist) {
	// StatusType 0, 1 and 2 is Logged out, logged in as away, logged in as available respectively
	var operator;
	var timenow = new Date();
	for(var i in dlist)
	{
		operator = dlist[i].LoginID;
//		console.log("Operator: "+operator + " StatusType is "+dlist[i].StatusType);
		if(Operators[operator] !== 'undefined')		// check operator id is valid
		{
			Operators[operator].status = dlist[i].StatusType;
			Operators[operator].tcs = (timenow - new Date(dlist[i].Created))/1000;
			if(dlist[i].StatusType == 1)
			{
				Overall.oaway++;			
			}
			else if(dlist[i].StatusType == 2)
			{
				Overall.oavail++;
			}
		}
	}			
}

// this function calls API again if data is truncated
function loadNext(method, next, callback) {
	var str = [];
	for(var key in next) {
		if (next.hasOwnProperty(key)) {
			str.push(encodeURIComponent(key) + "=" + encodeURIComponent(next[key]));
		}
	}
	getApiData(method, str.join("&"), callback);
}

// calls extraction API and receives JSON objects 
function getApiData(method, params, fcallback) {
	ApiDataNotReady++;		// flag to track api calls
	BC_API_Request(method, params, function (response) {
		var str = '';
		//another chunk of data has been received, so append it to `str`
		response.on('data', function (chunk) {
			str += chunk;
		});
		//the whole response has been received, take final action.
		response.on('end', function () {
			ApiDataNotReady--;
			var jsonObj = JSON.parse(str);
//			console.log("Response received: "+str);
			var data = new Array();
			var next = jsonObj.Next;
			data = jsonObj.Data;
			if(data === 'undefined' || data == null)
			{
				console.log("No data returned: "+str);
				return;		// exit out if error json message received
			}
			fcallback(data);

			if(typeof next !== 'undefined') 
			{
				loadNext(method, next, fcallback);
			}
		});
		// in case there is a html error
		response.on('error', function(err) {
		// handle errors with the request itself
		console.error("Error with the request: ", err.message);
		ApiDataNotReady--;
		});
	});
}

// gets current active chats 
function getActiveChatData() {
	if(ApiDataNotReady)
	{
		console.log("Static data not ready");
		setTimeout(getActiveChatData, 1000);
		return;
	}
	
	for(var did in Departments)	// active chats are by department
	{
		parameters = "DepartmentID="+did;
		getApiData("getActiveChats",parameters,processActiveChats);
//			getApiData("getEstimatedWaitTime", parameters, getEstimatedWait);
//			getApiData("getDepartmentOperators", parameters, getDeptOperators);
	}
}

// gets today's chat data incase system was started during the day
function getInactiveChatData() {
	if(ApiDataNotReady)
	{
		console.log("Static data not ready");
		setTimeout(getInactiveChatData, 1000);
		return;
	}

	// set date to start of today
	var startDate = new Date();
	startDate.setHours(0,0,0,0);

	console.log("Getting inactive chat info from "+ Object.keys(Folders).length +" folders");
	var parameters;
	for(var fid in Folders)	// Inactive chats are by folders
	{
		parameters = "FolderID="+fid+"&FromDate="+startDate.toISOString();
		getApiData("getInactiveChats", parameters, processInactiveChats);
	}	
}

// Set up callbacks
io.sockets.on('connection', function(socket){

	//  Call BoldChat getDepartments method and update all users with returned data
	socket.on('startDashboard', function(data){
		
	});
});

function updateChatStats() {
	io.sockets.emit('chatcountResponse', "Total no. of chats: "+(Overall.tca + Overall.tcu + Overall.tcaban));
	io.sockets.emit('overallStats', Overall);
	io.sockets.emit('departmentStats', Departments);
	debugLog(Overall);
//	setTimeout(updateChatStats, 2000);	// send update every second
}

doStartOfDay();
setTimeout(getInactiveChatData, 2000);
setTimeout(getActiveChatData, 2000);
getApiData("getOperatorAvailability", "ServiceTypeID=1", getOperatorAvailability);
setTimeout(updateChatStats,5000);
