#!/bin/sh

./cli.js --format json --tracks newTracks.json ~/Downloads/Library.xml ; cat newTracks.json | jq . > newTracksNeat.json ;  mv newTracksNeat.json newTracksConsol.json
