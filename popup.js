
const US_COOKIE_DOMAIN = "unified-api.axs.com"
const UK_COOKIE_DOMAIN = "unifiedapi.axs.co.uk"
const COOKIE_NAME = "axs_ecomm"
const SESSION_KEY = "FanSight-Tab"
const APIENDPOINT = "http://142.93.115.105:8100/api/tickets"
const Authorization = "Token d1c79960669c31dd7d0a3e82eb20fb40908fdac6"
const CODE = `(function(){
    console.log(window.sessionStorage)
    console.log(window.sessionStorage["${SESSION_KEY}"])
    if(window.sessionStorage && window.sessionStorage["${SESSION_KEY}"]){
    chrome.runtime.sendMessage({method: "getLocalStorage", value: window.sessionStorage["${SESSION_KEY}"]}, function(response) {
    console.log("message sent");
})}}())`
let AXS_ECOMM
let FANSIGHT
let URLTOKEN
let DOMAIN
let TIMEOUT
let TICKETINFO = {}
window.onload = function (){
    // console.log("run")
    chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
        if (message.method == "getLocalStorage"){
            FANSIGHT = message.value
        }
    });
    chrome.tabs.getSelected(null ,function (tab) {
        // console.log(tab)
        if (tab && tab.url && tab.url.match(/https:\/\/.+?\.axs\..*/g) ){
            if (tab.url.match(/tix\.axs\.com\/.+?(?=[\/\?])/g)){
                URLTOKEN = tab.url.match(/tix\.axs\.com\/.+?(?=[\/\?])/g)[0].replace(/tix\.axs\.com\//g, "")
                DOMAIN = US_COOKIE_DOMAIN
            }else if (tab.url.match(/shop\.axs\.co\.uk\/.+?(?=[\/\?])/g)){
                URLTOKEN = tab.url.match(/shop\.axs\.co\.uk\/.+?(?=[\/\?])/g)[0].replace(/shop\.axs\.co\.uk\//g, "")
                DOMAIN = UK_COOKIE_DOMAIN
            }else{
                return
            }
            RepeatGetCookie()
            GetSession()
            getParameters().then(()=>{
                fetchdata("inventory").then((ticket)=>{
                    if (ticket.response === "Unauthorized") {
                        document.getElementById("json").innerHTML = "Unauthorized"
                    }else{
                        const data = JSON.parse(ticket.response)
                        console.log(data)
                        const Primary = removeDuplicates(flatten(cleanprimayarray(flatten(Primarydata(data,[])))))
                        const Resale = removeDuplicates(flatten(cleanresalearray(flatten(Resaledata(data,[]))[0])))
    
                        document.getElementById("total").innerHTML =` Total number of available tickets: ${getTotal(Primary)}`
                        const total = Primary.concat(Resale).filter(itm=>itm!==null)
                        console.log(total)
                        TICKETINFO = {...TICKETINFO,
                            "tickets_amounts" : [
                                {
                                    "amount": getTotal(Primary),
                                    "type": "primary"
                                },
                                {
                                    "amount": 0,
                                    "type": "resale"
                                }
                            ],
                            "tickets_by_sections":total
                        }
                        
                        buildTable(total)
                    }
                }).catch(error=>{
                    console.log(error)
                })
                fetchdata("onsale").then((sale)=>{
                    // console.log(sale)
                    const rawevent = JSON.parse(sale.response).onsaleInformation.events[0]
                    const eventID = rawevent.eventID
                    const date = rawevent.date ? Date.parse(rawevent.date).toString("yyyy-MM-ddThh:mm:ss") : null
                    const name = rawevent.title
                    if (eventID){
                        fetchdata("onsale", eventID).then((event)=>{
                            console.log(JSON.parse(event.response))
                            const axsEventID = JSON.parse(event.response).axsEventID
                            TICKETINFO = {...TICKETINFO, "event":{"legacy_id": axsEventID, "date": date, "name": name}}
                            SaveData("tickets", TICKETINFO.event)
                            const apisend = setInterval(()=>{
                                if (TICKETINFO.event && TICKETINFO.tickets_amounts){
                                    document.getElementById("json").innerHTML = JSON.stringify(TICKETINFO,null,4)
                                    clearInterval(apisend)
                                    postdata(JSON.stringify(TICKETINFO)).then(res=>{
                                        console.log(res)
                                        if (!res || res===""){
                                            document.getElementById("response").innerHTML = "JSON sent to API successfully"
                                        }else{
                                            document.getElementById("response").innerHTML = JSON.stringify(JSON.parse(res),null,4)
                                        }
                                    }).catch(err=>{
                                        console.log(err)
                                    })
                                }
                            },500)
                        }).catch(error=>{
                            console.log(error)
                        })
                    }
                }).catch(error=>{
                    console.log(error)
                })
            })
        }
    })
}
function getParameters(){
    return new Promise((resolve, reject)=>{
        const parameterInt = setInterval(()=>{
            if (AXS_ECOMM && URLTOKEN && FANSIGHT){
                resolve()
                clearInterval(parameterInt)
            }
        },500)
    })
}
function fetchdata(type, eventID){
    return new Promise (function(resolve, reject){
        if (AXS_ECOMM && URLTOKEN && FANSIGHT){
            const parameters = (type === "inventory"? "/price?locale=en-US&getSections=true&grouped=true&includeSoldOuts=false&include" : "")
            const event = (eventID && type === "onsale" ? `/event/${eventID}` : "")
            document.cookie =`axs_ecomm=${AXS_ECOMM}; path=/; domain=.${DOMAIN}; Secure; HttpOnly;`
            url = `https://${DOMAIN}/veritix/${type}/v2/${URLTOKEN}${parameters}${event}`
            let xhr = new XMLHttpRequest();     
            xhr.open("GET", url, true);
            xhr.withCredentials = true;
            xhr.setRequestHeader("FanSight-Tab", FANSIGHT);
            xhr.send();    
            xhr.onreadystatechange = function(){
                if (this.readyState === XMLHttpRequest.DONE ){
                    return resolve(xhr)
                }
            }
        }else{
            reject("waiting for parameters")
        }
    })
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
function GetSession(tabId){
    chrome.tabs.executeScript(tabId, {
        code: CODE
    }, function() {
        if (chrome.runtime.lastError) {
            console.log('There was an error injecting getLoading script : \n' + chrome.runtime.lastError.message);
        }
    });
}
function GetCookie(){
    return new Promise((resolve,reject)=>{
        chrome.cookies.getAll({
            domain: DOMAIN,
            name: COOKIE_NAME
        }, function (cookie){
            if (cookie && cookie.length === 1){
                resolve(cookie[0])
            }else{
                reject({error:"cookie not found"})
            }
        })
    })
}

function RepeatGetCookie(){
    GetCookie().then((cookie)=>{
        AXS_ECOMM = cookie.value
    }).catch(error=>{
        console.log(error)
        RepeatGetCookie()
    })
}

function Primarydata(data){
    if (data["offerPrices"]===undefined) return null
    return data["offerPrices"].map(offer=>{
        if (offer["zonePrices"]===undefined) return null
        return offer["zonePrices"].map(zone=>{
            if (zone.hasOwnProperty("priceLevels")){
                return zone["priceLevels"];
            }
        })
    })
}
function Resaledata(data){
    if (data["offerPrices"]===undefined) return null
    return data["offerPrices"].map(offer=>{
        if (offer["zonePrices"]===undefined) return null
        return offer["zonePrices"].map(zone=>{
            if (zone.hasOwnProperty("resalePrices")){
                return zone["resalePrices"];
            }
        })
    })
}
function flatten(arr) {
    if (!arr) return []
    return arr.reduce(function (flat, toFlatten) {
        if (!toFlatten) return flat
      return flat.concat(Array.isArray(toFlatten) ? flatten(toFlatten) : toFlatten);
    }, []);
}
function cleanprimayarray(data){
    if (!data) return null
    return data.map(item=>{
        if (item.availability.sections.length === 0){
           return {type : "primary", 
                section: item.label,
                amount: (item.amount ? item.amount : (item.availability.amount ? item.availability.amount : 0)),
                price:formatPrice(item.prices[0].base), 
                min_price: item.prices[0].base/100, 
                max_price: item.prices[0].base/100
            }
        } 
        return item.availability.sections.map(section=>{
            return {type : "primary", 
                section: item.label + " " + section.label,
                amount: (section.amount ? section.amount : 0),
                price:formatPrice(item.prices[0].base), 
                min_price: item.prices[0].base/100, 
                max_price: item.prices[0].base/100
            }
        })
    })
}
function cleanresalearray(data){
    if (!data) return null
    return Object.keys(data).map(key=>{
        return {type : "resale", section: key, amount: 1 , ...resalePriceRange(data[key])}
    })
}
function resalePriceRange(data){
    if (!data) return null
    const maximum = Object.keys(data).reduce((max, cur) => (data[cur] > max) ? data[cur] : max, 0 )
    const minimum = Object.keys(data).reduce((min, cur) => (data[cur] < min) ? data[cur] : min, 999999999999999)
    return {min_price:minimum/100, max_price:maximum/100, price: `${formatPrice(minimum)} - ${formatPrice(maximum)}`}
}
function formatPrice(price){
    const formatter = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2
    })
    return formatter.format(price/100)
}

function buildTable(total){
    var table = new Tabulator("#ticket-table", {
        data:total,           //load row data from array
        layout:"fitColumns",      //fit columns to width of table
        tooltips:true,            //show tool tips on cells
        addRowPos:"top",          //when adding a new row, add it to the top of the table
        history:true,             //allow undo and redo actions on the table
        resizableRows:true,       //allow row order to be changed
        initialSort:[             //set the initial sort order of the data
            {column:"category", dir:"asc"},
        ],
        columns:[  
            {title:"Ticket type", field:"type"},
            {title:"Section", field:"section"},
            {title:"# of tickets", field:"amount"},
            {title:"Price range", field:"price"}
        ],
    });
}
function removeDuplicates(arr) { 
    if (!arr) return null
    return arr.reduce(function(p, c) {
        var id = [c.category, c.label, c.amount, c.price].join('|');
        if (p.temp.indexOf(id) === -1) {
          p.out.push(c);
          p.temp.push(id);
        }
        return p;
      }, {
        temp: [],
        out: []
      }).out;
} 
function getTotal(arr) { 
    return arr.reduce((sum, cur)=>{
        return sum + cur.amount
    },0)
} 

function SaveData(key, value){
    chrome.storage.sync.get(key, function (obj) {
        let newobj
        if (!obj[key]){
            newobj = [value]
        }else{
            newobj = obj[key].concat(value)
        }
        // console.log(JSON.stringify(newobj));

        chrome.storage.sync.set({[key]:newobj}, function () {
            console.log();
        });
    });
}