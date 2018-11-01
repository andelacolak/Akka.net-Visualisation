 var nodes, edges, network, logData, graphData, timelineData, colors, groups, scale, keysList, listOfVectorClocks;

 $(function() {
  nodes = new vis.DataSet();
  edges = new vis.DataSet();
  //different colors for different projects
  //find a way to have infinite projects
  colors = ["#B0A1BA", "#A5B5BF", "#ABC8C7", "#B8E2C8", "#BFF0D4"];
  groups = [];
  scale = 1.0;
  keysList = [];
  listOfVectorClocks = [];
  DrawGraph();
  DrawTimeline();
  ConnectToServer();
});

 function DrawGraph() {
  var options = GetOptions();
  var container = document.getElementById('mynetwork');
  // provide the data in the vis format
  graphData = {
    nodes: nodes,
    edges: edges
  }
  network = new vis.Network(container, graphData, options);
}

function DrawTimeline() {
  var timelineContainer = document.getElementById('mytimeline');
  timelineData = new vis.DataSet([]);
  var options = {
    editable: true,
    start: new Date(0,0,0,0,0,0,0),
    end: new Date(0,0,0,0,0,0,2)
  };
  var timeline = new vis.Timeline(timelineContainer, timelineData, options);
}

function AddDataToGraph(logData) {
  AddNode(logData.Sender, GetGroup(logData.Sender)); 
  AddNode(logData.Receiver, GetGroup(logData.Receiver));
  AddEdge(logData);
}

function AddDataToTimeline(logData) {
  var sender = logData.Sender;
  var receiver = logData.Receiver;
  timelineData.add({id : logData.id, content: "{0} sent <br>message {1}<br>to {2}".format(sender, logData.Message, receiver), start: new Date(0,0,0,0,0,0,logData.index), className: 'green'});
}

function UpdateData(logData) {
  timelineData.update({id: logData.id, start: new Date(0,0,0,0,0,0,logData.index)});
  edges.update({id: logData.id, label: logData.index + " - " + logData.Message});
}

String.prototype.format = function() {
  a = this;
  for (k in arguments) {
    a = a.replace("{" + k + "}", arguments[k])
  }
  return a
}

function ExtractName(fullName) {
  var fullNameArray = fullName.split("/");
  return fullNameArray.slice(3, fullNameArray.length).join("/");
}

function AddGroup(group) {
  if(!groups.includes(group)) {
    groups.push(group);
    AddGroupToLegend(group);
  }
}

function AddGroupToLegend(group) {
  $("#legend").append('<h6 class="legend-content"> <span class="badge badge-secondary" style=" background-color: ' + GetColor(group) + '"> </span>' + group + '</h1>');
}

function GetGroup(fullName) {
  var group = fullName.split("/")[2];
  AddGroup(group);
  return group;
}

//having troubles with dynamic group add
function GetColor(group) {
  return colors[groups.indexOf(group)];
}

function AddNode(node, group) {
  var shortNode = ExtractName(node);
  if(!graphData.nodes.getIds().includes(node)) {
    nodes.add({id: node, label: shortNode, color: GetColor(group)});
  } 
}

function AddEdge(logData) {
  if(!graphData.edges.getIds().includes(logData.id)) {
    edges.add({id: logData.id, from: logData.Sender, to: logData.Receiver, label: logData.index + " - " + logData.Message });
  }
}

function SetScale(id) {
  if(id == "plus") {
    scale+=0.25;
  } 
  else if (id == "minus") {
    if(scale > 0.5) { scale-=0.25; }
  }
}

function Zoom(id) {
  SetScale(id);
  var scaleOption = { 
    scale : scale,
    animation: {         
      duration: 800,                
      easingFunction: "easeInOutQuad" 
    }  
  };
  network.moveTo(scaleOption);
}

function HappenedBefore(newClock, oldClock) {
  var boolean = true;
  $.each( newClock.Clock, function( key, value ) {
    if(value > oldClock.Clock[key]) { 
      boolean = false;
      return boolean;
    }
  });
  return boolean;
}

function HappenedAfter(newClock, oldClock) {
  var boolean = true;
  $.each( newClock.Clock, function( key, value ) {
    if(value < oldClock.Clock[key]) { 
      boolean = false;
      return boolean;
    }
  });
  return boolean;
}

function Concurrent(newClock, oldClock) {
  return !HappenedBefore(newClock, oldClock) && !HappenedAfter(oldClock, newClock);
}

function FillMissingKeys(data) {
  keysList.forEach(function(value) {
    if(!(value in data.Clock)) {
      data.Clock[value] =  0;
    }
  });
}

function AddToGlobalKeyList(data) {
  for(var key in data.Clock) {
    if(keysList.indexOf(key) == -1) {
      keysList.push(key);
    }
  }
}

function MoveBiggerVectorClocks(index) {
  for (var i = index; i < listOfVectorClocks.length; ++i) {
    listOfVectorClocks[i].index +=1;
    UpdateData(listOfVectorClocks[i]);
  }
}

function AddIndexes(data) {
  FillMissingKeys(data);
  AddToGlobalKeyList(data);
  if(listOfVectorClocks.length == 0) {
    data["index"] = 0;
    listOfVectorClocks.splice(data["index"], 0, data);
  } 
  else {
    var happenedBefore = false;
    for (var i = listOfVectorClocks.length - 1; i >= 0 ; i--) {
      var item = listOfVectorClocks[i];
      FillMissingKeys(item);

      if(HappenedAfter(data, item)) {
        data["index"] = item["index"] + 1;
        listOfVectorClocks.splice(i + 1, 0, data);
        if (happenedBefore) { MoveBiggerVectorClocks(i + 2); }
        break;
      }
      else if(Concurrent(data, item)) {
        data["index"] = item["index"];
        listOfVectorClocks.splice(i, 0, data);
        break;
      } 
      else {
        happenedBefore = true;

        if(i == 0) {
          data["index"] = 0;
          listOfVectorClocks.splice(0, 0, data);
          MoveBiggerVectorClocks(1);
        }
      }
    }
  }
  AddDataToGraph(data);
  AddDataToTimeline(data);
  //insert to list
}

function AddID(data) {
  data["id"] = new Date().getTime() * 10000 + 621355968000000000;
}

function ConnectToServer() {
  //Stored reference to the hub.
  var visualHub = $.connection.visualHub;
  //Initialize the connection.
  $.connection.hub.start().done(function () {
    console.log("success");
    //call server
    visualHub.server.send();
  });

  visualHub.client.broadcastMessage = function (data) {
    console.log(data);
    AddID(data);
    AddIndexes(data);
  };

  $( ".zoom-btn" ).click(function(){Zoom(this.id)});
}