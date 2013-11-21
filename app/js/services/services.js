// Services.js
//TODO: Define API for getting data from the server - providing query data, simple table names, etc.

(function (angular) {
  'use strict';
  
  var services = angular.module('kpk.services', []);
    
  //FIXME: depricated - yo
  services.service('kpkConnect', function($http) { 
    this.fetch = function(table, columns, where, value) {     
      var query = { 
        e: [{t : table, c : columns}]
      };
      
      if(where) { 
        query.c = [{t : table, cl : where, v : value, z : '='}];
      }
      
      var promise = $http.get('/data/?' + JSON.stringify(query)).then(function(result) { 
          // I can now manipulate the data before returning it if needed
          return result.data;
        });
        return promise;
    };
    
    //Because TODO
    this.raw_fetch = function(qeury_object) { 
      var promise = $http.get('/data/?' + JSON.stringify(qeury_object)).then(function(result) { 
        return result.data;
      });
      return promise;
    };

    
    this.get = function(target, requestObject){
      var promise = $http.get(target + JSON.stringify(requestObject)).then(function(result) { 
        return result.data;
      });
      return promise;
  };

  this.send = function(table, data) { 
    var sql= {t:table, data:data};
    $http.post('data/',sql);
  };
  this.sendTo = function(target, table, data) { 
    var sql= {t:table, data:data};
    $http.post(target,sql);
  };

  this.update = function(objectRequest) { 
    $http.put('data/',objectRequest);
  };

  this.delete = function(table, id) { 
    $http.delete('data/'+id+'/'+table);
  };
  });

  services.service('kpkUtilitaire', function() { 
    this.formatDate = function(dateString) {
      return new Date(dateString).toDateString();
    };

    Date.prototype.toMySqlDate = function (dateParam) {
      console.log("dateParam:", dateParam);
      var date = new Date(dateParam), annee, mois, jour;
      annee = String(date.getFullYear());
      mois = String(date.getMonth() + 1);
      if (mois.length === 1) {
       mois = "0" + mois;
      }

      jour = String(date.getDate());
        if (jour.length === 1) {
          jour = "0" + jour;
      }      
      return annee + "-" + mois + "-" + jour;
    };

    this.convertToMysqlDate = function(dateString) {
      return new Date().toMySqlDate(dateString);
    }
  });

  services.factory('appnotify', function ($q, $timeout) {

//    Allows for multiple notifications - if that's your thing
//    var notifications = [];
    var notification = [];
//    FIXME This is horrible - CSS styles should be applied conditionally with ng-class
    var style = ["notification-success"];
    var timeout = 3000;

    function init() {
//    initialise session variables etc.
    }

    function setNotification(type, header, body, delay) {
//      only one notification allowed at this time
      if (delay) timeout = delay;

      /*if(type) style[0] = "notification-" + type;
       notification.pop();
       notification.push({'type' : type, 'header' : header, 'body' : body, 'delay' : delay});*/
      console.log('[appnotify] setNotification(); populate notification model')
      var handle = $timeout(clearAll, timeout);
    }

    function clearAll() {
      console.log('[appnotify] clearAll(); clear notification model');
      notification.pop();
    }

    /*function registerDisplay()
     *   summary
     *     Any controller can register as a notification display - a callback would be registered
     *     for every time an update is made to notification state
     */

    init();

    return {
//      Is it a good idea to expose this?
      notification: notification,
      setNotification: setNotification,
      clearAll: clearAll,
      style: style
    }
  });

  services.factory('appcache', function($q) { 
    /////
    // summary: 
    //  Used to interface with indexedDB store, providing methods to read and write to local storage
    //  
    // TODO:
    //  -Formalise inner working functions, and expose high level requests (storage for page save, namespacing etc.)
    //  -Use multiple indexs (injected on request)
    /////
    console.log("appcache initialised");

    var cache_supported;
    if("indexedDB" in window) { 
      cache_supported = true;
    }

    //variables inside if(cache_supported)? no need to initialise otherwise
    var db;
    var version = 2;

    var instance = { 
      add: add,
      getNav: getNav,
      cacheNav: cacheNav
    };

    var queue = [];

    //Methods for storing navigation data - FIXME: Should service be more abstract than this?
    function getNav() { 
      //FIXME: Redo this function/ queue system
      var deferred = $q.defer();

      if(!db) { 
        queue.push(fetch);
      } else { 
        fetch();
      }

      function fetch() { 
        getByIndex("cache_nav").then(function(res) { 
          if(res) { 
            deferred.resolve(res.value);
          } else { 
            deferred.resolve(res);
          }
        });
      }

      return deferred.promise;
    }

    function cacheNav(nav_string) {

      if(!db) { 
        queue.push(commit);
      } else { 
        commit();
      }

      function commit() { 
        var promise = getByIndex("cache_nav");
        promise
        .then(function(res) { 
          if(!res) { 
            return add({"ref": "cache_nav", "value" : ""});
          }
        });
      }
      
      update("cache_nav", "value", nav_string);
    }

    //TODO
    function saveSessionModel(unit, model) {

    }

    function init() { 
      var req = indexedDB.open("kpk", version);

      req.onupgradeneeded = function(e) { 
        //summary: 
        //  user is either new, or a newer version of the database is available, run database settup 
        console.log("[appcache] upgrading indexed");
        var checkDB = e.target.result;

        if(!checkDB.objectStoreNames.contains("session")) { 
          var store = checkDB.createObjectStore("session",  {autoIncrement: true});
          store.createIndex("ref", "ref", {unique:true});
        }
      }

      req.onsuccess = function(e) { 
        db = e.target.result;

        //Call all methods requested befored db init
        queue.forEach(function(callback) { 
          callback();
          //delete callback
        });
        
      }

      req.onerror = function(e) { 
        throw new Error(e);
      }
    }

    function add(object) { 
      var deferred = $q.defer();
      if(db) { 
        var transaction = db.transaction(["session"], "readwrite");
        var store = transaction.objectStore("session");

        var req = store.add(object);

        req.onerror = function(e) { 
          console.log("[appcache] Failed to write", e);
          return;
        }

        req.onsuccess = function(e) { 
          //success
          console.log("[appcache] object written");
          deferred.resolve(e.target.value);
        }
      }
      return deferred;
    }

    function put(object) { 
      if(db) { 
        var transaction = db.transaction(["session"], "readwrite");
        var store = transaction.objectStore("session");
        
        var req = store.put(object);

        req.onsuccess = function(e) { 
          console.log("Value updated", object);
        }

        req.onerror = function(e) { 
          console.log("[appcache] Failed to put", e);
        }
      }
    }

    function update(key, field, value) { 
      if(db) { 
        var transaction = db.transaction(["session"], "readwrite");
        var store = transaction.objectStore("session");
        var index = store.index("ref");
        var key_range = IDBKeyRange.only(key);
        
        var req = index.openCursor(key_range);

        req.onsuccess = function(e) { 
          var cursor = e.target.result;
          if(cursor) { 
            //gauranteed to only be one object given key range / key
            var res = cursor.value;
            res[field] = value;
            cursor.update(res);
          }
          console.log("[appcache] updated", key);
        }

        req.onerror = function(e) { 
          console.log("[appcache] Failed to update");
        }
      }
    }

    function get(key) { 
      var transaction = db.transaction(["session"], "readonly");
      var store = transaction.objectStore("session");

      var req = store.get(key);

      req.onsuccess = function(e) { 
        console.log("[appcache] Read success", e);
        console.log("[appcache] Result", e.target.result);
        return e.target.result;
      }

      req.onerror = function(e) { 
        console.log("[appcache] Failed to read", e);
      }

    }

    function getByIndex(key) { 
      var deferred = $q.defer();
      var transaction = db.transaction(["session"], "readonly");
      var store = transaction.objectStore("session");
      var index = store.index("ref");
      
      var req = index.get(key);

      req.onsuccess = function(e) { 
        console.log("[appcache] Read success", e);
        console.log("[appcache] Result", e.target.result);
        deferred.resolve(e.target.result);
      }

      req.onerror = function(e) { 
        console.log("[appcache] Failed to read", e);
      }

      return deferred.promise;
    }

    function requestAll() { 
      //summary: 
      //  indexedDB cursor demonstration
      var transaction = db.transaction(["session"], "readonly");
      var store = transaction.objectStore("session");

      var cursor = store.openCursor();

      cursor.onsuccess = function(e) { 
        var res = e.target.result;
        if(res) { 
          console.log("key", res.key, "data", res.value);
          res.continue();
        }
      }

      cursor.onerror = function(e) { 
        console.log("[appcache] Failed to read cursor");
      }
    }

    if(cache_supported) { 
      init();
    }

    return instance;

  });

  services.factory('appstate', function($q) { 
    /////
    // summary: 
    //  generic service to share values throughout the application by id - returns a promise that will either be populated or rejected
    //  to allow asynchronous loading
    // 
    // example:
    //  ensuring multiple values are set before loading a page (vs. only registering one dependency)
    /*  function fetch() { 
          var promise = fechFirst();
          //see also: $q.all()
          fetchFirst.then(function(res) { 

            return fetchSecond();
          })
          .then(function(res) { 

          });
        }
        function fetchFirst() { 

        }

        function fetchSecond() { 

        }
    */
    //  TODO
    //    -Unregister callbacks form unit/module, these could be auto unhooked from application controller?
    /////
  
    var instance = {
      //summary: 
      //  expose required function to Angular modules, all other functions are considered private
      id: Date.now(),
      get: get,
      set: set,
      register: register,
      update: update
    };

    var comp = {};
    var queue = {};

    function set(comp_id, ref) { 
      //summary: 
      //  Assign id reference to value
      comp[comp_id] = ref;
    }

    function get(comp_id) { 
      //summary: 
      //  Reference to value by di
      return comp[comp_id];
    }

    function register(comp_id, callback) { 
      var id = this.id;
      if(!queue[comp_id]) { 
        queue[comp_id] = [];
      }

      queue[comp_id].push({ref: this, callback: callback});
      //init call to pass current value
      if(comp[comp_id]) { 
        callback(comp[comp_id]);
      }
    }

    function update(comp_id, value) { 
      comp[comp_id] = value;
      var l = queue[comp_id];
      if(l) { 
        l.forEach(function(recept) { 
          console.log("Attempting callback", comp[comp_id]);
          recept.callback(comp[comp_id]);
        });
      }
    }

    return instance;
  });

  services.factory('connect', function ($http, $q) {
    //summary: 
    //  provides an interface between angular modules (controllers) and a HTTP server. Requests are fetched, packaged and returned
    //  as 'models', objects with indexed data, get, delete, update and create functions, and access to the services scope to 
    //  update the server.

    //  TODO generic id property should be injected, currently set as ID
    //  TODO set flag for automatically flushing model updates to server
    //  TODO anonymous functions make for bad stack traces - name those bad boys

    //keep track of requests, model can use connect API without re-stating request
    //  model : request
    var requests = {};

    function req (defn) {
      //summary: 
      //  Attempt at a more more managable API for modules requesting tables from the server, implementation finalized
      //
      //  defn should be an object like
      //  defn =  {
      //    tables : {
      //      'account' : {
      //        columns: [ 'enterprise_id', 'id', 'locked', 'account_text']
      //      },
      //      'account_type' : {
      //        columns: ['type']
      //      }
      //    },
      //    join: ['account.account_type_id=account_type.id'],
      //    where: ['account.enterprise_id=101']
      //  };
      //
      //  where conditions can also be specified:
      //    where: ['account.enterprise_id=101', 'AND', ['account.id<100', 'OR', 'account.id>110']]
      var handle, deferred = $q.defer();

      handle = $http.get('/temp/?' + JSON.stringify(defn));
      handle.then(function (returned) {
        var table = defn.primary || Object.keys(defn.tables)[0];
        var m = new Model(returned, table);
        requests[m] = defn;
        deferred.resolve(m);
      });

      return deferred.promise;
    }

    function Model (options, target) {
      // the data store, similar to Dojo's Memory Store.
      options = options || {};

      // globals
      this.index = {};
      this.data = {};

      // locals
      var queue = [];
      var identifier = options.identifier || 'id'; // id property
      var pprint = '[connect] ';
      var tgt = "/temp/"; // temporary target until we standardize connect.
      var refreshrate = options.refreshrate || 500;

      // set an array of data
      this.setData = function (data) {
        var index = this.index = {};
        this.data = data;

        for (var i = 0, l = data.length; i < l; i++) {
          index[data[i][identifier]] = i;
        }
      };

      // constructor function
      var self = this;
      (function contructor () {
        for (var k in options) {
          self[k] = options[k]; 
        }
        // set data if it is defined
        if (options.data) self.setData(options.data);
        // set up refreshrate
      })();

      // get an item from the local store
      this.get = function (id) {
        return this.data[this.index[id]];
      };

      // put is for UPDATES 
      this.put = function (object, opts) {
        var data = this.data,
            index = this.index,
            id = object[identifier] = (opts && "id" in opts) ? opts.id : identifier in object ?  object[identfier] : false;
      
        if (!id) throw pprint + 'No id property in the object.  Expected property: ' + identifier;  

        // merge or overwrite
        if (opts && opts.overwrite) {
          data[index[id]] = object; // overwrite
        } else {
          var ref = data[index[id]];
          for (var k in object) {
            ref[k] = object[k]; // merge
          }
        }
        // enqueue item for sync
        queue.push({method: 'PUT', url: tgt + target});
      };

      // post is for INSERTS
      this.post = function (object, opts) {

        var data = this.data,
            index = this.index,
            id = object[identifier] = (opts && "id" in opts) ? opts.id : identifier in object ?  object[identfier] : Math.random();
        if (id in index) throw pprint + 'Attempted to overwrite data with id: ' + id + '.';
        index[id] = data.push(object) - 1;
        // enqueue item for sync
        queue.push({method: 'POST', url: tgt + target, data: object});
      };

      this.remove = function (id) {
        var data = this.data,
            index = this.index;
        
        if (id in index) {
          data.split(index[id], 1);
          this.setData(data);
          queue.push({method: 'DELETE', url: tgt + target + '/' + id});
        }
      };

      this.generateid = function () {
        // generate a new id by incrimenting the last id
        // in the store
        var id = Math.max.apply(Math.max, Object.keys(this.index)) + 1;
        return (id > 0)  ? id : 1;
      };

      this.contains = function (id) {
        // check to see if an object with
        // this id exists in the store.
        return !!this.get(id);
      };

      this.sync = function () {
        // sync the data from the client to the server
        var fail = [];
        queue.forEach(function (req) {
          console.log(pprint, 'Executing: ', req);
          $http(req)
            .success(function () {
              console.log(req.data.id, "synced successfully."); 
            }) 
            .error(function (data, status, headers, config) {
              alert("An error in data transferred occured with status:", status); 
              fail.push(req);
            });
        });
        queue = fail;
      };

      return this;
    }

    function journal(invoice_ids) {
      return $http.post('/journal/', invoice_ids);
    }

    function basicGet(url) {
      return $http.get(url);
    }

//    FIXME accepts any request (temporarily making up for 'req()' shortcomings) this should be deprecated
    function basicReq(reqobj) {
      //summary: 
      //  return a packaged model given a straight request object
      var deferred = $q.defer();
      var model = {};
      var handle = $http.get('/data/?' + JSON.stringify(reqobj)).then(function (returned) {
        var m = packageModel(model, returned.data);
        //unable to uniformly set request object, this will cause a problem
        requests[m] = reqobj;
        deferred.resolve(m);
      });

      return deferred.promise;
    }

    function basicDelete (table, id) {
      // deletes something from the table `table` where id is `id` 
      $http.delete('/data/'+id+'/'+table);
    }

//    TODO reverse these two methods? I have no idea how this happened
    function basicPut(table, object) {
      var format_object = {t: table, data: object};
      return $http.post('data/', format_object);
    }

    function basicPost(table, object, primary) {
      var format_object = {t: table, data: object, pk: primary};
      return $http.put('data/', format_object);
    }

    //Check we haven't made this query before this session, check we don't have the data stored in local storage
    //-verify version numbers of data if it has been cached (see priority levels etc.)
    function referenceQuery (query) {}

    return {
      req: req,
      basicReq: basicReq,
      basicPut: basicPut,
      basicPost: basicPost,
      basicGet: basicGet,
      basicDelete: basicDelete,
      journal: journal
    };
  });

})(angular);
