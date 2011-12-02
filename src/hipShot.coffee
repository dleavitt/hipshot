fs      = require 'fs'
exec    = require('child_process').exec
rest    = require 'restler'
_       = require 'underscore'

class BeanstalkAppAPI
  constructor: (@domain, @username, @password) ->
    @baseURL = "https://#{@domain}.beanstalkapp.com/api"
  
  defaults: (opts = {}) ->
    _.defaults opts,
      username: @username
      password: @password
      headers: 
        "Content-Type": 'application/json'
  
  get: (url, options) -> 
    rest.get(@baseURL+url+'.json', @defaults(options)).on 'error', errorHandler
  
  repoURL: (repo) ->
    "https://#{@domain}.beanstalkapp.com/#{repo.name}"
        
# end class BeanstalkAppAPI

class HipChatAPI
  constructor: (@token, @roomID) ->
    @baseURL = "https://api.hipchat.com/v1"
  
  defaults: (opts = {}) ->
    _.defaults opts, 
      room_id: @roomID
      auth_token: @token
      format: 'json'
  
  post: (url, options) ->
    rest.post(@baseURL+url, data: @defaults(options.data)).on 'error', errorHandler
    
  notify: (message, callback) ->
    data = 
      from: "Beanstalk"
      notify: false
      color: "green"
      message: message
    @post('/rooms/message', data: data)
      .on 'error', (a,b) => errorHandler

errorHandler = (data, res) ->
  console.log(data)
  
exports.hipShot =
  repos: {}
  
  init: (path = "config.json") ->
    conf = JSON.parse(fs.readFileSync path, "utf8")
    
    @beanstalk = new BeanstalkAppAPI(conf.beanstalk.domain, conf.beanstalk.username, conf.beanstalk.password)
    @hipchat = new HipChatAPI(conf.hipchat.token, conf.hipchat.room)
    # TODO: periodically refresh list of repos
    @getRepos =>
      @check (data) =>
        @lastId = data[1]?.release.id or 0
        @notify(data)
      
  notify: (data) ->
    _(data).reverse().forEach (item) =>
      release = item.release
      if release.id > @lastId
        @lastId = release.id
        repo = @repos[release.repository_id]
        message = "
          <b><a href='#{@beanstalk.repoURL(repo)}'>#{repo.title}</a>
          <br />
          #{release.environment_name}</b>
          <br />
          <i>Deployed by #{release.author}</i>
          <br />
          #{release.comment}"
        console.log(release)
        @hipchat.notify(message)
        
    # check again in 5s
    setTimeout () =>
      @check (data) => @notify(data)
    , 5000
      
  check: (callback) ->
    req = @beanstalk.get('/releases', query: {limit: 1}).on 'success', callback
  
  getRepos: (callback) ->
    @beanstalk.get("/repositories").on 'success', (data, req) =>
      data.forEach (rawRepo) => @repos[rawRepo.repository.id] = rawRepo.repository
      callback(@repos)
