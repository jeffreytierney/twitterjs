(function(_name, _ns) {
  // first we need to figureout if this is going in some existing namespace or not
  // was a second param passed to the wrapped anonymous function for a namespace or not?
  // if so, we need it to be a string so we can eval it and use the eval'd object as the namespace
  // otherwise use window
  var _ns_string = _ns || false;
  _ns = _ns ? eval(_ns) : window;
  _name = _name || "TWITTER";

  // initialize the local $ variable for internal references to the class
  // and assign both the $ and the actual publicly accessible variable (that may or may not be namespaced)
  // to the class we are creating.
  var $;
  /**
  *  Initializes the TWITTER class
  *
  *  @constructor
  *  @this {TWITTER}
  *  @param {object} params An object literal of configuration parameters (not currently used)
  */
  _ns[_name] = $ = function(params) {
    this._init(params);
  }

  // also store the string version of the namespaced location of this class for future reference
  // this is necessary for properly namespacing the jsonp callbacks in the urls
  _name = _ns_string ? _ns_string+"."+_name : _name;

  // create an array that we will use to store callbacks for the class
  // this needs to be global for all instances of the class because we need the functions to be
  // globally accessible when the callbacks fire
  $["_callbacks"] = [];

  // set up the prototype for the class
  $.prototype = {
    // defining the prototype as an object literal paves the constructor property
    // so we just re-set that here while we still have a reference to the original
    constructor: $.prototype.constructor,

    /**
    *  Handles actual initializion of the TWITTER class, and calls whatever internal methods
    *    are necessary to do so (right now, only one)
    *
    *  @this {TWITTER}
    *  @param {object} params An object literal of configuration parameters (not currently used)
    *  @return {@this}
    */
    _init: function(params) {
      this._initializeFunctions();
      return this;
    },
    /**
    *  This method iterates through the namespaces and methods defined for the api
    *    and creates a namespace or method on the prototype of the TWITTER object for each
    *    so very meta :)
    *
    *  @this {TWITTER}
    *  @return {@this}
    */
    _initializeFunctions: function() {
      var namespaces = this._functions;
      var _this = this;

      for (var ns in namespaces) (function(ns, funcs) {

        // since namespaces are top level, at this point we wont have an existing one on the prototype
        // so we dont need to check for existence... just create
        $.prototype[ns] = {};

        // then, for each function defined in that namespace
        for(var func in funcs) (function(func, options) {
          // create a function that will call the generic "make request" function
          // but with all of the data specific to this api method
          var _func = function(params) {
            options.url = options.url.replace(".format", "."+_this.options.format);
            $.prototype._make_request.call(_this, ns, func, options, params);
          }
          // if the name of the method is the same as the namespace (for example, search)
          // then dont require the call to be TWITTER.search.search...
          // just make the top level of the namespace the function
          // otherwise, add it to the namespace that has already been created
          if(func == ns) { $.prototype[ns] = _func; }
          else { $.prototype[ns][func] = _func; }
        })(func, funcs[func]);
      })(ns, namespaces[ns]);

      // in order to preserve the state of the values of the iterators, (on both loops above)
      // instead of just having a regular block execute, we execute an anonymous function with
      // the iterator values as parameters

      return this;
    },
    /**
    *  This is the generic method that gets used as the basis for creating all of the individual API methods
    *    when _initializeFunctions is called.  twitter's api methods are similar enough in the format of data that they accept
    *    and return, that one generic function can be used, with just some differing inputs in order to access all of them
    *
    *  @this {TWITTER}
    *  @param {string} ns       this is the namespace in which the function being called lives (such as search, or user)
    *  @param {string} func     this is the name of the actual method being called (such as rate_limit_status)
    *  @param {object} options  this is the hash of options that comes from the method definition object (stored in the _functions hash fo the prototype)
    *                           this is used to define the api method call iteself (options such as url, and required params)
    *                           and is not the user defined (call specific) parameters that are defined at method call timee
    *  @param {object} params   these are the user defined params that will change on a call by call basis...
    *                           these are the actual api method inputs, rather than the data used to define the method itself
    *  @return {@this}
    */
    _make_request: function(ns, func, options, params) {

      var url = options.url;
      var q_string = "";

      // this library is currently is purely jsonp unauthenticated calls to the api, so if the method requires authentication throw an exception
      // there are plans for allowing this library to be used for hooking into a server side proxy to handle auth, but its not yet implemented
      if(options.auth_req && this.options.proxy === false) {
        throw("function " + ns + "/" + func + " requires authentication, and must use a proxy");
      }

      // check for any required parameters on this method
      if(options.required) {
        // and throw if they are not provided
        // otherwise, replace the placeholders set in the url (starts with : like :id) with the proper values
        if(typeof params === "undefined") throw("function " + ns + "/" + func + " has required params");
        var req = options.required;
        for(var i in req) {
          if(!params.hasOwnProperty(i) && (req[i]===0 || (req[i]>0 && this.options.proxy === false))) throw("no required param " + i + " in call to function " + ns + "/" + func);
          else {
            var existed = (url.indexOf(":"+i) > -1);
            url = url.replace(":"+i, params[i]);
            if(existed) params[i] = null;
          }
        }
      }

      // set up default params (or preserve values passed in)
      params = params || {};

      var user_cb = params["callback"] || function(data, meta){/*alert("do something by default: " + data);*/};
      var user_error = params["error"] || function(data, meta){/*alert("something errored out");*/};
      var _this = this;
      var _options = options;
      var scope = params["cb_scope"] || window;

      // set up the callback object for this method call...
      // we need options for success and error
      var cb_id = $["_callbacks"].push({"success":function(data) {
          // some methods return certain values that are jsut metadata to the actual response data
          // we want to filter those out and store them separately
          var meta = {};
          if(_options.meta) {
            for(var i=0, len=_options.meta.length; i<len; i++) {
              if(data.hasOwnProperty(_options.meta[i])) {
                meta[_options.meta[i]] = data[_options.meta[i]];
              }
            }
          }
          // also, some methods return with the important data under a root property in the full response payload
          // if that is the case, make sure we drill down to the right level
          if(_options.root && data.hasOwnProperty(_options.root)) data = data[_options.root];

          // then take the data, and pass it to the proper callback method... success or error depending on the response.
          if(!data.error) {
            try {
              user_cb.call(scope, data, meta);
            }
            catch(ex) {
              _this._log(ex.message)
              user_error.call(scope);
            }
          }
          else {
            user_error.call(scope, data.error);
          }
        // finally, do some garbage collection on the script elements added in to the page for the jsonp call
        _this._gc_jsonp(cb_id);

      },"error":function() {

        user_error.call(scope);
      }}) - 1;

      // due to a change twitter introduced in the way callbacks were wrapped around the data
      // this needed to be added in in order to make sure that the callback method was accessible using
      // a string representation of the full dot notation path to the proper object stored on the twitter object
      $["_callbacks"]['_'+cb_id] = $["_callbacks"][cb_id];
      params["callback"] = _this._name+"._callbacks._"+cb_id+".success";

      // if there are additional query params that don't get added into parts of the base url
      // add them as a query string
      if(options.takes_params) {
        var params_array = [];
        for(var param in params) {
          if(params[param] !== null) {
            params_array.push(param + "=" + encodeURIComponent(params[param]));
          }
        }
        if(params_array.length) {
          q_string = "?"+params_array.join("&");
        }
      }
      // otherwise just make sure we at least have the callback method name written out as the callback query param
      else {
        q_string = "?callback="+encodeURIComponent(params["callback"]);
      }

      url += q_string;

      // make the actual jsonp call
      this._jsonp_call(url, cb_id);

      return this;

    },
    // basic logging function for debugging...
    // i don't like the try / catch, but dislike throwing unwanted exceptions for something like debugging even more
    _log: function(msg) {
      try{
      if(console) console.log(msg);
      }catch(ex) { /*alert(msg);*/ }
    },
    /**
    *  This is the generic method that gets used as the basis for creating all of the individual API methods
    *
    *  @this {TWITTER}
    *  @param {string} url    the url that will get written to the dynamic script tag (with all query params attached)
    *  @param {string} cb_id  the id of the callback that is associated with this method... used to make sure that we have the right one
    *                         when simulating the timeout error handler
    *  @return {@this}
    */
    _jsonp_call: function(url, cb_id) {

      // set up the script element, and get the reference to where we want to put it
      // TODO: not make it rely on a head existing... its ok in most cases, but not bulletproof
      var s = document.createElement("script");
      s.setAttribute("src", url);
      s.setAttribute("type", "text/javascript");
      s.setAttribute("id", this._name+"_script_"+cb_id);
      var head = document.getElementsByTagName("head")[0];

      // get a reference to the proper error handler that we will be using for timeout
      var error = $["_callbacks"][cb_id].error;
      // Attach handlers for all browsers
      var _cb_id = cb_id;
      var _this = this;
      // do some cross browser feature detection trickery to check for the load / or readystatechange event
      // on the script tag, so that we can tell if it loads in time... and if not, fire out the timeout call
      s.onload = s.onreadystatechange = function(){
        if ( !$["_callbacks"][_cb_id].done && (!this.readyState ||
          this.readyState == "loaded" || this.readyState == "complete") ) {
          var cb_id = _cb_id;
          // after we have loaded, we need to do some garbage collection (just wait 100ms to let the callback execute first
          setTimeout(function() {
            if(!$["_callbacks"][cb_id].done) {
              _this._gc_jsonp(cb_id);
              error();
            }
          }, 100);
        }
      };

      // some browsers actually support the onerror event on a script tag... so lets just use that if they do
      s.onerror = function() {
        _this._gc_jsonp(_cb_id);
        error();
      }

      // add the script tag, and away we go
      head.appendChild(s);

      // set the timeout to fire if the call doesnt return fast enough
      $["_callbacks"][cb_id].timer = setTimeout(function() {
        if($["_callbacks"][_cb_id].error) {
          $["_callbacks"][_cb_id].error();
          _this._gc_jsonp(_cb_id, true);
        }
      }, this.options.timeout);

      return this;
    },

    /**
    *  We dont want to let arbitrarly many script elements to accumulate... so lets do some cleanup
    *
    *  @this {TWITTER}
    *  @param {string} cb_id     the id of the callback that is associated with this method... used to make sure that we have the right one
    *  @param {boolean} timeout  did this gc method get called because we timed out or not
    *  @return {@this}
    */
    _gc_jsonp: function(cb_id, timeout) {
      // we are done
      $["_callbacks"][cb_id].done = true;
      // and if it wasnt a timeout, clear the timeout timer so that we dont try to fire the timeout call
      // in he time that may elapse in processing the actual valid response
      if(!timeout) clearTimeout($["_callbacks"][cb_id].timer)
      // clear out the success and error functions
      // but if it was a timeout, just make it an empty function that is still callable to prevent
      // a case where it may fire before we finish, but is reset to a non-callable object... that would not be fun
      $["_callbacks"][cb_id].success = $["_callbacks"][cb_id].error = timeout ? function() {} : null;
      // get the script... clear out the onload and onreadystate stuffs, and remove
      var script = document.getElementById(this._name+"_script_"+cb_id);
      if(script) {
        script.onload = script.onreadystatechange =script.onerror = null;
        script.parentNode.removeChild(script);
        script = null;
      }
      // amd we are dne with this particular callback, so no need to keep it around.
      delete $["_callbacks"]["_"+cb_id];

      return this;
    },

    options:{
      format: "json",
      proxy: false,
      timeout: 10000
    },
    _functions: {
      "search": {
        "search": {
          auth_req: false,
          url:"http://search.twitter.com/search.format",
          required:{"q":0},
          takes_params: true,
          root: "results",
          meta: ["since_id","max_id","refresh_url","results_per_page","next_page","completed_in","page","query"]
        }
      },
      "trends": {
        "trends": {
          auth_req: false,
          url:"http://search.twitter.com/trends.format",
          takes_params: false,
          meta: ["as_of"],
          root: "trends"
        },
        "current": {
          auth_req: false,
          url:"http://search.twitter.com/trends/current.format",
          meta: ["as_of"],
          root: "trends"
        },
        "daily": {
          auth_req: false,
          url:"http://search.twitter.com/trends/daily.format",
          takes_params: true,
          meta: ["as_of"],
          root: "trends"
        },
        "weekly": {
          auth_req: false,
          url:"http://search.twitter.com/trends/weekly.format",
          takes_params: true,
          meta: ["as_of"],
          root: "trends"
        }
      },
      "statuses": {
        "public_timeline": {
          auth_req: false,
          url:"http://twitter.com/statuses/public_timeline.format",
          takes_params: false
        },
        "user_timeline": {
          auth_req: false,
          url:"http://twitter.com/statuses/user_timeline.format",
          takes_params: true,
          required:{"id":1}
        },
        "show": {
          auth_req: false,
          url:"http://twitter.com/statuses/show/:id.format",
          takes_params: false,
          required: {"id":0}
        },
        "friends": {
          auth_req: false,
          url:"http://twitter.com/statuses/friends/:id.format",
          takes_params: true,
          required: {"id":0}
        },
        "followers": {
          auth_req: false,
          url:"http://twitter.com/statuses/followers/:id.format",
          takes_params: true,
          required: {"id":0}
        }

      },
      "users": {
        "show": {
          auth_req: false,
          url:"http://twitter.com/users/show/:id.format",
          takes_params: true,
          required:{"id":1}
        }
      },
      "lists": {
        "list_statuses": {
          auth_req: false,
          url:"http://api.twitter.com/1/:user/lists/:list_id/statuses.format",
          takes_params: true,
          required:{"user":0,"list_id":0}
        }
      },
      "friendships": {
        "show": {
          auth_req: false,
          url:"http://twitter.com/friendships/show.format",
          takes_params: true
        }
      },
      "friends": {
        "ids": {
          auth_req: false,
          url:"http://twitter.com/friends/ids/:id.format",
          takes_params: true,
          required: {"id":0}
         }
      },
      "followers": {
        "ids": {
          auth_req: false,
          url:"http://twitter.com/followers/ids/:id.format",
          takes_params: true,
          required: {"id":0}
         }
      },
      "account": {
        "rate_limit_status": {
          auth_req: false,
          url:"http://twitter.com/account/rate_limit_status.format",
          takes_params: false
        }
      },
      "favorites": {
        "favorites": {
          auth_req: false,
          url:"http://twitter.com/favorites/:id.format",
          takes_params: false,
          required:{"id":0}
        }
      }
    }
  }
  $.prototype._name = _name;
})();
