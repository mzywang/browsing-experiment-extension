var outbox = new ReconnectingWebSocket("ws://blooming-garden-58768.herokuapp.com/submit");
var uid = "ADMIN";
var lastActionType = NULL_ACTION_MSG;
var actionBuilder = {};


function getDomain(url) {
    var match = url.match(/:\/\/(www[0-9]?\.)?(.[^/:]+)/i);
    if (match != null && match.length > 2 && typeof match[2] === 'string' && match[2].length > 0) {
    return match[2];
    }
    else {
        return null;
    }
}

/**
* getCurrentTab is a utility function to add metadata for actions
*/
function getCurrentTab(callback) {
  var queryInfo = {
    active: true,
    currentWindow: true
  };
  chrome.tabs.query(queryInfo, (tabs) => {
    var tab = tabs[0];
    var url = tab.url;
    tab.domain = getDomain(url);
    console.assert(typeof url == 'string', 'tab.url should be a string');
    callback(tab);
  });
}

/**
* setInterval is a function that sets up the awake timer to set off every AWAKE_TIMER minutes
*/
setInterval(function() {
  getCurrentTab((tab) => {
    var url = tab.url;
    var domain = tab.domain;
    var tabId = tab.id;
    var action = AWAKE_MSG;
    var timestamp = Date.now();
    let mail = {
      url: url,
      domain: domain,
      action: action,
      timestamp: timestamp,
      tabId: tabId,
      uid: uid
    };
    checkScrollType(action, function() {
      console.log("sending mail: " + JSON.stringify(mail));
      outbox.send(JSON.stringify(mail));
      lastActionType = action;
    });
  });
}, AWAKE_TIMER * 60 * 1000);


function checkScrollType(currentAction, callback) {
  if (lastActionType == SCROLL_MSG || lastActionType == TYPE_MSG) {
    console.log("sending mail: " + JSON.stringify(actionBuilder));
    outbox.send(JSON.stringify(actionBuilder));
    actionBuilder = {};
  }
  callback();
}

/**
* Receives messages from the tracker and then sends actions to server to be processed
*/
chrome.runtime.onMessage.addListener(
  function(request, sender, sendResponse) {
  var action = request.action;
  var timestamp = request.timestamp;
  var data = request.data;
  // Click Message Processing
  if (request.action === CLICK_MSG) {
    getCurrentTab((tab) => {
      var url = tab.url;
      var domain = tab.domain;
      var tabId = tab.id;
      console.log("received click message on url: " + url);
      let mail = {
        url: url,
        domain: domain,
        action: action,
        timestamp: timestamp,
        tabId: tabId,
        data: data,
        uid: uid
      };
      checkScrollType(action, function() {
        console.log("sending mail: " + JSON.stringify(mail));
        outbox.send(JSON.stringify(mail));
        lastActionType = action;
      });
    });
  // Type Message Processing
  } else if (request.action === TYPE_MSG) {
    if (lastActionType == TYPE_MSG) {
      // Delay message, but keep building it
      actionBuilder.timestamp_end = timestamp;
      actionBuilder.times = actionBuilder.times + 1;
    } else {
      // Begin building the message
      getCurrentTab((tab) => {
        var url = tab.url;
        var domain = tab.domain;
        var tabId = tab.id;
        actionBuilder.url = url;
        actionBuilder.domain = domain;
        actionBuilder.action = action;
        actionBuilder.timestamp_start = timestamp;
        actionBuilder.tabId = tabId;
        actionBuilder.data = data;
        actionBuilder.uid = uid;
        actionBuilder.times = 1;
      });
    }
    lastActionType = action;
  // Scroll Message Processing
  } else if (request.action === SCROLL_MSG) {
    if (lastActionType == SCROLL_MSG) {
      // Delay message
      actionBuilder.timestamp_end = timestamp;
      actionBuilder.times = actionBuilder.times + 1;
    } else {
      getCurrentTab((tab) => {
        var url = tab.url;
        var domain = tab.domain;
        var tabId = tab.id;
        actionBuilder.url = url;
        actionBuilder.domain = domain;
        actionBuilder.action = action;
        actionBuilder.timestamp_start = timestamp;
        actionBuilder.tabId = tabId;
        actionBuilder.data = data;
        actionBuilder.uid = uid;
        actionBuilder.times = 1;
      });
    }
    lastActionType = action;
  }
  return true;
});

// Tab Creation Message Processing
chrome.tabs.onCreated.addListener(function(tab) {
  console.log("new tab created with tab id: " + tab.id +"!");
  var action = NEW_TAB_MSG;
  var timestamp = Date.now();
  var tabId = tab.id;
  let mail = {
    action: action,
    timestamp: timestamp,
    tabId: tabId,
    uid: uid
  };
  checkScrollType(action, function() {
    console.log("sending mail: " + JSON.stringify(mail));
    outbox.send(JSON.stringify(mail));
    lastActionType = action;
  });
});

// URL Updated Message Processing
chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
  if (changeInfo.url) {
    console.log("tab with id " + tabId + " has changed domain to " + changeInfo.url);
    var action = URL_CHANGE_MSG;
    var timestamp = Date.now();
    var url = changeInfo.url;
    var domain = getDomain(url);
    let mail = {
      action: action,
      timestamp: timestamp,
      tabId: tabId,
      url: url,
      domain: domain,
      uid: uid
    };
    checkScrollType(action, function() {
      console.log("sending mail: " + JSON.stringify(mail));
      outbox.send(JSON.stringify(mail));
      lastActionType = action;
    });
  }
});

// Tab Updated Message Processing
chrome.tabs.onActivated.addListener(function(activeInfo) {
  var action = TAB_CHANGE_MSG;
  var timestamp = Date.now();
  var tabId = activeInfo.tabId;
  let mail = {
    action: action,
    timestamp: timestamp,
    tabId: tabId,
    uid: uid
  };
  checkScrollType(action, function() {
    console.log("sending mail: " + JSON.stringify(mail));
    outbox.send(JSON.stringify(mail));
    lastActionType = action;
  });
});


chrome.webNavigation.onCommitted.addListener(function(details) {
  // handles transition types (can detect back button, forward button, and address bar)
  var timestamp = Date.now();
  getCurrentTab((tab) => {
    if (details.transitionQualifiers.includes("forward_back")) {
      console.log("back/forward button pressed");
      // Back Button Message Processing
      var action = BACK_BUTTON_MSG;
      var tabId = tab.id;
      let mail = {
        action: action,
        timestamp: timestamp,
        tabId: tabId,
        uid: uid
      };
      checkScrollType(action, function() {
        console.log("sending mail: " + JSON.stringify(mail));
        outbox.send(JSON.stringify(mail));
        lastActionType = action;
      });
    } else if (details.transitionQualifiers.includes("from_address_bar")){
      // Omnibox Message Processing
      var action = OMNIBOX_MSG;
      var tabId = tab.id;
      let mail = {
        action: action,
        timestamp: timestamp,
        tabId: tabId,
        uid: uid
      };
      checkScrollType(action, function() {
        console.log("sending mail: " + JSON.stringify(mail));
        outbox.send(JSON.stringify(mail));
        lastActionType = action;
      });
      console.log("typed in address bar");
    }
  })
});
