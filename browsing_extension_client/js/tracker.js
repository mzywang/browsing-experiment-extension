// secret mode on
var secretMode = 1; // how much of the div do we show? 
var lastKnownScroll = 0;
var ticking = false;
var scrollRateThrottle = 1; // no need to throttle now that we combine all them?
var scrollRateCounter = 0;

function removeAllTextNodes(node) {
    if (node.nodeType === 3) {
        node.parentNode.removeChild(node);
    } else if (node.childNodes) {
        for (var i = node.childNodes.length; i--;) {
            removeAllTextNodes(node.childNodes[i]);
        }
    }
}


$(document).on('click', null, function(event) {
  var strippedCopy = event.target.cloneNode(true);
  var data = "";
  removeAllTextNodes(strippedCopy);
  if (secretMode == 1) {
    data = strippedCopy.outerHTML;
    console.log(strippedCopy.outerHTML);
  } else {
    data = event.target.outerHTML;
    console.log(event.target.outerHTML);
  }
  chrome.runtime.sendMessage({
    action: CLICK_MSG,
    data: data,
    timestamp: Date.now()
  }, function(response) {
    console.log(response.ack);
  });
});

$(document).keypress(function(event){
  var strippedCopy = event.target.cloneNode(true);
  var data = "";
  removeAllTextNodes(strippedCopy);
  if (secretMode == 1) {
    data = strippedCopy.outerHTML;
    console.log(strippedCopy.outerHTML);
  } else {
    data = event.target.outerHTML;
    console.log(event.target.outerHTML);
  }

  console.log(event.target);
  chrome.runtime.sendMessage({
    action: TYPE_MSG,
    data: data,
    timestamp: Date.now()
  }, function(response) {
    console.log(response.ack);
  });
});

$(window).on('scroll', null, function(event) {
  scrollRateCounter++;
  lastKnownScroll = window.scrollY;
  if(!ticking && scrollRateCounter == scrollRateThrottle) {
    scrollRateCounter = 0;
    window.requestAnimationFrame(function() {
      chrome.runtime.sendMessage({
        action: SCROLL_MSG,
        data: lastKnownScroll,
        timestamp: Date.now()
      },
        function (response) {
          console.log(response.ack);
      });
      ticking = false;
    });
    ticking = true;
  }
});
