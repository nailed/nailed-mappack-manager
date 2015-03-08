#!/usr/bin/env node
var program = require("commander");
var fs = require("fs");
var path = require("path");
var replaceStream = require("replacestream");
var archiver = require("archiver");
var xml2js = require("xml2js");
var http = require("http");
var prompt = require("prompt");

function packageMappack(cb){
  var parser = new xml2js.Parser();
  fs.readFile("game.xml", function(err, data) {
    parser.parseString(data, function(err, result){
      var version = result.game.version[0];
      var name = result.game.name[0].toLowerCase();

      console.log("Packaging " + name + " version " + version);

      var out = fs.createWriteStream(".nmm/packages/" + name + "-" + version + ".zip");
      var archive = archiver("zip");
      out.on("close", function(){
        console.log("Mappack packaged");
        if(cb) cb(".nmm/packages/" + name + "-" + version + ".zip", name, version);
      });
      archive.on("error", function(err){
        console.log(err);
      });
      archive.pipe(out);
      archive.append(fs.createReadStream("game.xml"),{name: "game.xml"});
      archive.directory("scripts");
      archive.directory("worlds");
      archive.finalize();
    });
  });
}

program
  .version("0.1.0");

program
  .command("init")
  .description("Initialize a new mappack into the current folder")
  .action(function(){
    fs.stat(".nmm", function(err){
      if(err) fs.mkdirSync(".nmm");
    });
    fs.stat(".nmm/packages", function(err){
      if(err) fs.mkdirSync(".nmm/packages");
    });
    fs.stat("worlds", function(err){
      if(err) fs.mkdirSync("worlds");
    });
    fs.stat("game.xml", function(err){
      if(err){
        var rd = fs.createReadStream(path.join(__dirname, "game.example.xml"));
        rd.on("error", function(){});
        var wr = fs.createWriteStream("game.xml");
        rd.on("error", function(){});
        wr.on("close", function(){});
        rd.pipe(replaceStream("@@MPNAME@@", path.basename(process.cwd()))).pipe(wr);
      }
    });
  });

program
  .command("package")
  .description("Package the mappack")
  .action(packageMappack);

program
  .command("deploy")
  .description("Deploy the mappack")
  .action(function(){
    packageMappack(function(p, mappack, version){
      var filename = path.basename(p);
      var boundary = Math.random().toString(16);
      prompt.start();
      prompt.get([
        {
          name: "username", 
          validator: /^[a-zA-Z0-9\-]+$/,
          warning: "Username must be only letters, or dashes"
        },
        {
          name: "password",
          hidden: true
        }
      ], function(err, result){
        if(err) throw err;
        var auth = "Basic " + new Buffer(result.username + ":" + result.password).toString("base64");
        var request = http.request({
          host: "nmm.jk-5.tk",
          path: "/upload.php?mappack=" + mappack + "&version=" + version,
          method: "POST",
          headers: {
            "Content-Type": "multipart/form-data; boundary=\"" + boundary + "\"",
            "Authorization": auth
          }
        }, function(response){
          var data = "";
          response.on("data", function(chunk){
            data += chunk.toString();
          });
          response.on("end", function(){
            console.log(data);
          });
        });

        request.write( 
          "--" + boundary + "\r\n" +
          "Content-Type: application/zip\r\n" +
          "Content-Disposition: form-data; name=\"file\"; filename=\"" + filename + "\"\r\n" +
          "Content-Length: " + fs.statSync(p)["size"] +
          "Content-Transfer-Encoding: binary\r\n\r\n'"
        );
        fs.createReadStream(p, {bufferSize: 4 * 1024})
          .on("end", function(){
            request.end("\r\n--" + boundary + "--"); 
          })
          .pipe(request, {end: false});
      });
    });
  });

program.parse(process.argv);

if(!process.argv.slice(2).length){
  program.outputHelp();
}
