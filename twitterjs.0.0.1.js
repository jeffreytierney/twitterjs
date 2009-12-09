(function(_name, _ns) {
  var _ns_string = _ns || false;
  _ns = _ns ? eval(_ns) : window;
  
  var $;
  _ns[_name] = $ = function(params) {
    this._init(params);
  }
  _name = _ns_string ? _ns_string+"."+_name : _name;
  
  $["_callbacks"] = [];
  
  $.prototype = {
    _init: function(params) {
      this._initializeFunctions();
      return this;
    },
    _initializeFunctions: function() {
      var namespaces = this._functions;
      var _this = this;
      
      for (var ns in namespaces) (function(ns, funcs) {
        
        $.prototype[ns] = {};
        
        for(var func in funcs) (function(func, options) {
          $.prototype[ns][func] = function(params) {
            options.url = options.url.replace(".format", "."+_this.options.format);
            $.prototype._make_request.call(_this, ns, func, options, params);
          }
        })(func, funcs[func]);
      })(ns, namespaces[ns]);
      
      return this;
    },
    
    _make_request: function(ns, func, options, params) {

      var url = options.url;
      var q_string = "";
      
      if(options.auth_req && this.options.proxy === false) {
        throw("function " + ns + "/" + func + " requires authentication, and must use a proxy");
      }
      
      if(options.required) {
        if(typeof params === "undefined") throw("function " + ns + "/" + func + " has required params");
        var req = options.required;
        /*
        for(var i=0, len = req.length; i<len; i++) {
          if(!params.hasOwnProperty(req[i])) throw("no required param " + req[i] + " in call to function " + ns + "/" + func);
        }
        */
        for(var i in req) {
          if(!params.hasOwnProperty(i) && (req[i]===0 || (req[i]>0 && this.options.proxy === false))) throw("no required param " + i + " in call to function " + ns + "/" + func);
          else {
            var existed = (url.indexOf(":"+i) > -1);
            url = url.replace(":"+i, params[i]);
            if(existed) params[i] = null;
          }
        }
      }
      
      
      params = params || {};
      
      var user_cb = params.callback || function(data, meta){alert("do something by default: " + data);};
      var _this = this;
      var _options = options;
      var cb_id = $["_callbacks"].push(function(data) {
        var meta = {};
        if(_options.meta) {
          for(var i=0, len=_options.meta.length; i<len; i++) {
            if(data.hasOwnProperty(_options.meta[i])) {
              meta[_options.meta[i]] = data[_options.meta[i]];
            }
          }
        }
        
        if(_options.root && data.hasOwnProperty(_options.root)) data = data[_options.root];
        user_cb(data, meta);
        eval(_this._name)["_callbacks"][cb_id] = null;
        var script = document.getElementById(_this._name+"_script_"+cb_id);
        if(script) {
          script.parentNode.removeChild(script);
          script = null;
        }
      }) - 1;
      
      params.callback = _this._name+"._callbacks['"+cb_id+"']";
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
      else {
        q_string = "?callback="+encodeURIComponent(params.callback);
      }
      
      url += q_string;
      
      this._log(url);
      
      this._jsonp_call(url, cb_id);
      
      return this;
      
    },
    _log: function(msg) {
      try{
      if(console) console.log(msg);
      }catch(ex) { alert(msg); }
    },
    
    _jsonp_call: function(url, cb_id) {
    
      var s = document.createElement("script");
      s.setAttribute("src", url);
      s.setAttribute("type", "text/javascript");
      s.setAttribute("id", this._name+"_script_"+cb_id);

      document.getElementsByTagName("head")[0].appendChild(s);
      
      return this;
    },
    
    options:{
      format: "json",
      proxy: false
    },
    _functions: {
      "search": {
        "search": {
          auth_req: false,
          url:"http://search.twitter.com/search.format", 
          required:{"q":0},
          takes_params: true,
          root: "results"
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
          url:"http://twitter.com/users/show.format",
          takes_params: true
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
        show: {
          auth_req: false,
          url:"http://twitter.com/friendships/show.format",
          takes_params: true
        }
      },
      "friends": {
        ids: {
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
})("TWITTER");