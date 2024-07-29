#!/bin/sh
#ls ~/Downloads/Library.xml|entr ./rerunLibrary.sh

./cli.js --format json --tracks newTracks.json ~/Downloads/Library.xml ; cat newTracks.json | jq . > newTracksNeat.json ;  mv newTracksNeat.json newTracksConsol.json
echo "moved"
date
