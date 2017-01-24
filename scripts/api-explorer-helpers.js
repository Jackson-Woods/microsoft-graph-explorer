// ------------------------------------------------------------------------------
//  Copyright (c) Microsoft Corporation.  All Rights Reserved.  Licensed under the MIT License.  See License in the project root for license information.
// ------------------------------------------------------------------------------

'use strict';

var run = function ($scope, url, apiService) {
    $scope.$emit('urlChange', url);
}

var formatXml = function (xml) {
    var reg = /(>)\s*(<)(\/*)/g; // updated Mar 30, 2015
    var wsexp = / *(.*) +\n/g;
    var contexp = /(<.+>)(.+\n)/g;
    xml = xml.replace(reg, '$1\n$2$3').replace(wsexp, '$1\n').replace(contexp, '$1\n$2');
    var pad = 0;
    var formatted = '';
    var lines = xml.split('\n');
    var indent = 0;
    var lastType = 'other';
    // 4 types of tags - single, closing, opening, other (text, doctype, comment) - 4*4 = 16 transitions 
    var transitions = {
        'single->single': 0,
        'single->closing': -1,
        'single->opening': 0,
        'single->other': 0,
        'closing->single': 0,
        'closing->closing': -1,
        'closing->opening': 0,
        'closing->other': 0,
        'opening->single': 1,
        'opening->closing': 0,
        'opening->opening': 1,
        'opening->other': 1,
        'other->single': 0,
        'other->closing': -1,
        'other->opening': 0,
        'other->other': 0
    };

    for (var i = 0; i < lines.length; i++) {
        var ln = lines[i];
        var single = Boolean(ln.match(/<.+\/>/)); // is this line a single tag? ex. <br />
        var closing = Boolean(ln.match(/<\/.+>/)); // is this a closing tag? ex. </a>
        var opening = Boolean(ln.match(/<[^!].*>/)); // is this even a tag (that's not <!something>)
        var type = single ? 'single' : closing ? 'closing' : opening ? 'opening' : 'other';
        var fromTo = lastType + '->' + type;
        lastType = type;
        var padding = '';

        indent += transitions[fromTo];
        for (var j = 0; j < indent; j++) {
            padding += '\t';
        }
        if (fromTo == 'opening->closing')
            formatted = formatted.substr(0, formatted.length - 1) + ln + '\n'; // substr removes line break (\n) from prev loop
        else
            formatted += padding + ln + '\n';
    }

    return formatted;
};

var showDuration = function($scope, startTime) {
    var endTime = new Date();
    $scope.duration = (endTime.getTime() - startTime.getTime());
    $scope.requestInProgress = false;
}



var showHeaders = function($scope, headers, status) {
   var responseObj = {};
    if (headers != null) {
        responseObj = headers();
    }
    
    responseObj["Status Code"] = status;
    var responseHeaders = headersToString(responseObj);
    
    $scope.jsonViewer.getSession().setValue("");
    $scope.jsonViewer.getSession().insert(0, responseHeaders);
}

var headersToString = function(headers){
      var returnStr = "";
      for(var key in headers) {
          returnStr += key + ": " + headers[key] + "\n";
      } 
    return returnStr;
}

var showResults = function ($scope, results, headers, status) {
    $scope.jsonViewer.setValue("");
    showHeaders($scope, headers, status);
    $scope.jsonViewer.getSession().insert(0, results);
}

var handleImageResponse = function ($scope, apiService, startTime, headers, status, handleUnsuccessfulQueryResponse) {
    apiService.performQuery('GET_BINARY')($scope.text).then(function(result) {
        var blob = new Blob( [ result.data ], { type: "image/jpeg" } );
        var imageUrl = window.URL.createObjectURL( blob );

        document.getElementById("img").src = imageUrl;
        $scope.showImage = true;
        showHeaders($scope, result.headers, result.status);
        showDuration($scope, startTime);
    }, handleUnsuccessfulQueryResponse);
}

function handleHtmlResponse ($scope, startTime, results, headers, status) {
    setJsonViewerContentType("html");
    showDuration($scope, startTime);
    showResults($scope, results, headers, status);
}

function handleJsonResponse ($scope, startTime, results, headers, status) {
    setJsonViewerContentType("json");
    results = JSON.stringify(results, null, 4);
    showDuration($scope, startTime);
    showResults($scope, results, headers, status);
}

function handleXmlResponse ($scope, startTime, results, headers, status) {
    setJsonViewerContentType("xml");
    results = formatXml(results);
    showDuration($scope, startTime);
    showResults($scope, results, headers, status);
}

function isImageResponse (headers) {
    var contentType = getContentType(headers);
    return contentType === "application/octet-stream" || contentType.substr(0, 6) === "image/";
}

function isHtmlResponse (headers) {
    var contentType = getContentType(headers);
    return contentType === "text/html" || contentType === "application/xhtml+xml";
}

function isXmlResponse (results) {
    // Don't use headers, cos xml could be of a million content types.
    return JSON.stringify(results, null, 4).indexOf("<?xml") != -1;
}

function isJsonResponse (headers) {
    var contentType = getContentType(headers);
    return contentType === "application/json";
}

function getContentType (headers) {
    var full = headers("content-type");
    var delimiterPos = full.indexOf(";");
    if (delimiterPos != -1) {
        return full.substr(0, delimiterPos);
    } else {
        return full;
    }
}



function getEntitySets (XML) {
    var entitySetArray = {};
    var entitySets = $(($.parseHTML(XML))[2]).find("EntityContainer")[0].children;
    for(var i=0; i<entitySets.length; i++){
           var EntitySet = {};
           var name = entitySets[i].attributes[0].nodeValue;
           name = name.substring(2, name.length-2);
           EntitySet.name = name;
           EntitySet.isEntitySet = true;
           EntitySet.URLS = [];
           var type = entitySets[i].attributes[1].nodeValue;
           var index = type.indexOf("graph.")
           type = type.substring(index+6, type.length-2);
           EntitySet.entityType = type;
           entitySetArray[EntitySet.name] = EntitySet;
    }
    return entitySetArray;
}



function findNameIndex (array) {
    for(var i=0; i<array.length; i++) {
        if(array[i].name === "name") {
            return i;
        }
    }
}

function findTypeIndex (array) {
    for(var i=0; i<array.length; i++){
        if(array[i].name === "type"){
            return i;
        }
    }
}

function formatRequestHeaders (headers){
    var obj = {};
    var parts = headers.replace(/^\s+|,\s*$/g, '').split('\n');
    
    for(var i = 0, len = parts.length; i < len; i++) {
        var match = parts[i].match(/^\s*"?([^":]*)"?\s*:\s*"?([^"]*)\s*$/);
        if(match) {
            obj[match[1]] = match[2];
        }
    }
    
   return obj; 
}

function createEntityTypeObject (returnArray, DOMarray) {
    for(var i=0; i<DOMarray.length; i++){
           var EntityType = {};
           var name = DOMarray[i].attributes["name"].nodeValue;
           name = name.substring(2, name.length-2);
           EntityType.name = name;
           EntityType.isEntitySet = false;
           EntityType.URLS = [];
           var children = DOMarray[i].children;
           for(var j=0; j<children.length; j++){
                 if(children[j].attributes.length > 0){
                     var nameIndex = findNameIndex(children[j].attributes);
                     var typeIndex = findTypeIndex(children[j].attributes);
                     var childName = children[j].attributes[nameIndex].nodeValue;
                     childName = childName.substring(2, childName.length-2);
                     var collection = children[j].attributes[typeIndex].nodeValue;
                     collection = collection.substring(2, 12);
                     var type = children[j].attributes[typeIndex].nodeValue;
                     var index = type.lastIndexOf(".")
                     type = type.substring(index+1, type.length-2);
                     if(type.charAt(type.length-1) == ")"){
                         type = type.substring(0, type.length-1);
                     }
                     var urlObject = {};
                     urlObject.isACollection = (collection === "Collection") && (index >0);
                     urlObject.name = childName;
                     urlObject.type = type;
                     EntityType.URLS.push(urlObject);
                 }
           }
        
            returnArray[EntityType.name] = EntityType;
    }    
    return returnArray;
}

function showRequestHeaders ($scope) {
    if (!$scope.jsonEditorHeaders) return;
    $scope.jsonEditorHeaders.getSession().setValue("");
    var requestHeaders = "Content-Type: application/json"
    $scope.jsonEditorHeaders.getSession().insert(0, requestHeaders);
}

function getEntityTypes (XML){
    var entityTypesArray = {};
    var entityTypes = $(($.parseHTML(XML))[2]).find("EntityType");
    entityTypesArray = createEntityTypeObject(entityTypesArray, entityTypes);
    
    var complexTypes = $(($.parseHTML(XML))[2]).find("ComplexType");
    entityTypesArray = createEntityTypeObject(entityTypesArray, complexTypes);
    
    return entityTypesArray;
}

function myTrim (word){
      var returnWord = word;
      if(returnWord != null){
          while(returnWord.charAt(returnWord.length-1) == "/" ){
              returnWord = returnWord.replace(/\/$/, "");
          }
          return returnWord; 
      }
} 

function getEntityName (URL){
     var returnWord = myTrim(URL);
     if(returnWord != null){
         returnWord = returnWord.substring(returnWord.lastIndexOf("/")+1, returnWord.length);
     }
     return returnWord;
}


function getPreviousCall (URL, entityName){
    var index = URL.indexOf(entityName);
    return URL.substr(0, index-1);
}


function setEntity (entityItem, service, lastCallSuccessful) {
    
   if (getEntityName(service.text) == service.selectedVersion) {
             var entityObj = {};
             entityObj.name = service.selectedVersion;
             service.entity = entityObj; 
             return;
    } else {
       var entityName = getEntityName(service.text);
    }
    
    var prevCallName = getEntityName(getPreviousCall(service.text, entityName));
    var twoPrevCallsName = getEntityName(getPreviousCall(getPreviousCall(service.text, entityName), prevCallName));
    if (entityName === "me" && lastCallSuccessful) {
        prevCallName = "users";
    } else if (twoPrevCallsName === "me" && lastCallSuccessful) {
        twoPrevCallsName = "user";
    }
    
    var entitySet = service.cache.get(service.selectedVersion + "EntitySetData")[prevCallName];
    var entityType = service.cache.get(service.selectedVersion + "EntityTypeData")[prevCallName]; 
    var twoPrevEntityType = service.cache.get(service.selectedVersion + "EntityTypeData")[twoPrevCallsName];
    var twoPrevEntitySet = service.cache.get(service.selectedVersion + "EntitySetData")[twoPrevCallsName];
    var collection = false;
    if (twoPrevEntitySet) {
        for(var i=0; i<twoPrevEntitySet.URLS.length; i++){
            if(twoPrevEntitySet.URLS[i].name == prevCallName){
                collection = twoPrevEntitySet.URLS[i].isACollection;
            }
        }
    } else if (twoPrevEntityType) {
        for(var i=0; i<twoPrevEntityType.URLS.length; i++){
            if(twoPrevEntityType.URLS[i].name == prevCallName){
                collection = twoPrevEntityType.URLS[i].isACollection;
                var collectionType = twoPrevEntityType.URLS[i].type;
                break;
            }
        }
    }
    
    service.entityNameIsAnId =
        (((entitySet && !entityType) || (entitySet && twoPrevCallsName === service.selectedVersion))
        && lastCallSuccessful && (prevCallName != "me"))
        || (collection && lastCallSuccessful);
    
    if (service.entityNameIsAnId) {
        //$log.log("entity name is an id");
        var typeName;
        if (collection) {
            //$log.log("is a collection");
            typeName = collectionType;
            //$log.log(typeName);
        } else if (entitySet) {
            typeName = entitySet.entityType;
        }

        service.entity = service.cache.get(service.selectedVersion + "EntityTypeData")[typeName];
    }
    else {
        if (!entityType && entitySet) {
            entityType = setToSetOrType(service, entitySet.entityType);
        }

        if (entityType) {
            
            // IE claims array.find code below has syntax error, probably due to lack of support.
            // var matchingElement = entityType.URLS.find(u => u.name === entityName && !u.isACollection);
            var matchingElement = null;
            for (var i = 0; i < entityType.URLS.length; i++) {
                if (entityType.URLS[i].name == entityName && !entityType.URLS[i].isACollection) {
                    matchingElement = entityType.URLS[i];
                    break;
                }
            }

            if (matchingElement) {
                service.entity = setToSetOrType(service, matchingElement.type);
            }
            else {
                service.entity = null;
            }
        } else {
            service.entity = setToSetOrType(service, entityName, prevCallName);
        }
    }
}

function setToSetOrType (service, entityName, prevCallName) {
      var isEntitySet = service.cache.get(service.selectedVersion + "EntitySetData")[entityName];
      var isEntityType = service.cache.get(service.selectedVersion + "EntityTypeData")[entityName];
      if(isEntitySet && !isEntityType){
          return isEntitySet;
      }else if(isEntityType && !isEntitySet){
          return isEntityType;
      }else if(isEntitySet && isEntityType){
           if(prevCallName === service.selectedVersion){
               return isEntitySet
           }else{
               return isEntityType;
           }
      }
    
}

function showRequestBodyEditor () {
    s.tabConfig.disableRequestBodyEditor = false;
    s.tabConfig.hideContent = false;
    showRequestHeaders(s);
    $(function() {
        initializeJsonEditor(s);
        setSelectedTab(1);
    })
}

function setSelectedTab (num) {
    if (num >= 2 || num < 0) {
        return;
    }
    s.tabConfig.selected = num;
    s.tabConfig.previousSelected = s.tabConfig.selected;
}

function handleQueryString (service, actionValue, versionValue, requestValue) {
    if(actionValue){
        service.selectedOption = actionValue.toUpperCase();
        if(service.selectedOption === 'POST' || service.selectedOption === 'PATCH') {
            if(hello('msft').getAuthResponse() != null)
                showRequestBodyEditor();
        }
   }
        
   if (versionValue) {
        service.selectedVersion = versionValue;
   }
   if (requestValue) {
        service.text = "https://graph.microsoft.com/" + service.selectedVersion + "/" + requestValue;
   }
}

function parseMetadata (service, $scope){
    var entitySetData, entityTypeData;
    if(!service.cache.get(service.selectedVersion + "Metadata")) {
         console.log("parsing metadata");
         service.getMetadata().then(function(results) {
                results = JSON.stringify(results).trim();
                service.cache.put(service.selectedVersion + "Metadata", results);
                entitySetData = getEntitySets(results);
                service.cache.put(service.selectedVersion + "EntitySetData", entitySetData);
                entityTypeData = getEntityTypes(results);
                service.cache.put(service.selectedVersion + "EntityTypeData", entityTypeData);
                console.log("metadata successfully parsed");
                if(service.entity == ""){
                    service.entity = entityTypeData["user"];
                }else{
                    service.entity = entityTypeData[getEntityName(service.text)];
                }
                
          $scope.$root.$broadcast("updateUrlOptions");
         }, function(err, status){
            console.error("metadata could not be parsed");
         });
     } else {
          $scope.$root.$broadcast("updateUrlOptions");
     }
}