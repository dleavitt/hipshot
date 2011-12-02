(function() {
  var BeanstalkAppAPI, HipChatAPI, errorHandler, exec, fs, moment, parseCredString, rest, sys, _;
  var __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };
  sys = require('sys');
  fs = require('fs');
  exec = require('child_process').exec;
  rest = require('restler');
  moment = require('moment');
  _ = require('underscore');
  BeanstalkAppAPI = (function() {
    function BeanstalkAppAPI(domain, username, password) {
      this.domain = domain;
      this.username = username;
      this.password = password;
      this.baseURL = "https://" + this.domain + ".beanstalkapp.com/api";
    }
    BeanstalkAppAPI.prototype.defaults = function(opts) {
      if (opts == null) {
        opts = {};
      }
      return _.defaults(opts, {
        username: this.username,
        password: this.password,
        headers: {
          "Content-Type": 'application/json'
        }
      });
    };
    BeanstalkAppAPI.prototype.get = function(url, options) {
      return rest.get(this.baseURL + url + '.json', this.defaults(options)).on('error', errorHandler);
    };
    return BeanstalkAppAPI;
  })();
  HipChatAPI = (function() {
    function HipChatAPI(token, roomID) {
      this.token = token;
      this.roomID = roomID;
      this.baseURL = "https://api.hipchat.com/v1";
    }
    HipChatAPI.prototype.defaults = function(opts) {
      var auth_token;
      if (opts == null) {
        opts = {};
      }
      return _.defaults(opts, {
        room_id: this.roomID
      }, auth_token = this.token, {
        format: 'json'
      });
    };
    HipChatAPI.prototype.post = function(url, options) {
      return rest.get(this.baseURL + url, this.defaults(options)).on('error', errorHandler);
    };
    HipChatAPI.prototype.notify = function(message) {
      return post('/rooms/messages', {
        from: "Beanstalk"
      });
    };
    return HipChatAPI;
  })();
  parseCredString = function(credString) {
    var matches;
    if (matches = credString != null ? credString.match(/^(\w+):(.+)@(\w+)$/) : void 0) {
      return matches.slice(1, 4);
    } else {
      console.error("Usage: growl-deploy username:password@subdomain");
      return process.exit(1);
    }
  };
  errorHandler = function(data, res) {
    console.log(data);
    return sys.puts("Beanstalk API Errors:" + _(data).map(function(line) {
      return "\n'" + line + "'";
    }).join());
  };
  exports.hipShot = {
    repos: {},
    init: function(path) {
      var conf;
      if (path == null) {
        path = "config.json";
      }
      conf = JSON.parse(fs.readFileSync(path, "utf8"));
      this.beanstalk = new BeanstalkAppAPI(conf.beanstalk.domain, conf.beanstalk.username, conf.beanstalk.password);
      return this.getRepos(__bind(function() {
        return this.check(__bind(function(data) {
          var _ref;
          this.lastId = ((_ref = data[5]) != null ? _ref.release.id : void 0) || 0;
          return this.notify(data);
        }, this));
      }, this));
    },
    notify: function(data) {
      _(data).reverse().forEach(__bind(function(item) {
        var release;
        release = item.release;
        if (release.id > this.lastId) {
          this.lastId = release.id;
          return console.log(this.repos[release.repository_id]);
        }
      }, this));
      return setTimeout(__bind(function() {
        return this.check(__bind(function(data) {
          return this.notify(data);
        }, this));
      }, this), 5000);
    },
    check: function(callback) {
      var req;
      return req = this.beanstalk.get('/releases', {
        query: {
          limit: 1
        }
      }).on('success', callback);
    },
    getRepos: function(callback) {
      return this.beanstalk.get("/repositories").on('success', __bind(function(data, req) {
        this.repos = {};
        data.forEach(__bind(function(rawRepo) {
          return this.repos[rawRepo.repository.id] = rawRepo.repository;
        }, this));
        return callback(this.repos);
      }, this));
    },
    message: function(repo, release) {
      var cmd, msg, title;
      title = "" + repo.title + " (" + release.environment_name + ")";
      msg = "" + release.comment + " \n - " + release.author;
      return cmd = "growlnotify -I ../lib/beanstalk.png -n growl-deploy -t '" + title + "' -m '" + msg + "'";
    }
  };
}).call(this);
