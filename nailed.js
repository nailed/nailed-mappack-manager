#!/usr/bin/env node
var program = require("commander");

program
  .version("0.1.0")

program
  .command("install <mappack>")
  .description("Install a mappack into the current folder")
  .action(function(mappack){
    console.log(mappack);
  });

program.parse(process.argv);

if(!process.argv.slice(2).length){
  program.outputHelp();
}
