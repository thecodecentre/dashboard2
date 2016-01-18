// acronyms used
// conc - concurrency
// cph - chats per hour
// ciq - chats in queue
// lwt - longest waiting time
// tco - chats offered (chats active, answered and unabandoned)
// tac - total active chats (answered)
// tcan - total chats answered complete (closed)
// tcuq - total chats unanswered/abandoned in queue
// tcua - total chats unanswered/abandoned after assigned
// tcun - total chats unavailable
// asa - average speed to answer
// act - average chat time
// acc - available chat capacity
// aaway - total number of agents away
// aavail - total number of agents available
// status - current status 0 - logged out, 1 - away, 2 - available
// tcs - time in current status


//********************************* Set up Express Server 
http = require('http');
var express = require('express'),
	app = express(),
	server = require('http').createServer(app),
	io = require('socket.io').listen(server);
var bodyParser = require('body-parser');
//var cookieParser = require('cookie-parser');
//var session = require("express-session");
//app.use(cookieParser());
//app.use(session({resave: true, saveUninitialized: true, secret: 'LMIDashboardCodebyMMK', cookie: { maxAge: 600000 }}));
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
var GMAILS = process.env.GMAILS; // list of valid emails
var GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
var VALIDACCESSNETWORKS = JSON.parse(process.env.VALIDACCESSNETWORKS) || {};  // JSON string with valid public ISP addresses { "83.83.95.62": "Mark Troyer (LMI) Home Office", "10.10.10.1": "LogMeIn UK Office", "10.10": "H3G internal Network"};
if (AID == 0 || APISETTINGSID == 0 || KEY == 0) {
	console.log("AID = "+AID+", APISETTINGSID = "+APISETTINGSID+", KEY = "+KEY);
	console.log("BoldChat API Environmental Variables not set in HEROKU App.  Please verify..");
	process.exit(1);
}

//********************************* Callbacks for all URL requests
app.get(PAGEPATH, function(req, res){
	var ip = req.headers['x-forwarded-for'] ? req.headers['x-forwarded-for'].split(',')[0] : req.connection.remoteAddress;
	if (VALIDACCESSNETWORKS[ip])  // TODO:  Add in Access Control via White List
	{
		console.log("IP Addrees: "+ip+" was on the white list.");
	}
	else 
	{
		console.log("IP Address: "+ip+" was NOT on the white list.");
	}
	
	debugLog("Cookies",req.cookies);
	debugLog("Session",req.session);
	res.sendFile(__dirname + '/dashboard.html');
});

app.get('/agents.html', function(req, res){
	res.sendFile(__dirname + '/agents.html');
});
app.get('/index.css', function(req, res){ 
	res.sendFile(__dirname + '/index.css');
});
app.get('/dashboard.js', function(req, res){
	res.sendFile(__dirname + '/dashboard.js');
});
app.get('/favicon.ico', function(req, res){
	res.sendFile(__dirname + '/favicon.ico');
});
app.get('/threelogo.png', function(req, res){
	res.sendFile(__dirname + '/threelogo.png');
});

//********************************* Global class for chat data
var ChatData = function(chatid, dept, start) {
		this.chatID = chatid;
		this.department = dept;
		this.started = start;		// times ISO times must be converted to epoch (milliseconds since 1 Jan 1970)
		this.answered = 0;			// so it is easy to do the calculations
		this.ended = 0;
		this.closed = 0;
		this.operator = 0;	
		this.status = 0;	// 0 is closed, 1 is waiting (started), 2 is active (answered)
};

//******************* Global class for dashboard metrics
var DashMetrics = function(name) {
		this.name = name;
		this.conc = 0;
		this.sla = 0;
		this.cph = 0;
		this.ciq = 0;
		this.lwt = 0;
		this.tco = 0;
		this.tac = 0;
		this.tcan = 0;
		this.tcuq = 0;
		this.tcua = 0;
		this.tcun = 0;
		this.tcaban = 0;
		this.asa = 0;
		this.act = 0;
		this.acc = 0;
		this.oaway = 0;
		this.oavail = 0;	
};

//**************** Global class for operator metrics
var OpMetrics  = function(name) {
		this.name = name;
		this.conc = 0;		// concurrency
		this.tcan = 0;		// total chats answered
		this.status = 0;	// 0 - logged out, 1 - away, 2 - available
		this.activeChats = new Array();
		this.tcs = 0;	// time in current status	
};																				

//********************************* Global variables for chat data
var LoggedInUsers;
var AllChats;
var	Departments;	// array of dept ids and dept name objects
var	DepartmentsByName;	// array of dept names and ids
var	DeptOperators;	// array of operators by dept id
var	Folders;	// array of folder ids and folder name objects
var	Operators;	// array of operator ids and name objects
var	OperatorsByName;	// array of operator ids and name objects
var	WaitingTimes;	// array of chat waiting times objects
var	Teams;	// array of team names
var ApiDataNotReady;	// Flag to show when data has been received from API so that data can be processed
var TimeNow;			// global for current time
var EndOfDay;			// global time for end of the day before all stats are reset
var Overall;		// top level stats

function sleep(milliseconds) {
  var start = new Date().getTime();
  for(var i = 0; i < 1e7; i++) {
    if ((new Date().getTime() - start) > milliseconds){
      break;
    }
  }
}

function initialiseGlobals () {
	LoggedInUsers = new Array();
	AllChats = new Object();
	Departments = new Object();	
	DepartmentsByName = new Object();
	DeptOperators = new Object();
	Folders = new Object();	
	Operators = new Object();
	OperatorsByName = new Object();	
	WaitingTimes = new Object();
	Teams = new Object();
	ApiDataNotReady = 0;
	TimeNow = new Date();
	EndOfDay = TimeNow;
	EndOfDay.setHours(23,59,59,0);	// last second of the day
	Overall = new DashMetrics("Overall");	
}
// Process incoming Boldchat triggered chat data
app.post('/chat-started', function(req, res){
//	debugLog("Chat-started",req.body);
	if(ApiDataNotReady == 0)		//make sure all static data has been obtained first
		processStartedChat(req.body);
	res.send({ "result": "success" });
});

// Process incoming Boldchat triggered chat data
app.post('/chat-unavailable', function(req, res){
//	debugLog("Chat-unavailable",req.body);
//	if(ApiDataNotReady == 0)		//make sure all static data has been obtained first
//		processUnavailableChat(req.body);
	res.send({ "result": "success" });
});

// Process incoming Boldchat triggered chat data
app.post('/chat-answered', function(req, res){
//	debugLog("Chat-answered",req.body);
	if(ApiDataNotReady == 0)		//make sure all static data has been obtained first
		processAnsweredChat(req.body);
	res.send({ "result": "success" });
});

// Process incoming Boldchat triggered chat data
app.post('/chat-closed', function(req, res){
//	debugLog("Chat-closed", req.body);
	if(ApiDataNotReady == 0)		//make sure all static data has been obtained first
		processClosedChat(req.body);
	res.send({ "result": "success" });
});

// Process incoming Boldchat triggered operator data
app.get('/operator-status-changed', function(req, res){ 
	debugLog("operator-status-changed",req.body);
	res.send({ "result": "success" });
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

function Google_Oauth_Request(token,callBackFunction) {
	var options = {
		host : 'www.googleapis.com', 
		port : 443, 
		path : '/oauth2/v3/tokeninfo?id_token='+token, 
		method : 'GET'
	};
	https.request(options, callBackFunction).end();
}

function debugLog(name, dataobj) {
	console.log(name+": ");
	for(key in dataobj) {
		if(dataobj.hasOwnProperty(key))
			console.log(key +":"+dataobj[key]);
	}
}

function deptsCallback(dlist) {
	var dname;
	for(var i in dlist) 
	{
		dname = dlist[i].Name;
		if(dname.indexOf("PROD") == -1)	return;		// if this is not a PROD dept
		DepartmentsByName[dname] = {name: dlist[i].DepartmentID};
		Departments[dlist[i].DepartmentID] = new DashMetrics(dname);
	}
	console.log("No of PROD Depts: "+Object.keys(Departments).length);
	for(var did in Departments)
	{
		parameters = "DepartmentID="+did;
		getApiData("getDepartmentOperators",parameters,deptOperatorsCallback,did);	// extra func param due to API
	}
}

function operatorsCallback(dlist) {
	for(var i in dlist) 
	{
		OperatorsByName[dlist[i].Name] = {name: dlist[i].LoginID};
		Operators[dlist[i].LoginID] = new OpMetrics(dlist[i].Name);																			
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

function deptOperatorsCallback(dlist, dept) {
	var operators = new Array();
	for(var i in dlist) 
	{
		operators.push(dlist[i].OperatorID);
	}
	
	DeptOperators[dept] = operators;
	console.log("Operators in dept: "+dept+" - "+DeptOperators[dept].length);
}

function operatorAvailabilityCallback(dlist) {
	// StatusType 0, 1 and 2 is Logged out, logged in as away, logged in as available respectively
	var operator;
	for(var i in dlist)
	{
		operator = dlist[i].LoginID;
//		console.log("Operator: "+operator + " StatusType is "+dlist[i].StatusType);
		if(Operators[operator] !== 'undefined')		// check operator id is valid
		{
			Operators[operator].status = dlist[i].StatusType;
			Operators[operator].tcs = Math.round((TimeNow - new Date(dlist[i].Created))/1000);
			for(var j in Departments)	// department stats
			{
				console.log("Dept: "+j+" operators: "+ DeptOperators[j].operators.length);
				for(var k in DeptOperators[j])
				{			
					if(k == operator)
					{
						if(dlist[i].StatusType == 1)
							Departments[j].oaway++;	
						else if(dlist[i].StatusType == 2)
							Departments[j].oavail++;
					}
				}
			}
			// overall stats
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

function getDepartmentNameFromID(id) {
	return(Departments[id].name);
}

function getOperatorNameFromID(id) {
	return(Operators[id].name);
}

// department operators
function getDeptOperators(dept) {
	var operators = new Array();
	var operators = DeptOperators[dept];
//	if(typeof(operators) === 'undefined') return;
	return operators;
}

// setup all globals TODO: add teams
function doStartOfDay() {
	initialiseGlobals();	// zero all memory
	getApiData("getDepartments", 0, deptsCallback);
	sleep(1000);
	getApiData("getOperators", 0, operatorsCallback);
	sleep(1000);
	getApiData("getFolders", 0, foldersCallback);
	sleep(1000);
//	getOperatorAvailabilityData();
//	sleep(1000);
//	getInactiveChatData();
//	sleep(1000);
//	getActiveChatData();
}

// process started chat object and update all relevat dept, operator and global metrics
function processStartedChat(chat) {
	if(chat.DepartmentID == null || chat.DepartmentID == "") return;// should never be null at this stage but I have seen it
	deptobj = Departments[chat.DepartmentID];
	if(typeof(deptobj) === 'undefined') return;		// a dept we are not interested in

	var starttime = new Date(chat.Started);
	var tchat = new ChatData(chat.ChatID, chat.DepartmentID, starttime);
	tchat.status = 1;	// waiting to be answered
	AllChats[chat.ChatID] = tchat;		// save this chat details
}

// process unavailable chat object. Occurs when visitor gets the unavailable message as ACD queue is full or nobody available
function processUnavailableChat(chat) {
	if(chat.DepartmentID === null) return;	
	deptobj = Departments[chat.DepartmentID];
	if(typeof(deptobj) === 'undefined') return;		// a dept we are not interested in
	// make sure that this is genuine and sometime this event is triggered for an old closed chat
	if(chat.Started == "" && chat.Answered == "")
	{
		deptobj.tcun++;
		Overall.tcun++;
	}
}

// active chat means a started chat has been answered by an operator so it is no longer in the queue
function processAnsweredChat(chat) {
	var deptobj, opobj, tchat;
	var anstime=0, starttime=0;
	
	if(chat.DepartmentID == null || chat.DepartmentID == "") return;	// should never be null at this stage but I have seen it
	if(chat.OperatorID == null || chat.OperatorID == "") return;		// operator id not set for some strange reason

	deptobj = Departments[chat.DepartmentID];
	if(typeof(deptobj) === 'undefined') return;		// a non PROD dept we are not interested in
	opobj = Operators[chat.OperatorID];
	
	if(chat.Started != null && chat.Started != "")
		starttime = new Date(chat.Started);

	if(chat.Answered != null && chat.Answered != "")
		anstime = new Date(chat.Answered);

	tchat = AllChats[chat.ChatID];
	if(typeof(tchat) === 'undefined')	// if this chat did not exist (only true if processing at startup not triggers)
		tchat = new ChatData(chat.ChatID, chat.DepartmentID, starttime);

	tchat.answered = anstime;
	tchat.operator = chat.OperatorID;
	tchat.status = 2;		// active chat
	AllChats[chat.ChatID] = tchat;		// save this chat info
	
//		console.log("opobj is "+chat.OperatorID);
	opobj.activeChats.push({chatid: chat.ChatID, 
						deptname: deptobj.name,
						messages: chat.OperatorMessageCount + chat.VisitorMessageCount
						});
}

// process all active chat objects 
function allActiveChats(achats) {
	for(var i in achats) 
	{
		processAnsweredChat(achats[i]);
	}
}

// process closed chat object. closed chat may not be started or answered if it was abandoned or unavailable
function processClosedChat(chat) {
	var deptobj,opobj,tchat;
	var starttime=0,anstime=0,endtime=0,closetime=0,opid=0;

	if(chat.DepartmentID === null)		// should never be null at this stage but I have seen it
	{									// perhaps it is an abandoned chat
//		debugLog("Closed Chat, Dept null", chat);
		return;
	}
	deptobj = Departments[chat.DepartmentID];
	if(typeof(deptobj) === 'undefined') return;		// a non PROD dept we are not interested in

	if(chat.ChatStatusType >= 7 && chat.ChatStatusType <= 15)		// unavailable chat
	{
		Overall.tcun++;
		deptobj.tcun++;
		return;
	}

	if(chat.Started != null && chat.Started != "")
		starttime = new Date(chat.Started);

	if(chat.Answered != null && chat.Answered != "")
		anstime = new Date(chat.Answered);

	if(chat.Ended != null && chat.Ended != "")
		endtime = new Date(chat.Ended);

	if(chat.Closed != null && chat.Closed != "")
		closetime = new Date(chat.Closed);

	if(chat.OperatorID != null && chat.OperatorID != "")
		opid = chat.OperatorID;

//	var messagecount = chat.OperatorMessageCount + chat.VisitorMessageCount
	tchat = AllChats[chat.ChatID];
	if(typeof(tchat) === 'undefined')		// if this chat did not exist 
		tchat = new ChatData(chat.ChatID, chat.DepartmentID, starttime);

	tchat.status = 0;		// inactive/complete/cancelled/closed
	if(anstime == 0)		// chat unanswered
	{
		if(opid == 0)	// operator unassigned
		{
			Overall.tcuq++;
			deptobj.tcuq++;
		}
		else
		{
			Overall.tcua++;
			deptobj.tcua++;			
		}
		return;	// all done 
	}

	tchat.answered = anstime;
	tchat.ended = endtime;
	tchat.closed = closetime;
	tchat.operator = opid;
	AllChats[chat.ChatID] = tchat;	// update chat
	Overall.tcan++;
	deptobj.tcan++;
	
	if(opid == 0) return;		// operator id not set if chat abandoned before answering
	opobj = Operators[opid];		// if answered there will always be a operator assigned
	if(typeof(opobj) === 'undefined') 	
	{									// in case there isnt
		debugLog("****Error Operator is null",chat);
		return;
	}

	opobj.tcan++;	// chats answered and complete
}

// process all inactive (closed) chat objects
function allInactiveChats(chats) {
	for(var i in chats)
	{
		processClosedChat(chats[i]);
	}
}

// calculate ACT and Chat per hour - both are done after chats are complete (ended)
function calculateACT_CPH() {
	var tchat,count=0,chattime=0,cph=0;
	var dchattime = new Object();
	var dcount = new Object();
	var dcph = new Object();
	var pastHour = TimeNow - (60*60*1000);	// Epoch time for past hour

	for(var i in Departments)
	{
		Departments[i].act = 0;
		Departments[i].sla = 0;
		dcount[i] = 0;
		dchattime[i] = 0;
		dcph[i] = 0;
	}
	
	for(var i in AllChats)
	{
		tchat = AllChats[i];
		if(tchat.status == 0 && tchat.ended != 0 && tchat.answered != 0)		// chat ended
		{
			count++;
			dcount[tchat.department] = dcount[tchat.department] + 1;
			ctime = tchat.ended - tchat.answered;
			chattime = chattime + ctime;
			dchattime[tchat.department] = dchattime[tchat.department] + ctime;	
			if(tchat.ended >= pastHour)
			{
				cph++;
				dcph[tchat.department]++;
			}
		}
	}
	
	Overall.cph = cph;
	if(count != 0)	// dont divide by 0
		Overall.act = Math.round((chattime / count)/1000);
	for(var i in dcount)
	{
		if(dcount[i] != 0)	// musnt divide by 0
			Departments[i].act = Math.round((dchattime[i] / dcount[i])/1000);
			
		Departments[i].cph = dcph[i];
	}
}

function calculateASA() {
	var tchat, count = 0, tac = 0, anstime = 0;
	var danstime = new Object();
	var dcount = new Object();
	var dtac = new Object();

	for(var i in Departments)
	{
		Departments[i].asa = 0;
		Departments[i].tac = 0;
		Departments[i].sla = 0;
		dcount[i] = 0;
		danstime[i] = 0;
		dtac[i] = 0;
	}
	
	for(var i in AllChats)
	{
		tchat = AllChats[i];
		if((tchat.status == 2 || tchat.status == 0) && tchat.answered != 0 && tchat.started != 0)
		{
			count++;
			dcount[tchat.department] = dcount[tchat.department] + 1;
			speed = tchat.answered - tchat.started;
			anstime = anstime + speed;
			danstime[tchat.department] = danstime[tchat.department] + speed;
			if(tchat.status == 2)	// active chat
			{
				tac++;
				dtac[tchat.department] = dtac[tchat.department] +1;
			}
		}
	}
	if(count != 0)	// dont divide by 0
		Overall.asa = Math.round((anstime / count)/1000);
	Overall.tac = tac;
	for(var i in dcount)
	{
		if(dcount[i] != 0)	// musnt divide by 0
			Departments[i].asa = Math.round((danstime[i] / dcount[i])/1000);
		Departments[i].tac = dtac[i];
	}
}

function calculateLWT_CIQ() {
	var tchat, waittime, tciq = 0;
	var maxwait = 0;
	
	// first zero out the lwt for all dept
	for(var i in Departments)
	{
		Departments[i].lwt = 0;
		Departments[i].ciq = 0;
	}
	
	// now recalculate the lwt by dept and save the overall
	for(var i in AllChats)
	{
		tchat = AllChats[i];
		if(tchat.status == 1 && tchat.answered == 0 && tchat.started != 0 && tchat.ended == 0)		// chat not answered yet
		{
			tciq++;
			Departments[tchat.department].ciq++;
			waittime = Math.round((TimeNow - tchat.started)/1000);
			if(Departments[tchat.department].lwt < waittime)
				Departments[tchat.department].lwt = waittime;
			
			if(maxwait < waittime)
				maxwait = waittime;
		}
	}
	Overall.lwt = maxwait;
	Overall.ciq = tciq;
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
function getApiData(method, params, fcallback, cbparam) {
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
//			if(cbparam == null)
//				fcallback(data);
//			else
				fcallback(data, cbparam);

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

// gets operator availability info 
function getOperatorAvailabilityData() {
	if(ApiDataNotReady)
	{
		console.log("Static data not ready (OA): "+ApiDataNotReady);
		setTimeout(getOperatorAvailabilityData, 1000);
		return;
	}
	
	getApiData("getOperatorAvailability", "ServiceTypeID=1", operatorAvailabilityCallback);
}

// gets current active chats 
function getActiveChatData() {
	if(ApiDataNotReady)
	{
		console.log("Static data not ready (AC): "+ApiDataNotReady);
		setTimeout(getActiveChatData, 1000);
		return;
	}
	
	for(var did in Departments)	// active chats are by department
	{
		parameters = "DepartmentID="+did;
		getApiData("getActiveChats",parameters,allActiveChats);
	}
}

// gets today's chat data incase system was started during the day
function getInactiveChatData() {
	if(ApiDataNotReady)
	{
		console.log("Static data not ready (IC): "+ApiDataNotReady);
		setTimeout(getInactiveChatData, 1000);
		return;
	}

	// set date to start of today. Search seems to work by looking at closed time i.e. everything that closed after
	// "FromDate" will be included even if the created datetime is before the FromDate.
//	var startDate = new Date();
	var startDate = TimeNow;
	startDate.setHours(0,0,0,0);

	console.log("Getting inactive chat info from "+ Object.keys(Folders).length +" folders");
	var parameters;
	for(var fid in Folders)	// Inactive chats are by folders
	{
		parameters = "FolderID="+fid+"&FromDate="+startDate.toISOString();
		getApiData("getInactiveChats", parameters, allInactiveChats);
	}	
}

// Set up callbacks
io.sockets.on('connection', function(socket){
	
	socket.on('authenticate', function(data){
		console.log("authentication request received for: "+data.email);
		if(GMAILS[data.email] === 'undefined')
		{
			console.log("This gmail is invalid: "+data.email);
			socket.emit('errorResponse',"Invalid email");
		}
		else
		{
			Google_Oauth_Request(data.token, function (response) {
			var str = '';
			//another chunk of data has been received, so append it to `str`
			response.on('data', function (chunk) {
				str += chunk;
			});
			//the whole response has been received, take final action.
			response.on('end', function () {
				var jwt = JSON.parse(str);
//				console.log("Response received: "+str);
				if(jwt.aud == GOOGLE_CLIENT_ID)		// valid token response
				{
//					console.log("User authenticated, socket id: "+socket.id);
					LoggedInUsers.push(socket.id);		// save the socket id so that updates can be sent
					socket.emit('authResponse',"success");
				}
				else
					socket.emit('errorResponse',"Invalid token");
				});
			});
		}
	});

	socket.on('un-authenticate', function(data){
		console.log("un-authentication request received: "+data.email);
		if(GMAILS[data.email] === 'undefined')
		{
			console.log("This gmail is invalid: "+data.email);
			socket.emit('errorResponse',"Invalid email");
		}
		else
		{
			console.log("Valid gmail: "+data.email);
			var index = LoggedInUsers.indexOf(socket.id);
			if(index > -1) LoggedInUsers.splice(index, 1);
		}
	});
	
	socket.on('disconnect', function(data){
		console.log("connection disconnect");
		var index = LoggedInUsers.indexOf(socket.id);	
		if(index > -1) LoggedInUsers.splice(index, 1);	// remove from list of valid users
	});
	
		socket.on('end', function(data){
		console.log("connection ended");
	});

});

function updateChatStats() {
	TimeNow = new Date();		// update the time for all calculations
	if(TimeNow > EndOfDay)		// we have skipped to a new day
	{
		doStartOfDay();
		console.log("New day started, stats reset");
	}
	calculateLWT_CIQ();
	calculateASA();
	calculateACT_CPH();
	Overall.tco = Overall.tcan + Overall.tcuq + Overall.tcua;
//	calculateSla();
	for(var i in LoggedInUsers)
	{
		socket = LoggedInUsers[i];
//		console.log("Socket id is: "+socket);
		io.sockets.connected[socket].emit('overallStats', Overall);
		io.sockets.connected[socket].emit('departmentStats', Departments);
	}
//	debugLog("Overall", Overall);
	setTimeout(updateChatStats, 3000);	// send update every second
}

doStartOfDay();		// initialise everything
setTimeout(updateChatStats,3000);	// updates socket io data at infinitum
