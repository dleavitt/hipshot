# TODO: password prompt for creds
sys     = require 'sys'
fs      = require 'fs'
exec    = require('child_process').exec
rest    = require 'restler'
moment  = require 'moment'
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
        
# end class BeanstalkAppAPI

class HipChatAPI
  constructor: (@token, @roomID) ->
    @baseURL = "https://api.hipchat.com/v1"
  
  defaults: (opts = {}) ->
    _.defaults opts,
      room_id: @roomID,
      auth_token = @token,
      format: 'json'
  
  post: (url, options) ->
    rest.get(@baseURL+url, @defaults(options)).on 'error', errorHandler
    
  notify: (message) ->
    post '/rooms/messages', 
      from: "Beanstalk"
      

parseCredString = (credString) ->
  if matches = credString?.match(/^(\w+):(.+)@(\w+)$/)
    matches.slice(1,4)
  else
    console.error "Usage: growl-deploy username:password@subdomain"
    process.exit(1)

errorHandler = (data, res) ->
  console.log(data)
  sys.puts "Beanstalk API Errors:"+_(data).map((line) -> "\n'#{line}'").join()
  
exports.hipShot =
  repos: {}
  
  init: (path = "config.json") ->
    conf = JSON.parse(fs.readFileSync path, "utf8")
    @beanstalk = new BeanstalkAppAPI(conf.beanstalk.domain, conf.beanstalk.username, conf.beanstalk.password)
    @getRepos =>
      @check (data) =>
        @lastId = data[5]?.release.id or 0
        @notify(data)
      
  notify: (data) ->
    _(data).reverse().forEach (item) =>
      release = item.release
      if release.id > @lastId
        @lastId = release.id
        console.log @repos[release.repository_id]
    # check again in .5s
    setTimeout () =>
      @check (data) => @notify(data)
    , 5000
      
  check: (callback) ->
    req = @beanstalk.get('/releases', query: {limit: 1}).on 'success', callback
  
  getRepos: (callback) ->
    @beanstalk.get("/repositories").on 'success', (data, req) =>
      @repos = {}
      data.forEach (rawRepo) => @repos[rawRepo.repository.id] = rawRepo.repository
      callback(@repos)
    
  message: (repo, release) ->
    title = "#{repo.title} (#{release.environment_name})"
    msg = "#{release.comment} \n - #{release.author}"
    # TODO: add date
    cmd = "growlnotify -I ../lib/beanstalk.png -n growl-deploy -t '#{title}' -m '#{msg}'" 
