// H3G utilities for use in dashboard and custom reports

var ChatStatus = ["Logged Out","Away","Available"];
var csvfile = null;

function readCookie(name)
{
  name += '=';
  var parts = document.cookie.split(/;\s*/);
  for (var i = 0; i < parts.length; i++)
  {
    var part = parts[i];
    if (part.indexOf(name) == 0)
      return part.substring(name.length);
  }
  return null;
}

/*
 * Saves a cookie for delay time. If delay is blank then no expiry.
 * If delay is less than 100 then assumes it is days
 * otherwise assume it is in seconds
 */
function saveCookie(name, value, delay)
{
  var date, expires;
  if(delay)
  {
	  if(delay < 100)	// in days
		  delay = delay*24*60*60*1000;	// convert days to milliseconds
	  else
		  delay = delay*1000;	// seconds to milliseconds
	  
	  date = new Date();
	  date.setTime(date.getTime()+delay);	// delay must be in seconds
	  expires = "; expires=" + date.toGMTString();		// convert unix date to string
  }
  else
	  expires = "";
  
  document.cookie = name+"="+value+expires+"; path=/";
}

/*
 * Delete cookie by setting expiry to 1st Jan 1970
 */
function delCookie(name) 
{
	document.cookie = name + "=; expires=Thu, 01-Jan-70 00:00:01 GMT; path=/";
}

function clearCredentials() {
	$('#error').text("");
	delCookie("username");
	delCookie("password");
	window.location.reload();
}

function checksignedin()
{
	var name = readCookie("username");
	var pwd = readCookie("password");
	$('#rtaversion').text("RTA Dashboard v0.85");
	$('#download').hide();
//	console.log("User cookie: "+name+" and pwd "+pwd);
	if(name == null || pwd == null)
	{
		$('#myname').text("Not signed in");
		$("#topTable").hide();
		$("#signinform").show();
	}
	else
	{
		signin(name,pwd);	
	}	
}

function signin(uname, pwd)
{
	var data = new Object();
	data = {name: uname,pwd: pwd};
//	console.log("Data object: "+data.name+" and "+data.pwd);
	socket.emit('authenticate', data);
}

function toHHMMSS(seconds) {
    var sec_num = parseInt(seconds, 10); // don't forget the second param
    var hours   = Math.floor(sec_num / 3600);
    var minutes = Math.floor((sec_num - (hours * 3600)) / 60);
    var seconds = sec_num - (hours * 3600) - (minutes * 60);

    if (hours   < 10) {hours   = "0"+hours;}
    if (minutes < 10) {minutes = "0"+minutes;}
    if (seconds < 10) {seconds = "0"+seconds;}
    var time    = hours+':'+minutes+':'+seconds;
    return time;
}

function getURLParameter(name) {
  return decodeURIComponent((new RegExp('[?|&]' + name + '=' + '([^&;]+?)(&|#|;|$)').exec(location.search)||[,""])[1].replace(/\+/g, '%20'))||null
}

function NewWin(htmlfile)		// open a new window
{
	WIDTH = 1280;
	HEIGHT = 768;
	var left = (screen.width/2)-(WIDTH/2);
	var top = (screen.height/2)-(HEIGHT/2)-64;
	var winpop = window.open(htmlfile, '_blank',
				'toolbar=yes,location=no,status=no,menubar=yes,scrollbars=yes,resizable=yes,width='+WIDTH+',height='+HEIGHT+',top='+top+',left='+left);
	winpop.focus();
	return winpop;
}

// print top level table with metrics
function showTopLevelStats(data) {
	var rowid;
	var ttable = document.getElementById("topTable");
	rowid = document.getElementById(data.name);
	if(rowid === null)		// row doesnt exist so create one
	{
		rowid = createRow(ttable, data.did, data.name);
	}
	showTopMetrics(rowid,data);
}

function createRow(tableid, id, name) {
	
	row = tableid.insertRow();	
	row.id = name;
	var cols = tableid.rows[0].cells.length;
	for(var i=0; i < cols; i++)
	{
		row.insertCell(i);
	}
	row.cells[0].outerHTML = "<th class='h3g_link' onClick=\"showSkillGroup('"+id+"','"+name+"')\">"+name+"</th>";

	return row;
}

function showTopMetrics(rowid, data) {
	var tcanpc = " (0%)";
	var tcunpc = " (0%)";
	var slapc = "0%";
	
	if(data.tco != 0)
	{
		tcanpc = " ("+Math.round((data.tcan/data.tco)*100)+"%)";
		tcunpc = " ("+Math.round((data.tcun/(data.tcun+data.tco))*100) +"%)";
	}
	if(data.tcan != 0)
		slapc = Math.round((data.csla/data.tcan)*100) +"%";

	rowid.cells[1].innerHTML = data.cconc;
	rowid.cells[2].innerHTML = slapc;
	rowid.cells[3].innerHTML = data.ciq;
	rowid.cells[4].innerHTML = toHHMMSS(data.lwt);
	rowid.cells[5].innerHTML = data.tco;
	rowid.cells[6].innerHTML = data.tac;
	rowid.cells[7].innerHTML = data.tcan + tcanpc;
	rowid.cells[8].innerHTML = data.tcuq;
	rowid.cells[9].innerHTML = data.tcua;
	rowid.cells[10].innerHTML = data.tcun + tcunpc;
	rowid.cells[11].outerHTML = NF.printASA(data.asa);
	rowid.cells[12].outerHTML = NF.printACT(data.act);	
	rowid.cells[13].innerHTML = data.acc;
	rowid.cells[14].innerHTML = data.oaway;
	rowid.cells[15].innerHTML = data.oavail+data.oaway;	// total logged in
}

function showDeptLevelStats(data) {
	var rowid;
	var ttable = document.getElementById("topTable");

	rowid = document.getElementById(data.name);
	if(rowid === null)		// row doesnt exist so create one
	{
		var sgrowid = document.getElementById(data.skillgroup);
		rowid = createDeptRow(ttable,sgrowid.rowIndex,data.skillgroup,data.did,data.name);
	}
	showTopMetrics(rowid,data);
}

function createDeptRow(tableid,index,sg,did,name) {

	row = tableid.insertRow(index+1);
	row.id = name;
	var cols = tableid.rows[0].cells.length;
	for(var i=0; i < cols; i++)
	{
		row.insertCell(i);
	}
	row.cells[0].outerHTML = "<td class='h3g_link' onClick=\"showDepartment('"+did+"','"+name+"')\">"+name+"</td>";
	
	return row;
}

function showDeptMetrics(rowid, data) {

	var act = 0;
	if(data.tct > 0)
		act = Math.round(data.tct/data.tcan);
	
	rowid.cells[1].innerHTML = ChatStatus[data.status]+":"+data.cstatus;
	rowid.cells[2].innerHTML = toHHMMSS(data.tcs);
	rowid.cells[3].innerHTML = data.ccap;
	rowid.cells[4].innerHTML = data.activeChats.length;
	rowid.cells[5].innerHTML = data.acc;
	rowid.cells[6].innerHTML = data.tcan;
	rowid.cells[7].innerHTML = data.cph;	
	rowid.cells[8].outerHTML = NF.printACT(act);	
	rowid.cells[9].innerHTML = data.cconc;
}

/* build csvfile from table to export snapshot
 */
function tableToCsvFile(dashtable) {
	var key, keys, j, i, k;
	var str = "";

	$('#download').hide();	
	$("#message1").text("Preparing file for export");
	var exportData = "Dashboard Metrics Export "+new Date().toUTCString()+"\r\n";
	exportData = exportData + "\r\n";
	var ttable = document.getElementById(dashtable);
	for(var x = 0; x < ttable.rows.length; x++)
	{
		row = ttable.rows[x];
		for (var j = 0, col; col = row.cells[j]; j++)
		{
			str = str +"\""+ col.innerHTML + "\",";
		} 
		str = str + "\r\n";
	}
	exportData = exportData + str +"\r\n";		
	prepareDownloadFile(exportData);
}

/* build csvfile to export snapshot
 * First param is an object and second is an array of same objects
 * e.g. Overall and Skillgroups or Skillgroup and Departments
 */
function buildCsvFile(fdata, sdata) {
	var key, keys, j, i, k;
	var str = "";

	$('#download').hide();	
	$("#message1").text("Preparing file for export");
	var exportData = "Dashboard Metrics Export "+new Date().toUTCString()+"\r\n";
	// add csv header using keys in first object
	exportData = exportData + "\r\n";
//	key = Object.keys(fdata);
//	keys = fdata[key];
	for(key in fdata)
	{
		exportData = exportData +key+ ",";
	}
	exportData = exportData + "\r\n";
	// now add the data
	for(i in fdata)
	{
		str = str + fdata[i] + ",";
	}
	str = str + "\r\n";
	for(j in sdata)
	{
		var obj = new Object();
		obj = sdata[j];
		for(k in obj)
		{
			str = str + obj[k] + ",";
		}
	str = str + "\r\n";
	}

	exportData = exportData + str +"\r\n";
	prepareDownloadFile(exportData);
}

/*
 *	This function makes data (typically csv format) available for download
 *  using the DOM id "download" which should be labelled "download file"
 */
function prepareDownloadFile(data)
{
	var filedata = new Blob([data], {type: 'text/plain'});
	// If we are replacing a previously generated file we need to
	// manually revoke the object URL to avoid memory leaks.
	if (csvfile !== null)
	{
		window.URL.revokeObjectURL(csvfile);
	}

    csvfile = window.URL.createObjectURL(filedata);
	$("#message1").text("Snapshot exported "+ new Date().toUTCString());
	$('#download').attr("href",csvfile);
	$('#download').show(300);
}

function showLoginForm() {
str = '<div class="form-horizontal col-xs-9 col-xs-offset-3">' +
	'<form id="signinform">'+
		'<div class="form-group">'+
			'<label class="control-label col-xs-2">Username:</label>'+
			'<div class="col-xs-3">'+
				'<input class="form-control" id="username" type="text"></input>'+
			'</div>'+
		'</div>'+
		'<div class="form-group">'+
			'<label class="control-label col-xs-2">Password:</label>'+
			'<div class="col-xs-3">'+
				'<input class="form-control" id="password" type="password"></input>'+
			'</div>'+
			'<div class="col-xs-3">'+
				'<input class="btn btn-primary" type="submit" value="Sign In"></input>'+
			'</div>'+
		'</div>'+
	'</form>'+
'</div>';

document.write(str);
}

function showDashboardHeader() {
str = '<h2><center><img src="threelogo.png"/>&nbsp;Dashboard</center></h2>'+
	'<div class="wrapper col-xs-12">'+
	'<button type="button" id="myname" class="btn btn-primary">Not signed in</button> '+
	'<button type="button" class="btn btn-secondary" onClick="clearCredentials()">Clear Credentials</button> '+
	'<button type="button" class="btn btn-info" onClick="exportMetrics()">Export</button> '+
	'<span class="col-xs-offset-1" id="message1"></span> '+
	'<a class="btn btn-success" download="RTAexport.csv" id="download">Download file</a> '+
	'<span id="rtaversion" class="pull-right"></span> '+
	'</div> '+
'<div class="wrapper col-xs-12">'+
'<span>&nbsp;</span>'+
'</div>';

document.write(str);
}

// global namespace
var NF = NF || {
	
	thresholds: {
		
		// ACT thresholds
		ACT: {
			green: 0,
			amber: 1800,
			red: 2100
		},
		
		// ASA thresholds
		ASA: {
			green: 0,
			amber: 90,
			red: 99
		},
		
		// SL thresholds
		SL: {
			green: 90,
			amber: 85,
			red: 0
		},
		
		// Concurrency thresholds
		Concurrency: {
			green: 1.60,
			amber: 1.52,
			red: 0.00
		},
		
		// Answered thresholds
		Answered: {
			green: 97,
			amber: 92,
			red: 0
		},
		
		// Unanswered thresholds
		Unanswered: {
			green: 0,
			amber: 5,
			red: 10
		}
	}
		
};

// ACT
NF.printACT = function(value) {
	
	if (value > this.thresholds.ACT.red) {
		return '<span class="nf-red">' + toHHMMSS(value) + '</span>';
	}
	
	else if ( value >= this.thresholds.ACT.amber && value <= this.thresholds.ACT.red ) {
		return '<span class="nf-amber">' + toHHMMSS(value) + '</span>';
	}
	
	else if ( value > this.thresholds.ACT.green && value < this.thresholds.ACT.amber ) {
		return '<span class="nf-green">' + toHHMMSS(value) + '</span>';
	}
	
	else {
		return '<span>' + toHHMMSS(value) + '</span>';
	}
	
};


// ASA
NF.printASA = function(value) {
	
	if (value > this.thresholds.ASA.red) {
		return '<span class="nf-red">' + toHHMMSS(value) + '</span>';
	}
	
	else if ( value >= this.thresholds.ASA.amber && value <= this.thresholds.ASA.red ) {
		return '<span class="nf-amber">' + toHHMMSS(value) + '</span>';
	}
	
	else if ( value > this.thresholds.ASA.green && value < this.thresholds.ASA.amber ) {
		return '<span class="nf-green">' + toHHMMSS(value) + '</span>';
	}
	
	else {
		return '<span>' + toHHMMSS(value) + '</span>';
	}
};


// SL
NF.printSL = function(value) {
	
	if (value > this.thresholds.SL.green) {
		return '<span class="nf-green">' + value + '</span>';
	}
	
	else if ( value <= this.thresholds.SL.green && value >= this.thresholds.SL.amber ) {
		return '<span class="nf-amber">' + value + '</span>';
	}
	
	else if ( value < this.thresholds.SL.amber && value > this.thresholds.SL.red ) {
		return '<span class="nf-red">' + value + '</span>';
	}
	
	else {
		return '<span>' + value + '</span>';
	}
};


// Concurrency
NF.printConcurrency = function(value) {
	
	if (value > this.thresholds.Concurrency.green) {
		return '<span class="nf-green">' + value + '</span>';
	}
	
	else if ( value <= this.thresholds.Concurrency.green && value >= this.thresholds.Concurrency.amber ) {
		return '<span class="nf-amber">' + value + '</span>';
	}
	
	else if ( value < this.thresholds.Concurrency.amber && value > this.thresholds.Concurrency.red ) {
		return '<span class="nf-red">' + value + '</span>';
	}
	
	else {
		return '<span>' + value + '</span>';
	}
	
};


// Answered
NF.printAnswered = function(value) {
	
	if (value > this.thresholds.Answered.green) {
		return '<span class="nf-green">' + value + '</span>';
	}
	
	else if ( value <= this.thresholds.Answered.green && value >= this.thresholds.Answered.amber ) {
		return '<span class="nf-amber">' + value + '</span>';
	}
	
	else if ( value < this.thresholds.Answered.amber && value > this.thresholds.Answered.red ) {
		return '<span class="nf-red">' + value + '</span>';
	}
	
	else {
		return '<span>' + value + '</span>';
	}
	
};


// Unanswered
NF.printUnanswered = function(value) {
	
	if (value > this.thresholds.Unanswered.red) {
		return '<span class="nf-red">' + value + '</span>';
	}	
	else if ( value >= this.thresholds.Unanswered.amber && value <= this.thresholds.Unanswered.red ) {
		return '<span class="nf-amber">' + value + '</span>';
	}	
	else if ( value >= this.thresholds.Unanswered.green && value < this.thresholds.Unanswered.amber ) {
		return '<span class="nf-green">' + value + '</span>';
	}
	else {
		return '<span>' + value + '</span>';
	}
};

