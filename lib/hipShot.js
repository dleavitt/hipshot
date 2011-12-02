(function() {
  var BeanstalkAppAPI, HipChatAPI, errorHandler, exec, fs, rest, _;
  var __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };
  fs = require('fs');
  exec = require('child_process').exec;
  rest = require('restler');
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
    BeanstalkAppAPI.prototype.repoURL = function(repo) {
      return "https://" + this.domain + ".beanstalkapp.com/" + repo.name;
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
      if (opts == null) {
        opts = {};
      }
      return _.defaults(opts, {
        room_id: this.roomID,
        auth_token: this.token,
        format: 'json'
      });
    };
    HipChatAPI.prototype.post = function(url, options) {
      return rest.post(this.baseURL + url, {
        data: this.defaults(options.data)
      }).on('error', errorHandler);
    };
    HipChatAPI.prototype.notify = function(message, callback) {
      var data;
      data = {
        from: "Beanstalk",
        notify: false,
        color: "green",
        message: message
      };
      return this.post('/rooms/message', {
        data: data
      }).on('error', __bind(function(a, b) {
        return errorHandler;
      }, this));
    };
    return HipChatAPI;
  })();
  errorHandler = function(data, res) {
    return console.log(data);
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
      this.hipchat = new HipChatAPI(conf.hipchat.token, conf.hipchat.room);
      return this.getRepos(__bind(function() {
        return this.check(__bind(function(data) {
          var _ref;
          this.lastId = ((_ref = data[1]) != null ? _ref.release.id : void 0) || 0;
          return this.notify(data);
        }, this));
      }, this));
    },
    notify: function(data) {
      _(data).reverse().forEach(__bind(function(item) {
        var message, release, repo;
        release = item.release;
        if (release.id > this.lastId) {
          this.lastId = release.id;
          repo = this.repos[release.repository_id];
          message = "          <b><a href='" + (this.beanstalk.repoURL(repo)) + "'>" + repo.title + "</a>          <br />          " + release.environment_name + "</b>          <br />          <i>Deployed by " + release.author + "</i>          <br />          " + release.comment;
          console.log(release);
          return this.hipchat.notify(message);
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
        data.forEach(__bind(function(rawRepo) {
          return this.repos[rawRepo.repository.id] = rawRepo.repository;
        }, this));
        return callback(this.repos);
      }, this));
    }
  };
}).call(this);
