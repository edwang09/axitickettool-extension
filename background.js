const COOKIE_DOMAIN = "unified-api.axs.com"
const COOKIE_NAME = "axs_ecomm"
const SESSION_KEY = "FanSight-Tab"
const APIENDPOINT = "http://142.93.115.105:8100/api/events"
const Authorization = "Token d1c79960669c31dd7d0a3e82eb20fb40908fdac6"
const CODE = `
    var scriptList =[]
    const script = document.querySelectorAll("script:not([src])").forEach(function(node) {
        scriptList.push(node.innerHTML)
    })
    filteredscriptList = scriptList.filter(function(script){
        return (script.match(/var\\seventId\\s\\=\\s/g)) || (script.match(/\@context/g))
    })
    chrome.runtime.sendMessage({method: "getEvent", value: filteredscriptList , function(response) {
    console.log("message sent");
  }})
`



function RunExtension( tabId){
    chrome.tabs.get(tabId, function (tab) {
      if (tab && tab.url && tab.url.match(/https:\/\/www\.axs\.com\/events\/.*/g) ){
        const eventId = tab.url.match(/axs\.com\/events\/.+?(?=[\/])/g)[0].replace(/axs\.com\/events\//g, "")
        console.log(eventId)
        GetEvent(tabId)
      }
    })
  }
function GetEvent(tabId){
    chrome.tabs.executeScript(tabId, {
        code: CODE
    }, function() {
        if (chrome.runtime.lastError) {
            console.log('There was an error injecting getLoading script : \n' + chrome.runtime.lastError.message);
        }
    });
}
function injectNotification(tabId){
    console.log("inject code")
    chrome.tabs.executeScript(tabId, {
        file: "injectnotification.js"
    }, function() {
        if (chrome.runtime.lastError) {
            console.log('There was an error injecting getLoading script : \n' + chrome.runtime.lastError.message);
        }
    });
}


chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
    if (message.method == "getEvent"){
        const venueString = message.value[0]
        const venuePart = JSON.parse(venueString)
        const eventString = message.value[1]
        const rawEventPart = {
            legacy_id:ExtractValue("eventId", eventString),
            venueId:ExtractValue("venueId", eventString),
            name:ExtractValue("eventName", eventString),
            date:ExtractValue("eventDate", eventString),
            onsale_date:ExtractValue("onSaleDateTime", eventString),
            genre:ExtractValue("genre", eventString),
            subgenre:ExtractValue("subGenre", eventString),
            artist_id:ExtractValue("primaryArtistId", eventString)
        }
        let eventPart = {}
        Object.keys(rawEventPart).map((key)=>{
            if (rawEventPart[key] && rawEventPart[key]!==""){
                eventPart[key] = rawEventPart[key]
            }
        })
        const eventObject = combineJSON(eventPart, venuePart.location)
        console.log(eventObject)
        SaveData("events", eventObject)
        postdata(JSON.stringify(eventObject)).then(res=>{
            console.log(res)
            injectNotification(sender.tab.id)
        }).catch(err=>console.log(err))
    }
});

function ExtractValue(key, content){
    const reg = new RegExp(`var\\s${key}\\s\\=\\s.+?(?=;)`,'g')
    if (content.match(reg) && content.match(reg)[0].match(/['"].*['"]/g)){
        const valuestring = content.match(reg)[0].match(/['"].*['"]/g)[0]
        const value = valuestring.substring(1, valuestring.length -1 )
        return decodeURI(JSON.parse(`"${value}"`))
    }else{
        return null
    }
    
}

chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab){
    if (changeInfo && changeInfo.status && changeInfo.status === "complete"){
        console.log("Page load complete")
        RunExtension(tabId)
    }
    });

function combineJSON(eventPart, venuePart){
    const event = {...eventPart, url:`https://www.axs.com/events/${eventPart.legacy_id}`}
    const venueId = eventPart.venueId
    delete event.venueId
    console.log(event.date)
    event.date = Date.parse(event.date.replace(/\s+-\s+/g,",")).toString("yyyy-MM-ddThh:mm:ss")
    event.onsale_date = Date.parse(event.onsale_date.replace(/\s+-\s+/g,",")).toString("yyyy-MM-ddThh:mm:ss")
    return {
        event,
        venue: {
            name: venuePart.name,
            url: `https://www.axs.com/venues/${venueId}`,
            legacy_id: venueId,
            location: `${venuePart.address.addressLocality || ""}, ${venuePart.address.addressRegion || ""}`,
            country: venuePart.address.addressCountry,
            zip: venuePart.address.postalCode
        }
    }
}

function postdata(data){
    return new Promise (function(resolve, reject){
            let xhr = new XMLHttpRequest();     
            xhr.open("POST", APIENDPOINT, true);
            xhr.setRequestHeader("Authorization", Authorization)
            xhr.setRequestHeader("Content-Type", "application/json")
            xhr.send(data);    
            xhr.onreadystatechange = function(){
                if (this.readyState === XMLHttpRequest.DONE ){
                    return resolve(xhr.response)
                }
            }
    })
}

function SaveData(key, value){
    chrome.storage.sync.get(key, function (obj) {
         let newobj
        if (!obj[key]){
            newobj = [value.event]
        }else{
            newobj = obj[key].concat(value.event)
        }
        // console.log(JSON.stringify(newobj));
        chrome.storage.sync.set({[key]:newobj}, function () {
            console.log();
        });
    });
}